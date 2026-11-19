export const labelUndangan: Record<string, string> = {
  belum: "Belum ditentukan",
  ya: "Ada agenda",
  tidak: "Tidak ada agenda",
};

export const labelStatusSurat: Record<string, string> = {
  belum_disposisi: "Belum didisposisikan",
  didisposisikan: "Sudah didisposisikan",
  selesai: "Selesai",
  arsip: "Arsip",
};

/** Surat keluar bergerak maju: draf -> dikirim -> selesai, arsip adalah keputusan petugas. */
export const labelStatusSuratKeluar: Record<string, string> = {
  draf: "Draf",
  dikirim: "Dikirim",
  selesai: "Selesai",
  arsip: "Arsip",
};

export const labelTindakLanjut: Record<string, string> = {
  belum: "Belum ada",
  proses: "Diproses",
  selesai: "Selesai",
  tidak_perlu: "Tidak perlu",
};

/**
 * Nilai isi_disposisi yang berarti langkah disposisi tidak diberi instruksi. Kolomnya NOT NULL, jadi
 * pilihan "Tanpa Instruksi" disimpan sebagai strip ini. Data lama yang isinya kosong diperlakukan sama.
 */
export const TANPA_INSTRUKSI = "-";

export function tanpaInstruksi(isi: string): boolean {
  const bersih = isi.trim();
  return bersih === "" || bersih === TANPA_INSTRUKSI;
}

/** Teks untuk tabel dan riwayat disposisi: langkah tanpa instruksi tampil sebagai "-". */
export function teksInstruksi(isi: string): string {
  return tanpaInstruksi(isi) ? TANPA_INSTRUKSI : isi;
}

export const labelStatusRapat: Record<string, string> = {
  terjadwal: "Terjadwal",
  berlangsung: "Berlangsung",
  selesai: "Sudah dilaksanakan",
  dibatalkan: "Dibatalkan",
  dijadwalkan_ulang: "Dijadwalkan ulang",
};

/** Awal hari Asia/Jakarta (`offset` hari boleh positif/negatif). */
function awalHariJakarta(d: Date, offset = 0): Date {
  const teks = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d.getTime() + offset * 86_400_000));
  return new Date(`${teks}T00:00:00+07:00`);
}

/**
 * Pilihan status yang bisa dipilih pengguna. "Sudah dilaksanakan" (selesai) boleh dipilih manual sekaligus
 * diberikan otomatis menurut waktu (`lib/rapat-waktu.ts`); hanya "berlangsung" yang tidak dipilih manual:
 * - waktunya belum tiba -> terjadwal, sudah dilaksanakan, dijadwalkan ulang, dibatalkan
 * - waktunya sudah tiba atau sudah lewat -> sudah dilaksanakan, dijadwalkan ulang, dibatalkan
 * Status yang sedang tercatat ikut ditambahkan supaya isian tetap menampilkan status yang ada.
 */
export function opsiStatusRapat(a: { tanggal_mulai: Date; tanggal_selesai: Date | null }, statusSekarang?: string, now = new Date()): string[] {
  const dasar = a.tanggal_mulai > now
    ? ["terjadwal", "selesai", "dijadwalkan_ulang", "dibatalkan"]
    : ["selesai", "dijadwalkan_ulang", "dibatalkan"];
  return statusSekarang && !dasar.includes(statusSekarang) ? [...dasar, statusSekarang] : dasar;
}

/** Status yang berubah sendiri menurut waktu dan tidak dipilih pengguna. */
export const statusRapatOtomatis = ["berlangsung"] as const;

/** Pesan galat untuk status otomatis: menjelaskan bahwa status itu berubah sendiri menurut waktu. */
export function pesanStatusOtomatis(kode: string): string {
  return `"${labelStatusRapat[kode]}" berubah sendiri menurut waktu agenda — pilih terjadwal, sudah dilaksanakan, dijadwalkan ulang, atau dibatalkan.`;
}

// Warna label mengikuti makna status: selesai tenang, menunggu perhatian, batal diperingati.
// Nilai ini dipakai sebagai variant Badge di components/ui/badge.tsx.
export const toneStatus: Record<string, string> = {
  belum: "warning",
  belum_disposisi: "warning",
  draf: "warning",
  dikirim: "info",
  proses: "info",
  terjadwal: "info",
  berlangsung: "info",
  dijadwalkan_ulang: "warning",
  dibatalkan: "destructive",
  tidak_perlu: "secondary",
  selesai: "success",
  didisposisikan: "success",
  arsip: "secondary",
  ya: "success",
  tidak: "secondary",
};

export function tone(code: string): string {
  return toneStatus[code] ?? "secondary";
}

// Tint untuk kontrol status (Select). Di mode terang pil status jadi tile lembut seperti tile periode:
// latar `bg-muted` dengan garis `--input` — garis tint warna (info-line, warning-line) nyaris tak terlihat
// di kartu putih, dan tanpa garis pil tidak menyambung dengan tombol ikon di ButtonGroup. Warna teks tetap
// mengikuti status (kontras >=4,5:1 di `bg-muted`). Di mode gelap tint warna penuh dipertahankan.
const tintStatus: Record<string, string> = {
  info: "border-info-line bg-info-bg text-info terang:border-input terang:bg-muted",
  warning: "border-warning-line bg-warning-bg text-warning terang:border-input terang:bg-muted",
  success: "border-success-line bg-success-bg text-success terang:border-input terang:bg-muted",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive terang:border-input terang:bg-muted",
  secondary: "border-border bg-secondary text-secondary-foreground terang:border-input terang:bg-muted",
};

export function tint(code: string): string {
  return tintStatus[tone(code)] ?? tintStatus.secondary;
}
