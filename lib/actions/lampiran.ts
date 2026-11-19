"use server";

import { prisma } from "@/lib/db";
import { bolehMengubah, requireUser } from "@/lib/auth";
import { hapusLampiranDisk, simpanLampiran } from "@/lib/uploads";
import { galat, sukses, type Hasil } from "@/lib/hasil";
import { PESAAN_TERTUTUP, suratTertutup, PESAAN_TERTUTUP_KELUAR, suratKeluarTertutup } from "@/lib/status-surat";

async function penulisAtauGagal(suratId: string): Promise<Hasil | { id: string }> {
  const user = await requireUser();
  if (!bolehMengubah(user.role)) return galat("Peran kamu tidak bisa mengubah lampiran.");
  if (await suratTertutup(suratId)) return galat(PESAAN_TERTUTUP);
  return user;
}

/** Unggah lampiran. Berkasnya ditulis ke folder uploads sebelum barisnya dibuat. */
export async function unggahLampiran(formData: FormData): Promise<Hasil> {
  const suratId = String(formData.get("surat_id") ?? "");
  const pengubah = await penulisAtauGagal(suratId);
  if ("ok" in pengubah) return pengubah;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return galat("Pilih berkas dulu sebelum menyimpan.");

  try {
    const { namaAsli, namaBerkas } = await simpanLampiran(file);
    const lampiran = await prisma.lampiran_surat.create({
      data: {
        surat_id: suratId,
        nama_asli: namaAsli,
        path_file: namaBerkas,
        mime_type: file.type,
        ukuran_byte: BigInt(file.size),
        uploaded_by: pengubah.id,
      },
    });
    await prisma.audit_logs.create({
      data: {
        user_id: pengubah.id,
        action: "create",
        entity_type: "lampiran_surat",
        entity_id: lampiran.id,
        description: `lampiran ${namaAsli} diunggah`,
      },
    });
  } catch (e) {
    return galat(e instanceof Error ? e.message : "Lampiran gagal disimpan.");
  }

  return sukses("Lampiran tersimpan.");
}

/** Hapus lampiran: barisnya dan berkasnya di folder uploads ikut hilang. */
export async function hapusLampiran(formData: FormData): Promise<Hasil> {
  const lampiranId = String(formData.get("lampiran_id") ?? "");
  const suratId = String(formData.get("surat_id") ?? "");
  const pengubah = await penulisAtauGagal(suratId);
  if ("ok" in pengubah) return pengubah;

  const lampiran = await prisma.lampiran_surat.findUnique({ where: { id: lampiranId } });
  if (!lampiran) return galat("Lampiran tidak ditemukan.");

  await prisma.lampiran_surat.delete({ where: { id: lampiranId } });
  await hapusLampiranDisk(lampiran.path_file);
  await prisma.audit_logs.create({
    data: {
      user_id: pengubah.id,
      action: "delete",
      entity_type: "lampiran_surat",
      entity_id: lampiranId,
      description: `lampiran ${lampiran.nama_asli} dihapus`,
    },
  });

  return sukses("Lampiran dihapus dari daftar surat, berkasnya ikut terhapus.");
}

/** Lampiran surat keluar: berkas ditulis ke folder uploads yang sama, barisnya di lampiran_keluar. */
export async function unggahLampiranKeluar(formData: FormData): Promise<Hasil> {
  const suratId = String(formData.get("surat_id") ?? "");
  const user = await requireUser();
  if (!bolehMengubah(user.role)) return galat("Peran kamu tidak bisa mengubah lampiran.");
  if (await suratKeluarTertutup(suratId)) return galat(PESAAN_TERTUTUP_KELUAR);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return galat("Pilih berkas dulu sebelum menyimpan.");

  try {
    const { namaAsli, namaBerkas } = await simpanLampiran(file);
    const lampiran = await prisma.lampiran_keluar.create({
      data: {
        surat_id: suratId,
        nama_asli: namaAsli,
        path_file: namaBerkas,
        mime_type: file.type,
        ukuran_byte: BigInt(file.size),
        uploaded_by: user.id,
      },
    });
    await prisma.audit_logs.create({
      data: {
        user_id: user.id,
        action: "create",
        entity_type: "lampiran_keluar",
        entity_id: lampiran.id,
        description: `lampiran surat keluar ${namaAsli} diunggah`,
      },
    });
  } catch (e) {
    return galat(e instanceof Error ? e.message : "Lampiran gagal disimpan.");
  }

  return sukses("Lampiran tersimpan.");
}

export async function hapusLampiranKeluar(formData: FormData): Promise<Hasil> {
  const lampiranId = String(formData.get("lampiran_id") ?? "");
  const suratId = String(formData.get("surat_id") ?? "");
  const user = await requireUser();
  if (!bolehMengubah(user.role)) return galat("Peran kamu tidak bisa mengubah lampiran.");
  if (await suratKeluarTertutup(suratId)) return galat(PESAAN_TERTUTUP_KELUAR);

  const lampiran = await prisma.lampiran_keluar.findUnique({ where: { id: lampiranId } });
  if (!lampiran) return galat("Lampiran tidak ditemukan.");

  await prisma.lampiran_keluar.delete({ where: { id: lampiranId } });
  await hapusLampiranDisk(lampiran.path_file);
  await prisma.audit_logs.create({
    data: {
      user_id: user.id,
      action: "delete",
      entity_type: "lampiran_keluar",
      entity_id: lampiranId,
      description: `lampiran surat keluar ${lampiran.nama_asli} dihapus`,
    },
  });

  return sukses("Lampiran dihapus dari daftar surat, berkasnya ikut terhapus.");
}
