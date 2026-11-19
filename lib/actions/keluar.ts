"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { bolehMengubah, currentUser, logAudit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tanggalJamText } from "@/lib/format";
import { PESAAN_TERTUTUP_KELUAR } from "@/lib/status-surat";
import { galat, sukses, type Hasil } from "@/lib/hasil";

export type SuratKeluarState = { error?: string; galat?: Record<string, string>; ok?: string };

/** Tanggal kalender anchored ke UTC supaya kolom `date` tidak bergeser mundur satu hari. */
function hari(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

async function penulis() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!bolehMengubah(user.role)) return null;
  return user;
}

/** Galat zod per isian, supaya petugas melihat field mana yang salah. */
function galatIsian(error: z.ZodError): Record<string, string> {
  const g: Record<string, string> = {};
  for (const i of error.issues) {
    const kunci = i.path[0];
    if (typeof kunci === "string" && !g[kunci]) g[kunci] = i.message;
  }
  return g;
}

const schemaIsi = z.object({
  id: z.string().optional(),
  tanggal_surat: z.string().min(1, "Tanggal surat wajib diisi."),
  tujuan: z.string().trim().min(2, "Tujuan surat wajib diisi."),
  tujuan_lain: z.string().trim().max(200).optional(),
  nomor_surat: z.string().trim().max(150).optional(),
  perihal: z.string().trim().min(3, "Perihal wajib diisi."),
  isi_ringkas: z.string().trim().max(4000).optional(),
  catatan: z.string().trim().max(2000).optional(),
  jenis_surat_id: z.string().optional(),
  surat_asal_id: z.string().optional(),
  waktu_kirim: z.string().trim().optional(),
});

/**
 * Waktu kirim bisa ditulis manual bila surat sudah keluar sebelum dicatat di aplikasi, atau belum
 * keluar sama sekali (kosong). Waktu dibaca sebagai jam Asia/Jakarta dan tidak boleh mendahului
 * tanggal surat. Kosong hanya boleh bila surat masih draf.
 */
function nilaiWaktuKirim(nilai: string | undefined, tanggalSurat: Date, status: string):
  { galat: Record<string, string> } | { waktu: Date | null }
{
  if (!nilai) {
    if (status !== "draf") return { galat: { waktu_kirim: "Waktu kirim tidak bisa dikosongkan — surat sudah ditandai dikirim." } };
    return { waktu: null };
  }
  const waktu = new Date(`${nilai}:00+07:00`);
  if (Number.isNaN(waktu.getTime())) return { galat: { waktu_kirim: "Waktu kirim tidak terbaca sebagai tanggal dan jam." } };
  if (waktu.getTime() < tanggalSurat.getTime())
    return { galat: { waktu_kirim: "Waktu kirim harus setelah tanggal surat." } };
  return { waktu };
}

/**
 * Tujuan dipilih dari daftar resmi; "lainnya" harus diketik. Kategori surat harus berarah keluar,
 * dan surat asal harus surat masuk yang masih tercatat (tautan balasan).
 */
async function nilaiIsi(d: z.infer<typeof schemaIsi>, jenisId: string | null): Promise<
  { galat: Record<string, string> } | { tujuan: string; jenisId: string | null; asalId: string | null }
> {
  let tujuan = d.tujuan;
  if (tujuan === "__lain__") {
    if (!d.tujuan_lain) return { galat: { tujuan: "Nama tujuan lainnya wajib diisi." } };
    tujuan = d.tujuan_lain;
  }

  if (jenisId) {
    const jenis = await prisma.jenis_surat.findFirst({ where: { id: jenisId } });
    if (!jenis) return { galat: { jenis_surat_id: "Kategori surat tidak dikenali." } };
    if (jenis.arah !== "keluar") return { galat: { jenis_surat_id: "Kategori surat ini bukan klasifikasi surat keluar." } };
    if (!jenis.aktif) return { galat: { jenis_surat_id: "Kategori surat sudah tidak dipakai. Pilih kategori lain." } };
  }

  const asalId = d.surat_asal_id || null;
  if (asalId) {
    const asal = await prisma.surat_masuk.findFirst({ where: { id: asalId, deleted_at: null } });
    if (!asal) return { galat: { surat_asal_id: "Surat asal tidak ditemukan atau sudah dihapus." } };
  }

  return { tujuan, jenisId, asalId };
}

/**
 * Mencatat surat keluar. Nomor surat dibuat otomatis (KL-001/2026) kecuali petugas mengetik
 * nomor sesuai tata naskahnya sendiri.
 */
export async function buatSuratKeluar(prev: SuratKeluarState, formData: FormData): Promise<SuratKeluarState> {
  const user = await penulis();
  if (!user) return { error: "Akun ini hanya berhak membaca data, tidak dapat mencatat surat." };

  const parsed = schemaIsi.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { galat: galatIsian(parsed.error) };
  const d = parsed.data;

  const cek = await nilaiIsi(d, d.jenis_surat_id || null);
  if ("galat" in cek) return { galat: cek.galat };

  const tanggalSurat = hari(d.tanggal_surat);
  const tahun = tanggalSurat.getFullYear();

  const nomorSurat = d.nomor_surat?.trim() || (await prisma.$queryRaw<{ nomor: string }[]>`
    SELECT next_nomor_keluar(${tahun}::int) AS nomor
  `)[0].nomor;

  let surat: { id: string } | null = null;
  try {
    surat = await prisma.surat_keluar.create({
      data: {
        nomor_surat: nomorSurat,
        tanggal_surat: tanggalSurat,
        tujuan: cek.tujuan,
        perihal: d.perihal,
        isi_ringkas: d.isi_ringkas || null,
        catatan: d.catatan || null,
        jenis_surat_id: cek.jenisId,
        surat_asal_id: cek.asalId,
        created_by: user.id,
        updated_by: user.id,
      },
    });
  } catch (e) {
    const pesan = e instanceof Error ? e.message : "";
    if (pesan.includes("Unique constraint")) {
      return { galat: { nomor_surat: `Nomor surat ${nomorSurat} sudah dipakai surat keluar lain.` } };
    }
    return { error: pesan || "Surat keluar gagal disimpan." };
  }

  await logAudit(user, "buat_surat_keluar", "surat_keluar", surat.id, `Surat keluar ${nomorSurat} untuk ${cek.tujuan} dicatat`);
  // redirect() di luar try/catch: NEXT_REDIRECT adalah perintah pindah, bukan kegagalan penyimpanan.
  redirect(`/keluar/${surat.id}?ok=1&t=${Date.now()}`);
}

/** Isian yang bisa dikoreksi. Status surat tidak diubah di sini — ia punya bagiannya sendiri. */
export async function ubahSuratKeluar(prev: SuratKeluarState, formData: FormData): Promise<SuratKeluarState> {
  const suratId = String(formData.get("id") ?? "");
  const user = await penulis();
  if (!user) return { error: "Akun ini hanya berhak membaca data, tidak dapat mengubah surat." };

  const parsed = schemaIsi.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { galat: galatIsian(parsed.error) };
  const d = parsed.data;

  const surat = await prisma.surat_keluar.findUnique({ where: { id: suratId } });
  if (!surat) return { error: "Surat keluar tidak ditemukan." };
  if (surat.status_surat === "arsip") return { error: PESAAN_TERTUTUP_KELUAR };

  // Kategori yang masih terpakai boleh tetap dipilih walau sudah dinonaktifkan; kategori lain harus aktif.
  const jenisId = d.jenis_surat_id || null;
  const cek = await nilaiIsi(d, jenisId === surat.jenis_surat_id ? null : jenisId);
  if ("galat" in cek) return { galat: cek.galat };

  const nomorSurat = d.nomor_surat?.trim() || surat.nomor_surat;
  const tanggalSurat = hari(d.tanggal_surat);
  const waktu = nilaiWaktuKirim(d.waktu_kirim, tanggalSurat, surat.status_surat);
  if ("galat" in waktu) return { galat: waktu.galat };
  const berubah: string[] = [];
  if (surat.nomor_surat !== nomorSurat) berubah.push(`nomor surat menjadi ${nomorSurat}`);
  if (surat.tanggal_surat.getTime() !== tanggalSurat.getTime()) berubah.push(`tanggal surat menjadi ${d.tanggal_surat}`);
  if ((surat.tanggal_kirim?.getTime() ?? null) !== (waktu.waktu?.getTime() ?? null))
    berubah.push(waktu.waktu ? `waktu kirim menjadi ${tanggalJamText(waktu.waktu)}` : "waktu kirim dikosongkan");
  if (surat.tujuan !== cek.tujuan) berubah.push(`tujuan menjadi ${cek.tujuan}`);
  if (surat.perihal !== d.perihal) berubah.push("perihal diubah");
  if ((surat.isi_ringkas ?? null) !== (d.isi_ringkas || null)) berubah.push("ringkasan isi diubah");
  if ((surat.catatan ?? null) !== (d.catatan || null)) berubah.push("catatan diubah");
  if ((surat.jenis_surat_id ?? null) !== jenisId) berubah.push(jenisId ? "kategori surat diubah" : "kategori surat dikosongkan");
  if ((surat.surat_asal_id ?? null) !== cek.asalId) berubah.push(cek.asalId ? "surat asal ditautkan" : "tautan surat asal dilepas");

  try {
    await prisma.surat_keluar.update({
      where: { id: suratId },
      data: {
        nomor_surat: nomorSurat,
        tanggal_surat: tanggalSurat,
        tanggal_kirim: waktu.waktu,
        tujuan: cek.tujuan,
        perihal: d.perihal,
        isi_ringkas: d.isi_ringkas || null,
        catatan: d.catatan || null,
        jenis_surat_id: jenisId,
        surat_asal_id: cek.asalId,
        updated_by: user.id,
      },
    });
  } catch (e) {
    const pesan = e instanceof Error ? e.message : "";
    if (pesan.includes("Unique constraint")) {
      return { galat: { nomor_surat: `Nomor surat ${nomorSurat} sudah dipakai surat keluar lain.` } };
    }
    return { error: pesan || "Surat keluar gagal diubah." };
  }

  await logAudit(user, "ubah_surat_keluar", "surat_keluar", suratId, `Surat keluar ${surat.nomor_surat} dikoreksi: ${berubah.join(", ") || "tanpa perubahan nilai"}`);
  return { ok: "Identitas surat keluar diperbarui." };
}

/**
 * Status surat keluar draf/dikirim/selesai. Database menolak perjalanan mundur (sudah dikirim tidak
 * bisa kembali ke draf); penolakannya diterjemahkan ke kalimat kerja.
 */
export async function simpanStatusKeluar(form: FormData): Promise<Hasil> {
  const suratId = String(form.get("surat_id") ?? "");
  const nilai = String(form.get("status_surat") ?? "");

  const user = await penulis();
  if (!user) return galat("Akun ini hanya berhak membaca data.");
  if (!["draf", "dikirim", "selesai"].includes(nilai)) return galat("Status surat keluar tidak dikenali.");

  const surat = await prisma.surat_keluar.findUnique({ where: { id: suratId } });
  if (!surat) return galat("Surat keluar tidak ditemukan.");
  if (surat.status_surat === "arsip") return galat(PESAAN_TERTUTUP_KELUAR);
  if (surat.status_surat === nilai) return sukses("Status surat tidak berubah.");

  try {
    await prisma.surat_keluar.update({ where: { id: suratId }, data: { status_surat: nilai, updated_by: user.id } });
  } catch (e) {
    const alasan = (e instanceof Error ? e.message : "").match(/Surat .*menjadi/)?.[0] ?? "perubahan tidak bisa disimpan";
    return galat(`Status surat keluar gagal diubah — ${alasan}.`);
  }

  await logAudit(user, "ubah_status_keluar", "surat_keluar", suratId, `Surat keluar ${surat.nomor_surat} diubah ke status ${nilai}`);
  return sukses(
    nilai === "dikirim"
      ? "Surat keluar ditandai dikirim; waktu kirim tercatat."
      : nilai === "selesai"
        ? "Surat keluar ditandai selesai."
        : "Surat keluar kembali menjadi draf.",
  );
}

/** Mengarsipkan surat keluar. Draf tidak diarsipkan — surat yang belum dikirim masih pekerjaan berjalan. */
export async function arsipkanSuratKeluar(form: FormData): Promise<Hasil> {
  const suratId = String(form.get("surat_id") ?? "");

  const user = await penulis();
  if (!user) return galat("Akun ini hanya berhak membaca data.");

  const surat = await prisma.surat_keluar.findUnique({ where: { id: suratId } });
  if (!surat) return galat("Surat keluar tidak ditemukan.");
  if (surat.status_surat === "arsip") return galat("Surat keluar ini sudah diarsipkan.");
  if (surat.status_surat === "draf") {
    return galat("Surat masih draf. Tandai dikirim dulu sebelum diarsipkan — arsip adalah surat yang sudah keluar.");
  }

  await prisma.surat_keluar.update({
    where: { id: suratId },
    data: { status_surat: "arsip", status_sebelum_arsip: surat.status_surat, updated_by: user.id },
  });
  await logAudit(user, "arsip_keluar", "surat_keluar", suratId, `Surat keluar ${surat.nomor_surat} diarsipkan`);
  return sukses("Surat keluar diarsipkan. Surat tetap terbaca dan tetap dihitung di rekap.");
}

/** Mengeluarkan surat keluar dari arsip; statusnya kembali ke status sebelum diarsipkan. */
export async function pulihkanSuratKeluar(form: FormData): Promise<Hasil> {
  const suratId = String(form.get("surat_id") ?? "");

  const user = await penulis();
  if (!user) return galat("Akun ini hanya berhak membaca data.");

  const surat = await prisma.surat_keluar.findUnique({ where: { id: suratId } });
  if (!surat) return galat("Surat keluar tidak ditemukan.");
  if (surat.status_surat !== "arsip") return galat("Surat keluar ini tidak sedang diarsipkan.");

  const pulih = surat.status_sebelum_arsip ?? (surat.tanggal_kirim ? "dikirim" : "draf");
  await prisma.surat_keluar.update({
    where: { id: suratId },
    data: { status_surat: pulih, status_sebelum_arsip: null, updated_by: user.id },
  });
  await logAudit(user, "pulih_keluar", "surat_keluar", suratId, `Surat keluar ${surat.nomor_surat} dikeluarkan dari arsip, status menjadi ${pulih}`);
  return sukses(`Surat keluar dikeluarkan dari arsip, status kembali menjadi ${pulih}.`);
}

/** Penghapusan permanen; lampiran harus dibuang dulu karena tabel anak menolak (ON DELETE RESTRICT). */
export async function hapusSuratKeluar(form: FormData): Promise<Hasil> {
  const suratId = String(form.get("surat_id") ?? "");

  const user = await penulis();
  if (!user) return galat("Akun ini hanya berhak membaca data.");

  const surat = await prisma.surat_keluar.findUnique({ where: { id: suratId }, include: { lampiran_keluar: true } });
  if (!surat) return galat("Surat keluar tidak ditemukan.");

  if (surat.lampiran_keluar.length > 0) {
    return galat(
      `Surat ini masih punya ${surat.lampiran_keluar.length} lampiran. Hapus lampirannya dulu supaya berkasnya ikut terhapus.`,
    );
  }

  await prisma.surat_keluar.delete({ where: { id: suratId } });
  await logAudit(user, "hapus_surat_keluar", "surat_keluar", suratId, `Surat keluar ${surat.nomor_surat} (${surat.perihal}) dihapus permanen`);
  return sukses(`Nomor surat ${surat.nomor_surat} dihapus permanen dari daftar surat keluar.`);
}
