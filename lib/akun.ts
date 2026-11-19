import { prisma } from "@/lib/db";

/**
 * Peserta agenda hanya orang yang bisa masuk aplikasi Android: namanya harus tertaut akun aktif.
 * Daftar ini yang dipakai autocomplete "Tambah peserta" dan validasi di server action / API.
 */
export async function daftarAkunPeserta(): Promise<string[]> {
  const akun = await prisma.users.findMany({ where: { is_active: true }, select: { name: true }, orderBy: { name: "asc" } });
  return akun.map((a) => a.name);
}

/** Tanda baca dan spasi diseragamkan supaya "Chairul Alim S, H" sama dengan akun "Chairul Alim, S. H". */
export function namaSeragam(teks: string) {
  return teks.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Nama peserta yang belum tertaut akun aplikasi aktif — pesan galat menyebut jumlahnya. */
export async function namaTanpaAkun(nama: string[]): Promise<string[]> {
  if (nama.length === 0) return [];
  const akun = await prisma.users.findMany({ where: { is_active: true }, select: { name: true } });
  const set = new Set(akun.map((a) => namaSeragam(a.name)));
  return nama.filter((n) => !set.has(namaSeragam(n)));
}

/** Pesan penolakan peserta tanpa akun, dipakai action web dan API Android. */
export function pesanPesertaTanpaAkun(yangTanpaAkun: string[]) {
  return `${yangTanpaAkun.length === 1 ? `Nama ${yangTanpaAkun[0]}` : `${yangTanpaAkun.length} nama`} belum punya akun aplikasi. Buat akun dulu di Pengaturan › Pengguna supaya agenda ini muncul di HP orang itu.`;
}
