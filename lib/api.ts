import { NextResponse } from "next/server";
import { isoHari, isoJakarta } from "./format";
import { labelStatusRapat } from "./status";

/**
 * Bentuk jawaban API untuk aplikasi Android. Semua pesan dalam bahasa petugas: aplikasi Android hanya
 * menampilkan pesan ini apa adanya. Kode HTTP dipakai sebagai status (400 isian salah, 401 belum masuk,
 * 403 bukan pemilik, 404 tidak ditemukan).
 */
export function jawab(status: number, isi: Record<string, unknown>): NextResponse {
  return NextResponse.json({ ok: true, ...isi }, { status, headers: { "Cache-Control": "no-store" } });
}

export function tolak(status: number, pesan: string): NextResponse {
  return NextResponse.json({ ok: false, pesan }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Body JSON; `null` bila bukan JSON atau kosong. */
export async function bacaJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const isi = await req.json();
    return typeof isi === "object" && isi !== null && !Array.isArray(isi)
      ? (isi as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Pesan galat zod dijadikan satu kalimat, sama seperti yang ditampilkan di aplikasi web. */
export function pesanGalat(error: { issues: { message: string }[] }): string {
  return error.issues.map((i) => i.message).join(" ");
}

export const PESAAN_TOKEN = "Token tidak dikenali atau sudah kedaluwarsa. Masuk lagi di aplikasi Android.";

/** Agenda yang hanya boleh diubah pembuatnya lewat Android; agenda dari surat dibaca saja. */
export const PESAAN_DARI_SURAT =
  "Agenda ini berasal dari surat masuk dan hanya bisa diubah dari halaman suratnya di aplikasi.";

export const PESAAN_BUKAN_PEMILIK = "Hanya pembuat agenda ini yang bisa mengubah atau menghapusnya.";

/** Batas jumlah agenda dalam satu jawaban kalender; yang lebih banyak diminta dengan rentang tanggal lebih sempit. */
export const BATAS_KALENDER = 300;

type BarisAgenda = {
  id: string;
  agenda_rapat: string;
  penyelenggara: string | null;
  tempat: string | null;
  catatan: string | null;
  tanggal_mulai: Date;
  tanggal_selesai: Date | null;
  status_rapat: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  surat_masuk: { nomor_agenda: string; perihal: string } | null;
  users: { name: string } | null;
  peserta_rapat: { nama_peserta: string }[];
};

/**
 * Nama peserta dicocokkan longgar: tanda baca dan spasi diseragamkan, lalu satu nama dianggap orang
 * yang sama bila salah satunya memuat nama lainnya (mis. peserta "Chairul Alim S., H." untuk akun
 * "Chairul Alim"). Batas 4 karakter menjaga agar nama pendek tidak mencocokkan orang lain.
 */
export function namaSeragam(teks: string) {
  return teks.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function ikutSebagaiPeserta(namaPeserta: string[], namaAkun: string) {
  const acu = namaSeragam(namaAkun);
  if (!acu) return false;
  return namaPeserta.some((p) => {
    const n = namaSeragam(p);
    if (n === acu) return true;
    if (Math.min(n.length, acu.length) < 4) return false;
    return n.includes(acu) || acu.includes(n);
  });
}

/**
 * Agenda seperti yang dibaca aplikasi Android. `mulai`/`selesai` memakai offset +07:00 supaya alarm di
 * perangkat dijadwalkan pada jam yang sama dengan yang dibaca petugas; nilai UTC ikut dikirim untuk
 * perbandingan dengan `sejak` saat menyinkronkan ulang.
 *
 * `ikut` = pembuatnya atau namanya tercatat sebagai peserta: hanya agenda ini yang boleh muncul dan
 * dibunyikan alarmnya di HP akun itu. `pejabat_lain` adalah kebalikannya — agenda orang lain yang
 * terbaca hanya bila petugas menyalakan "tampilkan agenda pejabat lain" di Akun.
 */
export function bentukAgenda(row: BarisAgenda, userId: string, namaUser: string) {
  const milikSendiri = row.surat_masuk === null && row.created_by === userId;
  const ikut = row.created_by === userId || ikutSebagaiPeserta(row.peserta_rapat.map((p) => p.nama_peserta), namaUser);
  return {
    id: row.id,
    ikut,
    pejabat_lain: !ikut,
    agenda_rapat: row.agenda_rapat,
    tempat: row.tempat,
    penyelenggara: row.penyelenggara,
    catatan: row.catatan,
    mulai: isoJakarta(row.tanggal_mulai),
    mulai_utc: row.tanggal_mulai.toISOString(),
    selesai: row.tanggal_selesai ? isoJakarta(row.tanggal_selesai) : null,
    selesai_utc: row.tanggal_selesai?.toISOString() ?? null,
    status_rapat: row.status_rapat,
    status_label: labelStatusRapat[row.status_rapat] ?? row.status_rapat,
    sumber: row.surat_masuk ? "surat masuk" : "agenda sendiri",
    nomor_surat: row.surat_masuk?.nomor_agenda ?? null,
    perihal: row.surat_masuk?.perihal ?? null,
    dibuat_oleh: row.users?.name ?? null,
    dibuat_pada: row.created_at.toISOString(),
    diubah_pada: row.updated_at.toISOString(),
    // Nama pegawai yang hadir ikut dibaca di HP sebagai daftar, bukan satu teks: nama orang bisa mengandung
    // koma, jadi dipisah dengan koma akan memecah satu nama jadi dua.
    peserta: row.peserta_rapat.map((p) => p.nama_peserta),
    jumlah_peserta: row.peserta_rapat.length,
    dapat_diubah: milikSendiri,
    dapat_dihapus: milikSendiri,
  };
}

export const PILIHAN_AGENDA = {
  select: { nomor_agenda: true, perihal: true } as const,
};

export const PILIHAN_PENULIS = {
  select: { name: true } as const,
};

/** Peserta agenda dibaca urut nama supaya daftar yang panjang tetap konsisten antara satu perangkat dan perangkat lain. */
export const PILIHAN_PESERTA = {
  select: { nama_peserta: true } as const,
  orderBy: { nama_peserta: "asc" } as const,
};

/** Tanggal yang dikembalikan kalender: hari pertama dan hari terakhir rentang yang benar-benar dibaca. */
export function rentangText(batasMulai: Date, batasSelesai: Date) {
  return {
    mulai: isoHari(batasMulai),
    selesai: isoHari(new Date(batasSelesai.getTime() - 1)),
  };
}
