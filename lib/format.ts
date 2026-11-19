const tanggalLong = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const tanggalJam = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const jam = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
});

export function tanggal(value: Date | string | null): string {
  if (!value) return "-";
  return tanggalLong.format(new Date(value));
}

export function tanggalJamText(value: Date | string | null): string {
  if (!value) return "-";
  return tanggalJam.format(new Date(value));
}

export function jamText(value: Date | string | null): string {
  if (!value) return "-";
  return jam.format(new Date(value));
}

const hariISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Nilai untuk `<input type="date">`: tanggal Asia/Jakarta dalam yyyy-mm-dd. */
export function isoHari(value: Date | string | null): string {
  if (!value) return "";
  return hariISO.format(new Date(value));
}

const jamISO = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Nilai untuk `<input type="datetime-local">`: tanggal dan jam Asia/Jakarta dalam yyyy-mm-ddTHH:mm. */
export function isoWaktu(value: Date | string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return `${hariISO.format(d)}T${jamISO.format(d)}`;
}

/**
 * Nilai untuk aplikasi Android: tanggal dan jam Asia/Jakarta sebagai ISO ber-offset tetap (+07:00).
 * Alarm di perangkat disusun dari nilai ini supaya jam pengingat sama dengan jam yang dibaca petugas.
 */
export function isoJakarta(value: Date | string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return `${hariISO.format(d)}T${jamISO.format(d)}:00+07:00`;
}

/**
 * Nilai untuk `<input type="datetime-local">`: tanggal dan jam Asia/Jakarta tanpa offset, karena
 * isian itu tidak menerima offset. Jamnya sama dengan yang dibaca server (`waktuJakarta`).
 */
export function datetimeLokalJakarta(value: Date | string | null): string {
  return isoJakarta(value).replace(/:00\+07:00$/, "");
}

export function bulanTahun(value: Date | string): string {
  const d = new Date(value);
  return tanggalLong.format(d).replace(/^\d+\s/, "");
}

export function ukuranFile(byte: number | bigint): string {
  const n = Number(byte);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export const BATAS_LAMPIRAN = 20 * 1024 * 1024;

/**
 * Jenis berkas seperti yang dibaca petugas, bukan kode MIME: `application/pdf` jadi "PDF".
 * Daftar yang diterima hanya PDF/JPG/PNG (lib/uploads), sisanya jarang dan disebut "dokumen".
 */
export function jenisBerkas(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime === "image/jpeg") return "JPG";
  if (mime === "image/png") return "PNG";
  return "dokumen";
}

/**
 * Lebar minimum select native. Popup bawaan browser selebar elemen select, jadi opsi terpanjang
 * harus muat di dalamnya. Ditulis dalam ch supaya ikut ukuran font, bukan px tetap.
 */
export function lebarOpsiMin(label: string[], kelonggaran = 8): string {
  const paling = Math.max(...label.map((l) => l.length), 8);
  // Ditahan sampai 100% supaya isian tidak keluar dari panelnya di layar sempit
  // (nama pejabat panjang pernah menembus tepi kartu di 375px).
  return `min(${paling + kelonggaran}ch, 100%)`;
}

const bulanNama = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  month: "long",
  year: "numeric",
});

export function namaBulan(kode: string): string {
  return bulanNama.format(new Date(`${kode}-01T00:00:00Z`));
}

/// Kode audit di database memakai nama teknis; tabel jejak dibaca oleh pejabat dan pimpinan,
/// jadi diterjemahkan ke bahasa biasa. Nilai yang belum dipetakan ditampilkan apa adanya
/// (garis bawah diganti spasi) supaya catatan lama tetap terbaca.
const AKSI_AUDIT: Record<string, string> = {
  login: "masuk",
  logout: "keluar",
  login_gagal: "login gagal",
  create: "penambahan",
  update: "perubahan",
  delete: "penghapusan",
  buat_surat: "surat masuk dicatat",
  ubah_surat: "identitas surat dikoreksi",
  ubah_undangan: "status undangan diubah",
  arsip_surat: "surat diarsipkan",
  pulih_surat: "surat dikeluarkan dari arsip",
  hapus_surat: "surat dihapus permanen",
  buat_surat_keluar: "surat keluar dicatat",
  ubah_surat_keluar: "surat keluar dikoreksi",
  ubah_status_keluar: "status surat keluar diubah",
  arsip_keluar: "surat keluar diarsipkan",
  pulih_keluar: "surat keluar dikeluarkan dari arsip",
  hapus_surat_keluar: "surat keluar dihapus permanen",
  buat_disposisi: "disposisi dicatat",
  ubah_disposisi: "disposisi diubah",
  hapus_disposisi: "langkah disposisi dihapus",
  ubah_rapat: "status rapat diubah",
  ubah_terbit_rapat: "agenda ditampilkan atau disembunyikan di layar monitor",
  geser_rapat: "jadwal rapat diubah",
  buat_agenda: "agenda tanpa surat dibuat",
  ubah_agenda: "agenda tanpa surat diubah",
  catat_agenda: "agenda rapat dicatat dari surat",
  hapus_agenda: "agenda dihapus",
  cabut_token: "token perangkat dicabut",
};

const ENTITAS_AUDIT: Record<string, string> = {
  users: "akun pengguna",
  surat_masuk: "surat masuk",
  disposisi: "disposisi",
  jadwal_rapat: "jadwal rapat",
  peserta_rapat: "peserta rapat",
  lampiran_surat: "lampiran",
  lampiran_keluar: "lampiran surat keluar",
  jenis_surat: "kategori surat",
  surat_keluar: "surat keluar",
  master_pengirim: "pengirim surat",
  master_penerima: "tujuan surat keluar",
  master_pejabat: "pemberi disposisi",
  master_pegawai: "pegawai bidang aset",
  master_terusan: "tujuan diteruskan",
  api_token: "token perangkat",
};

export function labelAksiAudit(kode: string): string {
  return AKSI_AUDIT[kode] ?? kode.replace(/_/g, " ");
}

export function labelEntitasAudit(kode: string): string {
  return ENTITAS_AUDIT[kode] ?? kode.replace(/_/g, " ");
}
