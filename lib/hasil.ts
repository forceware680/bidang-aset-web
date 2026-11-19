/**
 * Hasil aksi. Aksi perubahan kecil mengembalikan ini dan tidak `redirect()`: UI diperbarui lewat
 * `router.refresh()` setelah sukses, dan pesannya lewat toast. Aksi yang memang berpindah halaman
 * (buat surat baru, hapus surat permanen, masuk/keluar) tetap `redirect()`.
 */
export type Hasil = { ok: true; pesan?: string } | { ok: false; pesan: string };

export const sukses = (pesan?: string): Hasil => ({ ok: true, pesan });
export const galat = (pesan: string): Hasil => ({ ok: false, pesan });
