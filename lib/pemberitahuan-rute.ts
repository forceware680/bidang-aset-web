/**
 * Pemetauan tabel → halaman, tanpa React: dipakai peramban (components/pemberitahuan.tsx) dan pemeriksa
 * (scripts/sse-check.mts), yang tidak bisa mengimpor modul client dengan hook.
 */
export const RUTE_PER_TABLE: Record<string, string[]> = {
  surat_masuk: ["/surat", "/disposisi", "/dashboard", "/rekap", "/rapat", "/keluar"],
  disposisi: ["/surat", "/disposisi", "/dashboard", "/rekap", "/rapat"],
  lampiran_surat: ["/surat"],
  jadwal_rapat: ["/rapat", "/surat", "/dashboard", "/rekap", "/monitor"],
  peserta_rapat: ["/surat", "/rapat", "/monitor"],
  riwayat_jadwal_rapat: ["/surat", "/rapat"],
  surat_keluar: ["/keluar", "/dashboard", "/rekap", "/monitor"],
  lampiran_keluar: ["/keluar"],
  jenis_surat: ["/surat", "/keluar", "/rekap", "/pengaturan"],
  master_pengirim: ["/surat", "/pengaturan"],
  master_pejabat: ["/surat", "/disposisi", "/pengaturan"],
  master_terusan: ["/surat", "/disposisi", "/pengaturan"],
  master_penerima: ["/keluar", "/pengaturan"],
  master_pegawai: ["/surat", "/pengaturan"],
  users: ["/pengaturan"],
};

/** True bila perubahan tabel ini terlihat di halaman yang sedang dibuka. */
export function perubahanTerkait(tabel: string, pathname: string): boolean {
  const rute = RUTE_PER_TABLE[tabel];
  if (!rute) return false;
  return rute.some((a) => pathname === a || pathname.startsWith(`${a}/`));
}
