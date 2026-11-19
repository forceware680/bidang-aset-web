import { prisma } from "@/lib/db";
import { irisanKomposisiJenis, rekapPerBulan, rekapPerJenis } from "@/lib/rekap";

/**
 * Data untuk monitor yang dipasang di depan ruangan Bidang Aset: angka bulan berjalan dan agenda yang
 * dipublish. Semuanya dibaca dari view aktif — surat arsip tetap dihitung seperti di rekap, agenda yang
 * disembunyikan (`terbit = false`) dan yang sudah selesai tidak tampil, agenda yang dibatalkan tetap tampil
 * dengan tanda "dibatalkan".
 */

const ZONA = "+07:00";

/** Kunci monitor dibaca dari `lib/monitor-token` (kunci aktif di database, .env sebagai kunci awal). */
export { kunciMonitorAktif, kunciMonitorCocok } from "@/lib/monitor-token";

/** Tanggal Asia/Jakarta sebagai yyyy-mm-dd (bukan tanggal server/browser — server bisa berada di UTC). */
function tanggalJakarta(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Batas awal satu hari Asia/Jakarta, `offset` hari boleh negatif atau positif. */
function awalHari(d: Date, offset = 0): Date {
  const teks = tanggalJakarta(new Date(d.getTime() + offset * 86_400_000));
  return new Date(`${teks}T00:00:00${ZONA}`);
}

/** Batas awal bulan berjalan Asia/Jakarta. */
function awalBulan(d: Date, offset = 0): Date {
  const teks = tanggalJakarta(d);
  const tahun = Number(teks.slice(0, 4));
  const bulan = Number(teks.slice(5, 7)) + offset;
  const y = bulan > 12 ? tahun + 1 : bulan < 1 ? tahun - 1 : tahun;
  const m = ((bulan - 1) % 12 + 12) % 12 + 1;
  return new Date(`${y}-${String(m).padStart(2, "0")}-01T00:00:00${ZONA}`);
}

export type AgendaMonitor = {
  id: string;
  agenda_rapat: string;
  tanggal_mulai: Date;
  tanggal_selesai: Date | null;
  tempat: string | null;
  penyelenggara: string | null;
  pemberi_disposisi: string | null;
  nomor_agenda: string | null;
  peserta: string | null;
  status_rapat: string;
};

async function agendaAntara(mulai: Date, akhir: Date): Promise<AgendaMonitor[]> {
  return prisma.$queryRaw<AgendaMonitor[]>`
    SELECT r.id, r.agenda_rapat, r.tanggal_mulai, r.tanggal_selesai, r.tempat, r.penyelenggara,
           r.pemberi_disposisi, r.nomor_agenda, r.status_rapat,
           (SELECT string_agg(p.nama_peserta, ', ' ORDER BY p.nama_peserta)
            FROM peserta_rapat p WHERE p.rapat_id = r.id) AS peserta
    FROM v_agenda_monitor r
    WHERE r.tanggal_mulai >= ${mulai} AND r.tanggal_mulai < ${akhir}
    ORDER BY r.tanggal_mulai`;
}

export type AgendaMonitorHari = { tanggal: string; agenda: AgendaMonitor[] };

export async function agendaMonitor(now = new Date()) {
  const hariIni = await agendaAntara(awalHari(now), awalHari(now, 1));
  const besok = await agendaAntara(awalHari(now, 1), awalHari(now, 2));
  // Semua agenda yang masih akan datang setelah besok, termasuk yang jauh hari (satu tahun ke depan) —
  // monitor bukan hanya minggu yang sedang berjalan.
  const mendatang = await agendaAntara(awalHari(now, 2), awalHari(now, 366));
  const perTanggal: AgendaMonitorHari[] = [];
  for (const a of mendatang) {
    const kunci = tanggalJakarta(a.tanggal_mulai);
    const terakhir = perTanggal[perTanggal.length - 1];
    if (terakhir && terakhir.tanggal === kunci) terakhir.agenda.push(a);
    else perTanggal.push({ tanggal: kunci, agenda: [a] });
  }
  return { hariIni, besok, mendatang: perTanggal };
}

export type GrafikMonitor = {
  tahun: number;
  masuk: { label: string; surat: number }[];
  keluar: { label: string; keluar: number }[];
  rapat: { label: string; total: number }[];
  jenis: { nama: string; jumlah: number; warna: string }[];
  totalJenis: number;
};

/**
 * Grafik tahun berjalan untuk layar monitor. Sama dengan yang dihitung Rekap (satu tahun penuh, bukan hanya
 * bulan berjalan) supaya orang yang lewat melihat bentuk setahun, bukan angka satu bulan saja.
 */
export async function grafikMonitor(now = new Date()): Promise<GrafikMonitor> {
  const tahun = Number(tanggalJakarta(now).slice(0, 4));
  const perBulan = await rekapPerBulan(new Date(`${tahun}-01-01T00:00:00Z`), new Date(`${tahun}-12-31T23:59:59Z`));
  const perJenis = await rekapPerJenis(new Date(`${tahun}-01-01T00:00:00Z`), new Date(`${tahun}-12-31T23:59:59Z`));
  // Dua belas bulan selalu ditampilkan, termasuk yang kosong: grafik tahun harus berbentuk tahun, bukan
  // satu batang besar kalau baru satu bulan yang punya surat. Nama bulan ditulis pendek (Jan, Feb, dst.)
  // supaya dua belas label muat di sumbu layar monitor.
  const perIndeks = new Map(perBulan.map((b) => [b.bulan.slice(5), b]));
  const bulanNama = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const padaBulan = (i: number) => perIndeks.get(String(i + 1).padStart(2, "0"));

  // Rapat per bulan dihitung sebagai satu total: semua agenda rapat yang dijadwalkan pada bulan itu,
  // termasuk yang dibatalkan dan yang sudah selesai. dibaca langsung dari jadwal_rapat (view rapat
  // mengucilkan yang dibatalkan).
  const rapatBulan = await prisma.$queryRaw<{ bulan: string; jumlah: bigint }[]>`
    SELECT to_char(tanggal_mulai AT TIME ZONE 'Asia/Jakarta', 'MM') AS bulan, count(*) AS jumlah
    FROM jadwal_rapat
    WHERE tanggal_mulai >= ${new Date(`${tahun}-01-01T00:00:00${ZONA}`)}
      AND tanggal_mulai < ${new Date(`${tahun + 1}-01-01T00:00:00${ZONA}`)}
    GROUP BY 1`;
  const rapatPada = new Map(rapatBulan.map((r) => [r.bulan, Number(r.jumlah)]));

  return {
    tahun,
    masuk: bulanNama.map((label, i) => ({ label, surat: padaBulan(i)?.surat ?? 0 })),
    keluar: bulanNama.map((label, i) => ({ label, keluar: padaBulan(i)?.keluar ?? 0 })),
    rapat: bulanNama.map((label, i) => ({ label, total: rapatPada.get(String(i + 1).padStart(2, "0")) ?? 0 })),
    jenis: irisanKomposisiJenis(perJenis),
    totalJenis: perJenis.reduce((a, r) => a + r.surat, 0),
  };
}

export type StatistikMonitor = {
  masuk: number;
  keluar: number;
  keluarBelumDikirim: number;
  belumDidisposisikan: number;
  disposisiBelumSelesai: number;
  agendaHariIni: number;
  rapatBulanIni: number;
};

export async function statistikMonitor(now = new Date()): Promise<StatistikMonitor> {
  // Alias harus huruf kecil: PostgreSQL menurunkan nama alias, jadi key yang datang dari query raw
  // tidak sama dengan nama properti di tipe ini.
  const baris = await prisma.$queryRaw<Record<string, number>[]>`
    SELECT
      (SELECT count(*)::int FROM v_surat_aktif WHERE tanggal_terima >= ${awalBulan(now)} AND tanggal_terima < ${awalBulan(now, 1)}) AS masuk,
      (SELECT count(*)::int FROM v_surat_keluar_aktif WHERE tanggal_surat >= ${awalBulan(now)} AND tanggal_surat < ${awalBulan(now, 1)}) AS keluar,
      (SELECT count(*)::int FROM v_surat_keluar_aktif WHERE status_surat = 'draf' AND tanggal_surat >= ${awalBulan(now)} AND tanggal_surat < ${awalBulan(now, 1)}) AS keluarbelumdikirim,
      (SELECT count(*)::int FROM v_surat_aktif WHERE status_surat = 'belum_disposisi' AND tanggal_terima >= ${awalBulan(now)} AND tanggal_terima < ${awalBulan(now, 1)}) AS belumdidisposisikan,
      (SELECT count(*)::int FROM v_disposisi_aktif WHERE status_tindak_lanjut NOT IN ('selesai', 'tidak_perlu') AND tanggal_disposisi >= ${awalBulan(now)} AND tanggal_disposisi < ${awalBulan(now, 1)}) AS disposisibelumselesai,
      (SELECT count(*)::int FROM v_agenda_monitor WHERE tanggal_mulai >= ${awalHari(now)} AND tanggal_mulai < ${awalHari(now, 1)}) AS agendaharin,
      (SELECT count(*)::int FROM jadwal_rapat WHERE tanggal_mulai >= ${awalBulan(now)} AND tanggal_mulai < ${awalBulan(now, 1)}) AS rapatbulanini`;
  const b = baris[0] ?? {};
  return {
    masuk: Number(b.masuk ?? 0),
    keluar: Number(b.keluar ?? 0),
    keluarBelumDikirim: Number(b.keluarbelumdikirim ?? 0),
    belumDidisposisikan: Number(b.belumdidisposisikan ?? 0),
    disposisiBelumSelesai: Number(b.disposisibelumselesai ?? 0),
    agendaHariIni: Number(b.agendaharin ?? 0),
    rapatBulanIni: Number(b.rapatbulanini ?? 0),
  };
}
