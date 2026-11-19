"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { bolehMengubah, currentUser, logAudit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { kondisiSurat, PESAAN_TERTUTUP, suratTertutup } from "@/lib/status-surat";
import { labelUndangan } from "@/lib/status";
import { galat, sukses, type Hasil } from "@/lib/hasil";

export type SuratState = { error?: string; galat?: Record<string, string>; ok?: string };

const schema = z.object({
  tanggal_terima: z.string().min(1, "Tanggal terima wajib diisi."),
  pengirim: z.string().trim().min(2, "Pengirim wajib diisi."),
  pengirim_lain: z.string().trim().max(200).optional(),
  nomor_surat: z.string().trim().max(150).optional(),
  tanggal_surat: z.string().trim().optional(),
  perihal: z.string().trim().min(3, "Perihal wajib diisi."),
  isi_ringkas: z.string().trim().max(4000).optional(),
  jenis_surat_id: z.string().optional(),
  undangan: z.enum(["belum", "ya", "tidak"], {
    error: "Pilih kaitan agenda surat: belum ditentukan, ada agenda, atau tidak ada agenda.",
  }),
  rapat_agenda: z.string().trim().optional(),
  rapat_mulai: z.string().trim().optional(),
  rapat_selesai: z.string().trim().optional(),
  rapat_tempat: z.string().trim().optional(),
  rapat_penyelenggara: z.string().trim().optional(),
});

/** Tanggal kalender: anchored ke UTC supaya kolom `date` tidak bergeser mundur satu hari. */
function hari(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function waktu(value: string): Date {
  return new Date(value);
}

async function penulis() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!bolehMengubah(user.role)) return null;
  return user;
}

export async function buatSurat(prev: SuratState, formData: FormData): Promise<SuratState> {
  const user = await penulis();
  if (!user) return { error: "Akun ini hanya berhak membaca data, tidak dapat mencatat surat." };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    // Galat per isian supaya petugas melihat field mana yang salah, bukan satu kalimat gabungan.
    const galat: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const kunci = i.path[0];
      if (typeof kunci === "string" && !galat[kunci]) galat[kunci] = i.message;
    }
    return { galat };
  }
  const d = parsed.data;

  // Pengirim dipilih dari daftar resmi; pilihan "lainnya" harus diketik.
  let pengirim = d.pengirim;
  if (pengirim === "__lain__") {
    if (!d.pengirim_lain) return { galat: { pengirim: "Nama pengirim lainnya wajib diisi." } };
    pengirim = d.pengirim_lain;
  }

  if (d.undangan === "ya" && (!d.rapat_agenda || !d.rapat_mulai)) {
    const galat: Record<string, string> = {};
    if (!d.rapat_agenda) galat.rapat_agenda = "Judul agenda wajib diisi untuk surat berstatus undangan.";
    if (!d.rapat_mulai) galat.rapat_mulai = "Waktu mulai wajib diisi untuk surat berstatus undangan.";
    return { galat };
  }
  if (d.rapat_selesai && d.rapat_mulai && waktu(d.rapat_selesai) <= waktu(d.rapat_mulai)) {
    return { galat: { rapat_selesai: "Waktu selesai agenda tidak boleh mendahului waktu mulai." } };
  }

  const tahun = hari(d.tanggal_terima).getFullYear();
  const [hitung] = await prisma.$queryRaw<{ nomor: string }[]>`
    SELECT next_nomor_agenda(${tahun}::int) AS nomor
  `;

  const surat = await prisma.surat_masuk.create({
    data: {
      nomor_agenda: hitung.nomor,
      tanggal_terima: hari(d.tanggal_terima),
      pengirim,
      nomor_surat: d.nomor_surat || null,
      tanggal_surat: d.tanggal_surat ? hari(d.tanggal_surat) : null,
      perihal: d.perihal,
      isi_ringkas: d.isi_ringkas || null,
      jenis_surat_id: d.jenis_surat_id || null,
      status_undangan_rapat: d.undangan,
      created_by: user.id,
      updated_by: user.id,
    },
  });

  if (d.undangan === "ya") {
    await prisma.jadwal_rapat.create({
      data: {
        surat_id: surat.id,
        agenda_rapat: d.rapat_agenda!,
        tanggal_mulai: waktu(d.rapat_mulai!),
        tanggal_selesai: d.rapat_selesai ? waktu(d.rapat_selesai) : null,
        tempat: d.rapat_tempat || null,
        penyelenggara: d.rapat_penyelenggara || null,
        created_by: user.id,
      },
    });
  }

  await logAudit(user, "buat_surat", "surat_masuk", surat.id, `Nomor agenda ${surat.nomor_agenda} dicatat`);
  redirect(`/surat/${surat.id}?ok=1&t=${Date.now()}`);
}

export async function ubahUndangan(
  suratId: string,
  prev: SuratState,
  formData: FormData,
): Promise<SuratState> {
  const user = await penulis();
  if (!user) return { error: "Akun ini hanya berhak membaca data." };

  const nilai = String(formData.get("status_undangan_rapat") ?? "");
  if (!["belum", "ya", "tidak"].includes(nilai)) return { error: "Kaitan agenda surat tidak dikenali." };

  try {
    await prisma.surat_masuk.update({ where: { id: suratId }, data: { status_undangan_rapat: nilai, updated_by: user.id } });
  } catch (e) {
    // penolakan database diterjemahkan ke kalimat kerja; pesan Prisma penuh menyebut query dan kode
    const pesan = e instanceof Error ? e.message : "";
    const alasan = pesan.match(/Surat .*agenda aktif/)?.[0] ?? "perubahan tidak bisa disimpan";
    return { error: `Kaitan agenda surat gagal diubah — ${alasan}.` };
  }

  await logAudit(user, "ubah_undangan", "surat_masuk", suratId, `Kaitan agenda surat diubah ke ${labelUndangan[nilai] ?? nilai}`);
  return { ok: "Kaitan agenda surat diperbarui." };
}

/** Kaitan surat dengan agenda. Tidak berpindah halaman: halaman detail surat di-refresh setelah sukses. */
export async function simpanStatusUndangan(form: FormData): Promise<Hasil> {
  const suratId = String(form.get("surat_id") ?? "");
  const hasil = await ubahUndangan(suratId, {}, form);
  return hasil.error ? galat(hasil.error) : sukses(hasil.ok);
}

/** Isian identitas yang bisa dikoreksi. Nomor agenda dan status undangan tidak termasuk di sini. */
const ubahSchema = z.object({
  id: z.string().min(1),
  tanggal_terima: z.string().min(1, "Tanggal terima wajib diisi."),
  pengirim: z.string().trim().min(2, "Pengirim wajib diisi."),
  pengirim_lain: z.string().trim().max(200).optional(),
  nomor_surat: z.string().trim().max(150).optional(),
  tanggal_surat: z.string().trim().optional(),
  perihal: z.string().trim().min(3, "Perihal wajib diisi."),
  isi_ringkas: z.string().trim().max(4000).optional(),
  jenis_surat_id: z.string().optional(),
});

/** Mengoreksi identitas surat yang sudah dicatat. Nomor agenda tetap, karena ia penanda arsip. */
export async function ubahSuratMasuk(prev: SuratState, formData: FormData): Promise<SuratState> {
  const suratId = String(formData.get("id") ?? "");
  const user = await penulis();
  if (!user) return { error: "Akun ini hanya berhak membaca data, tidak dapat mengubah surat." };

  const parsed = ubahSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const galat: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const kunci = i.path[0];
      if (typeof kunci === "string" && !galat[kunci]) galat[kunci] = i.message;
    }
    return { galat };
  }
  const d = parsed.data;

  let pengirim = d.pengirim;
  if (pengirim === "__lain__") {
    if (!d.pengirim_lain) return { galat: { pengirim: "Nama pengirim lainnya wajib diisi." } };
    pengirim = d.pengirim_lain;
  }

  const tanggalTerima = hari(d.tanggal_terima);
  const tanggalSurat = d.tanggal_surat ? hari(d.tanggal_surat) : null;
  if (tanggalSurat && tanggalSurat > tanggalTerima) {
    return { galat: { tanggal_surat: "Tanggal surat tidak boleh setelah tanggal terima." } };
  }

  const surat = await prisma.surat_masuk.findUnique({ where: { id: suratId } });
  if (!surat) return { error: "Surat tidak ditemukan." };
  if (surat.status_surat === "arsip") return { error: PESAAN_TERTUTUP };

  // Kategori yang masih terpakai boleh tetap dipilih walau sudah dinonaktifkan; kategori lain harus aktif.
  const jenisId = d.jenis_surat_id || null;
  if (jenisId && jenisId !== surat.jenis_surat_id) {
    const jenis = await prisma.jenis_surat.findFirst({ where: { id: jenisId } });
    if (!jenis) return { galat: { jenis_surat_id: "Kategori surat tidak dikenali." } };
    if (!jenis.aktif) return { galat: { jenis_surat_id: "Kategori surat sudah tidak dipakai. Pilih kategori lain." } };
  }

  const berubah: string[] = [];
  if (surat.pengirim !== pengirim) berubah.push(`pengirim menjadi ${pengirim}`);
  if ((surat.nomor_surat ?? null) !== (d.nomor_surat || null)) berubah.push(d.nomor_surat ? `nomor surat menjadi ${d.nomor_surat}` : "nomor surat dikosongkan");
  if (surat.tanggal_terima.getTime() !== tanggalTerima.getTime()) berubah.push(`tanggal terima menjadi ${d.tanggal_terima}`);
  if ((surat.tanggal_surat?.getTime() ?? null) !== (tanggalSurat?.getTime() ?? null)) berubah.push("tanggal surat diubah");
  if (surat.perihal !== d.perihal) berubah.push("perihal diubah");
  if ((surat.isi_ringkas ?? null) !== (d.isi_ringkas || null)) berubah.push("ringkasan isi diubah");
  if ((surat.jenis_surat_id ?? null) !== jenisId) berubah.push(jenisId ? "kategori surat diubah" : "kategori surat dikosongkan");

  await prisma.surat_masuk.update({
    where: { id: suratId },
    data: {
      tanggal_terima: tanggalTerima,
      pengirim,
      nomor_surat: d.nomor_surat || null,
      tanggal_surat: tanggalSurat,
      perihal: d.perihal,
      isi_ringkas: d.isi_ringkas || null,
      jenis_surat_id: jenisId,
      updated_by: user.id,
    },
  });

  await logAudit(user, "ubah_surat", "surat_masuk", suratId, `Surat ${surat.nomor_agenda} dikoreksi: ${berubah.join(", ") || "tanpa perubahan nilai"}`);
  return { ok: "Identitas surat diperbarui." };
}

/** Mengarsipkan surat yang sudah selesai. Surat tetap terbaca dan tetap dihitung di rekap. */
/** Mengarsipkan surat yang sudah selesai, di halaman surat itu sendiri. */
export async function arsipkanSurat(form: FormData): Promise<Hasil> {
  const suratId = String(form.get("surat_id") ?? "");

  const user = await penulis();
  if (!user) return galat("Akun ini hanya berhak membaca data.");

  const surat = await prisma.surat_masuk.findUnique({ where: { id: suratId } });
  if (!surat) return galat("Surat tidak ditemukan.");

  const { belum, rapatAktif } = await kondisiSurat(suratId);
  const halang: string[] = [];
  if (belum > 0) halang.push(`Masih ada ${belum} langkah disposisi yang belum selesai. Selesaikan atau hapus langkah disposisi itu dulu.`);
  if (rapatAktif > 0) halang.push(`Masih ada ${rapatAktif} agenda aktif. Selesaikan atau batalkan agenda itu dulu.`);
  if (halang.length > 0) return galat(halang.join(" "));

  await prisma.surat_masuk.update({ where: { id: suratId }, data: { status_surat: "arsip", updated_by: user.id } });
  await logAudit(user, "arsip_surat", "surat_masuk", suratId, `Surat ${surat.nomor_agenda} diarsipkan`);
  return sukses("Surat diarsipkan. Surat tetap terbaca dan tetap dihitung di rekap.");
}

/** Mengeluarkan surat dari arsip. Statusnya mengikuti langkah disposisi yang tersisa. */
/** Mengeluarkan surat dari arsip; statusnya mengikuti langkah disposisi yang tersisa. */
export async function pulihkanSurat(form: FormData): Promise<Hasil> {
  const suratId = String(form.get("surat_id") ?? "");

  const user = await penulis();
  if (!user) return galat("Akun ini hanya berhak membaca data.");

  const surat = await prisma.surat_masuk.findUnique({ where: { id: suratId } });
  if (!surat) return galat("Surat tidak ditemukan.");
  if (surat.status_surat !== "arsip") return galat("Surat ini tidak sedang diarsipkan.");

  const { status } = await kondisiSurat(suratId);
  await prisma.surat_masuk.update({ where: { id: suratId }, data: { status_surat: status, updated_by: user.id } });
  await logAudit(user, "pulih_surat", "surat_masuk", suratId, `Surat ${surat.nomor_agenda} dikeluarkan dari arsip, status menjadi ${status}`);
  return sukses("Surat dikeluarkan dari arsip dan kembali ke daftar kerja.");
}

/**
 * Penghapusan permanen. Tabel anak menolak surat yang masih punya lampiran, disposisi, atau agenda rapat
 * (ON DELETE RESTRICT), jadi jumlah anak diperiksa lebih dulu dan pengguna diberi tahu apa yang harus dibersihkan.
 */
export async function hapusSuratKeras(form: FormData): Promise<Hasil> {
  const suratId = String(form.get("surat_id") ?? "");

  const user = await penulis();
  if (!user) return galat("Akun ini hanya berhak membaca data.");

  const surat = await prisma.surat_masuk.findUnique({
    where: { id: suratId },
    include: { lampiran_surat: true, disposisi: true, jadwal_rapat: { include: { peserta_rapat: true } } },
  });
  if (!surat) return galat("Surat tidak ditemukan.");

  const halang: string[] = [];
  if (surat.lampiran_surat.length > 0) {
    halang.push(`Surat ini masih punya ${surat.lampiran_surat.length} lampiran. Hapus lampirannya dulu agar berkas di folder uploads ikut bersih.`);
  }
  if (surat.disposisi.length > 0) {
    halang.push(`Masih ada ${surat.disposisi.length} langkah disposisi. Hapus langkah disposisi itu dulu.`);
  }
  const peserta = surat.jadwal_rapat.reduce((n, r) => n + r.peserta_rapat.length, 0);
  if (surat.jadwal_rapat.length > 0) {
    halang.push(
      `Masih ada ${surat.jadwal_rapat.length} agenda terkait${peserta > 0 ? ` dengan ${peserta} peserta` : ""}. Hapus agenda itu dari detail suratnya dulu.`,
    );
  }
  if (halang.length > 0) return galat(halang.join(" "));

  await prisma.surat_masuk.delete({ where: { id: suratId } });
  await logAudit(user, "hapus_surat", "surat_masuk", suratId, `Surat ${surat.nomor_agenda} (${surat.perihal}) dihapus permanen`);
  return sukses(`Nomor agenda ${surat.nomor_agenda} dihapus permanen dari agenda surat.`);
}
