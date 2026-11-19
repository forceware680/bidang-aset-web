import { prisma } from "@/lib/db";

export type BarisBulan = {
  bulan: string;
  surat: number;
  keluar: number;
  keluarDikirim: number;
  undangan: number;
  nonrapat: number;
  belumDidisposisikan: number;
  disposisiTotal: number;
  disposisiSelesai: number;
  rapatDijadwalkan: number;
  rapatDilaksanakan: number;
  rapatDibatalkan: number;
};

export type BarisJenis = { jenis: string; surat: number };

const angka = (v: unknown) => Number(v ?? 0);

/** Daftar tahun yang punya surat masuk atau surat keluar, dipakai untuk pilihan filter periode. */
export async function tahunSurat(): Promise<number[]> {
  const rows = await prisma.$queryRaw<{ tahun: number }[]>`
    SELECT DISTINCT EXTRACT(year FROM tanggal_terima)::int AS tahun
    FROM v_surat_aktif
    UNION
    SELECT DISTINCT EXTRACT(year FROM tanggal_surat)::int AS tahun
    FROM v_surat_keluar_aktif
    ORDER BY tahun DESC`;
  return rows.map((r) => r.tahun);
}

/** Rekap gabungan surat, disposisi, dan rapat per bulan pada rentang tanggal terima surat. */
export async function rekapPerBulan(mulai: Date, akhir: Date): Promise<BarisBulan[]> {
  const surat = await prisma.$queryRaw<{ bulan: string; surat: bigint; undangan: bigint; nonrapat: bigint; belum: bigint }[]>`
    SELECT
      to_char(date_trunc('month', tanggal_terima), 'YYYY-MM') AS bulan,
      count(*) AS surat,
      count(*) FILTER (WHERE status_undangan_rapat = 'ya') AS undangan,
      count(*) FILTER (WHERE status_undangan_rapat = 'tidak') AS nonrapat,
      count(*) FILTER (WHERE status_surat = 'belum_disposisi') AS belum
    FROM v_surat_aktif
    WHERE tanggal_terima >= ${mulai}::date AND tanggal_terima <= ${akhir}::date
    GROUP BY 1
    ORDER BY 1`;

  const keluar = await prisma.$queryRaw<{ bulan: string; keluar: bigint; dikirim: bigint }[]>`
    SELECT
      to_char(date_trunc('month', tanggal_surat), 'YYYY-MM') AS bulan,
      count(*) AS keluar,
      count(*) FILTER (WHERE status_surat <> 'draf') AS dikirim
    FROM v_surat_keluar_aktif
    WHERE tanggal_surat >= ${mulai}::date AND tanggal_surat <= ${akhir}::date
    GROUP BY 1`;

  const disposisi = await prisma.$queryRaw<{ bulan: string; total: bigint; selesai: bigint }[]>`
    SELECT
      to_char(date_trunc('month', s.tanggal_terima), 'YYYY-MM') AS bulan,
      count(*) AS total,
      count(*) FILTER (WHERE d.status_tindak_lanjut = 'selesai') AS selesai
    FROM disposisi d
    JOIN surat_masuk s ON s.id = d.surat_id AND s.deleted_at IS NULL
    WHERE s.tanggal_terima >= ${mulai}::date AND s.tanggal_terima <= ${akhir}::date
    GROUP BY 1`;

  const rapat = await prisma.$queryRaw<{ bulan: string; total: bigint; dilaksanakan: bigint; batal: bigint }[]>`
    SELECT
      to_char(date_trunc('month', tanggal_mulai), 'YYYY-MM') AS bulan,
      count(*) AS total,
      count(*) FILTER (WHERE status_rapat = 'selesai') AS dilaksanakan,
      count(*) FILTER (WHERE status_rapat = 'dibatalkan') AS batal
    FROM v_rapat_aktif
    WHERE tanggal_mulai >= ${mulai}::date AND tanggal_mulai <= ${akhir}::date
    GROUP BY 1`;

  const perBulan = new Map<string, BarisBulan>();
  for (const r of surat) {
    perBulan.set(r.bulan, {
      bulan: r.bulan,
      surat: angka(r.surat),
      keluar: 0,
      keluarDikirim: 0,
      undangan: angka(r.undangan),
      nonrapat: angka(r.nonrapat),
      belumDidisposisikan: angka(r.belum),
      disposisiTotal: 0,
      disposisiSelesai: 0,
      rapatDijadwalkan: 0,
      rapatDilaksanakan: 0,
      rapatDibatalkan: 0,
    });
  }
  // Surat keluar dihitung dari tanggal suratnya sendiri, jadi bulan tanpa surat masuk tetap bisa muncul.
  for (const r of keluar) {
    const b = perBulan.get(r.bulan) ?? barisKosong(r.bulan);
    b.keluar += angka(r.keluar);
    b.keluarDikirim += angka(r.dikirim);
    perBulan.set(r.bulan, b);
  }
  for (const r of disposisi) {
    const b = perBulan.get(r.bulan) ?? barisKosong(r.bulan);
    b.disposisiTotal = angka(r.total);
    b.disposisiSelesai = angka(r.selesai);
    perBulan.set(r.bulan, b);
  }
  // Rapat dihitung dari tanggal pelaksanaan, jadi bulan tanpa surat tetap muncul.
  for (const r of rapat) {
    const b = perBulan.get(r.bulan) ?? barisKosong(r.bulan);
    b.rapatDijadwalkan += angka(r.total);
    b.rapatDilaksanakan += angka(r.dilaksanakan);
    b.rapatDibatalkan += angka(r.batal);
    perBulan.set(r.bulan, b);
  }

  return [...perBulan.values()].sort((a, b) => a.bulan.localeCompare(b.bulan));
}

function barisKosong(bulan: string): BarisBulan {
  return {
    bulan,
    surat: 0,
    keluar: 0,
    keluarDikirim: 0,
    undangan: 0,
    nonrapat: 0,
    belumDidisposisikan: 0,
    disposisiTotal: 0,
    disposisiSelesai: 0,
    rapatDijadwalkan: 0,
    rapatDilaksanakan: 0,
    rapatDibatalkan: 0,
  };
}

export async function rekapPerJenis(mulai: Date, akhir: Date): Promise<BarisJenis[]> {
  const rows = await prisma.$queryRaw<{ jenis: string; surat: bigint }[]>`
    SELECT coalesce(jenis_surat, 'Belum ditentukan') AS jenis, count(*) AS surat
    FROM v_surat_aktif
    WHERE tanggal_terima >= ${mulai}::date AND tanggal_terima <= ${akhir}::date
    GROUP BY 1
    ORDER BY count(*) DESC, jenis ASC`;
  return rows.map((r) => ({ jenis: r.jenis, surat: angka(r.surat) }));
}

/** Palet kategori untuk komposisi kategori surat — terpisah dari warna status surat. */
export const PALET_JENIS = [
  "var(--color-chart-cat-1)",
  "var(--color-chart-cat-2)",
  "var(--color-chart-cat-3)",
  "var(--color-chart-cat-4)",
  "var(--color-chart-cat-5)",
  "var(--color-chart-cat-6)",
];

/**
 * Irisan donut komposisi kategori surat: enam kategori terbanyak ditampilkan sendiri, sisanya digabung menjadi
 * "Lainnya" agar slice tetap terbaca. Dipakai oleh Rekap dan layar monitor supaya keduanya tidak berbeda.
 */
export function irisanKomposisiJenis(perJenis: BarisJenis[]) {
  const irisan = perJenis.slice(0, 6).map((r, i) => ({ nama: r.jenis, jumlah: r.surat, warna: PALET_JENIS[i] }));
  const sisa = perJenis.slice(6);
  if (sisa.length > 0) {
    irisan.push({
      nama: `Lainnya (${sisa.length} kategori)`,
      jumlah: sisa.reduce((a, r) => a + r.surat, 0),
      warna: "var(--color-chart-4)",
    });
  }
  return irisan;
}

/** Daftar surat dalam rentang, dipakai untuk lembar surat pada ekspor Excel. */
export async function suratPeriode(mulai: Date, akhir: Date) {
  return prisma.$queryRaw<{
    nomor_agenda: string;
    tanggal_terima: Date;
    pengirim: string;
    nomor_surat: string | null;
    perihal: string;
    status_surat: string;
    status_undangan_rapat: string;
  }[]>`
    SELECT nomor_agenda, tanggal_terima, pengirim, nomor_surat, perihal, status_surat, status_undangan_rapat
    FROM v_surat_aktif
    WHERE tanggal_terima >= ${mulai}::date AND tanggal_terima <= ${akhir}::date
    ORDER BY tanggal_terima ASC, nomor_agenda ASC`;
}

/** Daftar surat keluar dalam rentang, dipakai untuk lembar surat keluar pada ekspor Excel. */
export async function suratKeluarPeriode(mulai: Date, akhir: Date) {
  return prisma.$queryRaw<{
    nomor_surat: string;
    tanggal_surat: Date;
    tujuan: string;
    perihal: string;
    jenis: string | null;
    status_surat: string;
    tanggal_kirim: Date | null;
    lampiran: bigint;
  }[]>
    `SELECT s.nomor_surat, s.tanggal_surat, s.tujuan, s.perihal, j.nama AS jenis,
            s.status_surat, s.tanggal_kirim,
            (SELECT COUNT(*) FROM lampiran_keluar l WHERE l.surat_id = s.id) AS lampiran
     FROM v_surat_keluar_aktif s
     LEFT JOIN jenis_surat j ON j.id = s.jenis_surat_id
     WHERE s.tanggal_surat >= ${mulai}::date AND s.tanggal_surat <= ${akhir}::date
     ORDER BY s.tanggal_surat ASC, s.nomor_surat ASC`;
}

export function totalPeriode(baris: BarisBulan[]) {
  return {
    surat: jumlah(baris.map((b) => b.surat)),
    keluar: jumlah(baris.map((b) => b.keluar)),
    keluarDikirim: jumlah(baris.map((b) => b.keluarDikirim)),
    undangan: jumlah(baris.map((b) => b.undangan)),
    nonrapat: jumlah(baris.map((b) => b.nonrapat)),
    belumDidisposisikan: jumlah(baris.map((b) => b.belumDidisposisikan)),
    disposisiTotal: jumlah(baris.map((b) => b.disposisiTotal)),
    disposisiSelesai: jumlah(baris.map((b) => b.disposisiSelesai)),
    rapat: jumlah(baris.map((b) => b.rapatDijadwalkan)),
    rapatDilaksanakan: jumlah(baris.map((b) => b.rapatDilaksanakan)),
    rapatDibatalkan: jumlah(baris.map((b) => b.rapatDibatalkan)),
  };
}

function jumlah(v: number[]) {
  return v.reduce((a, b) => a + b, 0);
}

export function persenPenyelesaian(selesai: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((selesai / total) * 100);
}

/** Nomor laporan untuk kop cetak: tahun rekap dan jumlah surat yang direkap. */
export function nomorLaporanRekap(tahun: number, jumlahSurat: number): string {
  return `REKAP/ASET/${tahun}/${String(jumlahSurat).padStart(3, "0")}`;
}
