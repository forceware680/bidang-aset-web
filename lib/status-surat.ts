import { prisma } from "@/lib/db";

/** Surat yang sudah diarsipkan adalah tertutup: isinya tidak diubah sampai dikeluarkan dari arsip. */
export const PESAAN_TERTUTUP = "Surat ini sudah diarsipkan. Keluarkan dari arsip dulu sebelum mengubah isinya.";

/** Surat keluar yang diarsipkan tertutup dengan aturan yang sama. */
export const PESAAN_TERTUTUP_KELUAR =
  "Surat keluar ini sudah diarsipkan. Keluarkan dari arsip dulu sebelum mengubah isinya.";

/** Kondisi surat yang ditentukan oleh langkah disposisi dan agenda rapat yang masih aktif. */
export async function kondisiSurat(suratId: string) {
  const belum = await prisma.disposisi.count({
    where: { surat_id: suratId, status_tindak_lanjut: { in: ["belum", "proses"] } },
  });
  const jumlahLangkah = await prisma.disposisi.count({ where: { surat_id: suratId } });
  const rapatAktif = await prisma.jadwal_rapat.count({ where: { surat_id: suratId, status_rapat: { not: "dibatalkan" } } });
  const status = jumlahLangkah === 0 ? "belum_disposisi" : belum === 0 ? "selesai" : "didisposisikan";
  return { belum, jumlahLangkah, rapatAktif, status };
}

/**
 * Status surat diturunkan dari langkah disposisi yang tersisa, bukan diasumsikan. Surat berstatus arsip
 * tidak ikut disinkronkan — arsip adalah keputusan petugas, bukan hasil hitungan langkah.
 */
export async function sinkronkanStatusSurat(suratId: string): Promise<void> {
  const surat = await prisma.surat_masuk.findFirst({ where: { id: suratId, deleted_at: null } });
  if (!surat || surat.status_surat === "arsip") return;
  const { status } = await kondisiSurat(suratId);
  if (surat.status_surat !== status) {
    await prisma.surat_masuk.update({ where: { id: suratId }, data: { status_surat: status } });
  }
}

export async function suratTertutup(suratId: string): Promise<boolean> {
  const surat = await prisma.surat_masuk.findFirst({ where: { id: suratId, deleted_at: null }, select: { status_surat: true } });
  return surat?.status_surat === "arsip";
}

/** Surat keluar berstatus arsip tidak boleh diubah isinya sampai dikeluarkan dari arsip. */
export async function suratKeluarTertutup(suratId: string): Promise<boolean> {
  const surat = await prisma.surat_keluar.findFirst({ where: { id: suratId, deleted_at: null }, select: { status_surat: true } });
  return surat?.status_surat === "arsip";
}

/** Agenda yang berasal dari surat masuk ikut tertutup saat suratnya diarsipkan. Agenda mandiri tidak. */
export async function agendaTertutup(rapat: { surat_id: string | null }): Promise<boolean> {
  return rapat.surat_id === null ? false : suratTertutup(rapat.surat_id);
}
