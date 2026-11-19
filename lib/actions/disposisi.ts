"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { bolehMengubah, currentUser, logAudit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { labelTindakLanjut, TANPA_INSTRUKSI } from "@/lib/status";
import { galat, sukses, type Hasil } from "@/lib/hasil";
import { PESAAN_TERTUTUP, sinkronkanStatusSurat, suratTertutup } from "@/lib/status-surat";

/** Nilai dropdown yang berarti "ketik nama sendiri", sama seperti di form tambah disposisi. */
const lain = "__lain__";

/** Dipakai `useActionState` pada formulir disposisi: `error` untuk galat, `ok` untuk pesan sukses. */
export type DisposisiState = { error?: string; ok?: string };

const schema = z.object({
  surat_id: z.string().min(1),
  tanggal_disposisi: z.string().min(1, "Tanggal disposisi wajib diisi."),
  pemberi_disposisi: z.string().trim().min(2, "Pemberi disposisi wajib diisi."),
  pemberi_lain: z.string().trim().max(200).optional(),
  penerima_disposisi: z.string().trim().max(200).optional(),
  penerima_lain: z.string().trim().max(200).optional(),
  tanggal_diteruskan: z.string().trim().optional(),
  instruksi: z.enum(["tanpa", "isi"]).optional(),
  isi_disposisi: z.string().trim().max(2000, { error: "Isi instruksi terlalu panjang, maksimum 2.000 karakter." }).optional(),
  catatan: z.string().trim().max(2000).optional(),
});

/**
 * Isi instruksi menurut pilihan pengguna. "Tanpa Instruksi" dicatat sebagai strip "-" karena kolom
 * `isi_disposisi` NOT NULL; "Instruksi" wajib punya isi. Nilai lama di database tidak diubah —
 * nilai "-" dan nilai kosong dibaca sebagai tanpa instruksi di lapisan tampilan (lib/status.ts).
 */
function ambilInstruksi(d: { instruksi?: string; isi_disposisi?: string }): { isi: string } | { galat: string } {
  if (d.instruksi === "tanpa") return { isi: TANPA_INSTRUKSI };
  const isi = (d.isi_disposisi ?? "").trim();
  if (isi.length < 3) return { galat: "Isi instruksi wajib diisi, atau pilih Tanpa Instruksi bila disposisi tidak diberi instruksi." };
  return { isi };
}

async function penulis() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return bolehMengubah(user.role) ? user : null;
}

/**
 * Langkah disposisi baru. Surat yang masih "belum_disposisi" menjadi "didisposisikan"; sisanya
 * dibiarkan karena surat sudah punya langkah lain. Tidak berpindah halaman — detail surat di-refresh.
 */
export async function tambahDisposisi(prev: DisposisiState, formData: FormData): Promise<DisposisiState> {
  const user = await penulis();
  if (!user) return { error: "Akun ini hanya berhak membaca data." };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((e: { message: string }) => e.message).join(" ") };
  const d = parsed.data;

  // Nama dari dropdown; "lainnya" diketik manual. Tujuan diteruskan boleh kosong karena
  // surat masih menunggu disposisi berikutnya.
  let pemberi = d.pemberi_disposisi;
  if (pemberi === "__lain__") {
    if (!d.pemberi_lain) return { error: "Nama pemberi disposisi lainnya wajib diisi." };
    pemberi = d.pemberi_lain;
  }
  let penerima = d.penerima_disposisi;
  if (penerima === "__lain__") {
    if (!d.penerima_lain) return { error: "Nama tujuan diteruskan lainnya wajib diisi." };
    penerima = d.penerima_lain;
  }
  const tanggalDiteruskan = d.tanggal_diteruskan ? new Date(`${d.tanggal_diteruskan}T00:00:00Z`) : null;
  if (tanggalDiteruskan && tanggalDiteruskan < new Date(`${d.tanggal_disposisi}T00:00:00Z`)) {
    return { error: "Tanggal diteruskan tidak boleh mendahului tanggal disposisi." };
  }

  const surat = await prisma.surat_masuk.findFirst({ where: { id: d.surat_id, deleted_at: null } });
  if (!surat) return { error: "Surat tidak ditemukan." };
  if (surat.status_surat === "arsip") return { error: PESAAN_TERTUTUP };

  const instruksi = ambilInstruksi(d);
  if ("galat" in instruksi) return { error: instruksi.galat };

  await prisma.disposisi.create({
    data: {
      surat_id: d.surat_id,
      tanggal_disposisi: new Date(`${d.tanggal_disposisi}T00:00:00Z`),
      pemberi_disposisi: pemberi,
      penerima_disposisi: penerima || null,
      tanggal_diteruskan: tanggalDiteruskan,
      isi_disposisi: instruksi.isi,
      catatan: d.catatan || null,
      created_by: user.id,
    },
  });

  if (surat.status_surat === "belum_disposisi") {
    await prisma.surat_masuk.update({ where: { id: d.surat_id }, data: { status_surat: "didisposisikan" } });
  }

  await logAudit(user, "buat_disposisi", "disposisi", d.surat_id, `Disposisi untuk ${surat.nomor_agenda} dicatat`);
  return { ok: "Disposisi tersimpan pada surat ini." };
}

const statusSchema = z.enum(["belum", "proses", "selesai", "tidak_perlu"]);

export async function ubahStatusDisposisi(prev: DisposisiState, formData: FormData): Promise<DisposisiState> {
  const user = await penulis();
  if (!user) return { error: "Akun ini hanya berhak membaca data." };

  const id = String(formData.get("id") ?? "");
  const status = statusSchema.safeParse(String(formData.get("status_tindak_lanjut") ?? ""));
  if (!id || !status.success) return { error: "Status tindak lanjut tidak dikenali." };

  const item = await prisma.disposisi.findUnique({ where: { id }, include: { surat_masuk: true } });
  if (!item) return { error: "Disposisi tidak ditemukan." };
  if (item.surat_masuk.status_surat === "arsip") return { error: PESAAN_TERTUTUP };

  await prisma.disposisi.update({ where: { id }, data: { status_tindak_lanjut: status.data } });

  await sinkronkanStatusSurat(item.surat_id);

  await logAudit(user, "ubah_disposisi", "disposisi", id, `Tindak lanjut ${item.surat_masuk.nomor_agenda} menjadi ${labelTindakLanjut[status.data]}`);
  return { ok: `Status diubah menjadi ${labelTindakLanjut[status.data]}.` };
}

const ubahSchema = schema.extend({
  id: z.string().min(1),
  status_tindak_lanjut: statusSchema,
});

/** Mengoreksi langkah disposisi yang sudah dicatat. Panel yang terbuka tetap terbuka setelah disimpan. */
export async function ubahDisposisi(prev: DisposisiState, formData: FormData): Promise<DisposisiState> {
  const suratId = String(formData.get("surat_id") ?? "");

  const user = await penulis();
  if (!user) return { error: "Akun ini hanya berhak membaca data." };
  if (await suratTertutup(suratId)) return { error: PESAAN_TERTUTUP };

  const parsed = ubahSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((e: { message: string }) => e.message).join(" ") };
  const d = parsed.data;

  let pemberi = d.pemberi_disposisi;
  if (pemberi === lain) {
    if (!d.pemberi_lain) return { error: "Nama pemberi disposisi lainnya wajib diisi." };
    pemberi = d.pemberi_lain;
  }
  let penerima = d.penerima_disposisi;
  if (penerima === lain) {
    if (!d.penerima_lain) return { error: "Nama tujuan diteruskan lainnya wajib diisi." };
    penerima = d.penerima_lain;
  }

  const tanggalDisposisi = new Date(`${d.tanggal_disposisi}T00:00:00Z`);
  const tanggalDiteruskan = d.tanggal_diteruskan ? new Date(`${d.tanggal_diteruskan}T00:00:00Z`) : null;
  if (tanggalDiteruskan && tanggalDiteruskan < tanggalDisposisi) {
    return { error: "Tanggal diteruskan tidak boleh mendahului tanggal disposisi." };
  }

  const item = await prisma.disposisi.findUnique({ where: { id: d.id }, include: { surat_masuk: true } });
  if (!item) return { error: "Disposisi tidak ditemukan." };

  const instruksi = ambilInstruksi(d);
  if ("galat" in instruksi) return { error: instruksi.galat };

  const berubah: string[] = [];
  if (item.pemberi_disposisi !== pemberi) berubah.push(`pemberi menjadi ${pemberi}`);
  if ((item.penerima_disposisi ?? null) !== (penerima || null)) berubah.push(penerima ? `diteruskan ke ${penerima}` : "penerusan dihapus");
  if (item.isi_disposisi !== instruksi.isi) berubah.push(instruksi.isi === TANPA_INSTRUKSI ? "instruksi dikosongkan" : "isi instruksi diubah");
  if ((item.catatan ?? null) !== (d.catatan || null)) berubah.push("catatan diubah");
  if (item.status_tindak_lanjut !== d.status_tindak_lanjut) berubah.push(`tindak lanjut menjadi ${labelTindakLanjut[d.status_tindak_lanjut]}`);

  await prisma.disposisi.update({
    where: { id: d.id },
    data: {
      tanggal_disposisi: tanggalDisposisi,
      pemberi_disposisi: pemberi,
      penerima_disposisi: penerima || null,
      tanggal_diteruskan: tanggalDiteruskan,
      isi_disposisi: instruksi.isi,
      catatan: d.catatan || null,
      status_tindak_lanjut: d.status_tindak_lanjut,
    },
  });
  await sinkronkanStatusSurat(item.surat_id);

  await logAudit(user, "ubah_disposisi", "disposisi", d.id, `Disposisi ${item.surat_masuk.nomor_agenda} dikoreksi: ${berubah.join(", ") || "tanpa perubahan nilai"}`);
  return { ok: "Perubahan disposisi tersimpan." };
}

/** Menghapus satu langkah disposisi. Langkah lain tidak terpengaruh; status surat dihitung ulang. */
export async function hapusDisposisi(form: FormData): Promise<Hasil> {
  const suratId = String(form.get("surat_id") ?? "");

  const user = await penulis();
  if (!user) return galat("Akun ini hanya berhak membaca data.");
  if (await suratTertutup(suratId)) return galat(PESAAN_TERTUTUP);

  const id = String(form.get("id") ?? "");
  const item = await prisma.disposisi.findUnique({ where: { id }, include: { surat_masuk: true } });
  if (!item) return galat("Disposisi tidak ditemukan.");

  await prisma.disposisi.delete({ where: { id } });
  await sinkronkanStatusSurat(item.surat_id);

  await logAudit(user, "hapus_disposisi", "disposisi", id, `Langkah disposisi ${item.surat_masuk.nomor_agenda} dari ${item.pemberi_disposisi} dihapus`);
  return sukses("Langkah disposisi dihapus dari riwayat.");
}

/** Tindak lanjut dari daftar `/disposisi`: tetap di daftar yang sama dengan filter yang sama. */
export async function simpanStatusTindak(form: FormData): Promise<Hasil> {
  const hasil = await ubahStatusDisposisi({}, form);
  return hasil.error ? galat(hasil.error) : sukses(hasil.ok);
}
