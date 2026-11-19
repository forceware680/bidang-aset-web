import { namaSeragam } from "./api";
import { prisma } from "./db";

/**
 * Catat pemberitahuan peserta: saat seseorang menambahkan peserta ke sebuah agenda, baris disimpan supaya
 * HP peserta bisa menampilkan notifikasi ("<oleh> telah menambahkan kamu sebagai peserta pada agenda X").
 * Nama yang sama dengan pembuat tidak dicatat — orang tidak perlu diberi tahu tentang dirinya sendiri.
 * Pencocokan baris dengan akun aplikasi terjadi di /api/pemberitahuan memakai pencocokan longgar yang sama
 * dengan aturan `ikut` di kalender, jadi "Chairul Alim S., H." tetap sampai di akun "Chairul Alim".
 */
export async function catatNotifikasiPeserta(rapatId: string, namaBaru: string[], olehNama: string): Promise<void> {
  const acu = namaSeragam(olehNama);
  const untuk = namaBaru.filter((n) => namaSeragam(n) !== acu);
  if (untuk.length === 0) return;
  await prisma.pemberitahuan_peserta.createMany({
    data: untuk.map((n) => ({ rapat_id: rapatId, nama_peserta: n, oleh: olehNama })),
  });
}
