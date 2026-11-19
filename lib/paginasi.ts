/**
 * Daftar halaman paginasi pola shadcn: halaman pertama & terakhir selalu tampil, jendela dua
 * halaman sekitar halaman aktif ikut tampil, sisanya diringkas jadi elipsis ("...").
 * Daftar panjang jadi sebaris ramping, bukan deret semua angka. Dipakai oleh surat masuk,
 * surat keluar, disposisi, jejak perubahan, dan daftar pengaturan.
 */
export function daftarPaginasi(halaman: number, terakhir: number): (number | "...")[] {
  if (terakhir <= 7) return Array.from({ length: terakhir }, (_, i) => i + 1);
  const awal = Math.max(1, halaman - 2);
  const akhir = Math.min(terakhir, halaman + 2);
  const hasil: (number | "...")[] = [];
  if (awal > 1) {
    hasil.push(1);
    if (awal > 2) hasil.push("...");
  }
  for (let n = awal; n <= akhir; n++) hasil.push(n);
  if (akhir < terakhir) {
    if (akhir < terakhir - 1) hasil.push("...");
    hasil.push(terakhir);
  }
  return hasil;
}
