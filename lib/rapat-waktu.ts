import { prisma } from "@/lib/db";

/**
 * Agenda rapat disinkronkan otomatis dengan waktu:
 *
 * - waktu mulai sudah tiba dan waktu selesai belum lewat (atau tidak diisi dan hari belum berganti)
 *   -> `berlangsung`;
 * - waktu selesai diisi dan jamnya sudah lewat -> `selesai`;
 * - waktu selesai tidak diisi dan hari agenda itu sudah berganti (Asia/Jakarta) -> `selesai`.
 *
 * Petugas tidak selalu sempat mengubah status di kalender: rapat jam 09:00 yang sudah lewat jamnya tetap
 * berstatus "terjadwal" kalau tidak diubah manual. Fungsi ini dijalankan di awal halaman yang membaca agenda
 * (dashboard, kalender, detail surat, layar monitor, API kalender) sehingga angka "Rapat bulan ini", grafik
 * rapat per bulan, daftar agenda, dan alarm pengingat di aplikasi Android selalu memakai status yang benar.
 * Pemicu `trg_memberi_*` di database mengirim pemberitahuan ke peramban, jadi layar yang terbuka ikut
 * diperbarui.
 */
export async function sinkronkanRapatLewatWaktu(now = new Date()): Promise<number> {
  // Selesai dulu: agenda yang jam selesai atau harinya sudah lewat tidak lagi "berlangsung".
  const selesai = await prisma.$queryRaw<{ id: string; agenda_rapat: string }[]>`
    UPDATE jadwal_rapat
    SET status_rapat = 'selesai', updated_at = ${now}
    WHERE status_rapat IN ('terjadwal', 'berlangsung', 'dijadwalkan_ulang')
      AND (
        (tanggal_selesai IS NOT NULL AND tanggal_selesai <= ${now})
        OR (tanggal_selesai IS NULL AND (tanggal_mulai AT TIME ZONE 'Asia/Jakarta')::date < (${now} AT TIME ZONE 'Asia/Jakarta')::date)
      )
    RETURNING id, agenda_rapat`;

  // Lalu yang sedang berjalan: mulai sudah tiba dan belum selesai.
  const berlangsung = await prisma.$queryRaw<{ id: string; agenda_rapat: string }[]>`
    UPDATE jadwal_rapat
    SET status_rapat = 'berlangsung', updated_at = ${now}
    WHERE status_rapat IN ('terjadwal', 'dijadwalkan_ulang')
      AND tanggal_mulai <= ${now}
      AND (
        (tanggal_selesai IS NOT NULL AND tanggal_selesai > ${now})
        OR (tanggal_selesai IS NULL AND (tanggal_mulai AT TIME ZONE 'Asia/Jakarta')::date = (${now} AT TIME ZONE 'Asia/Jakarta')::date)
      )
    RETURNING id, agenda_rapat`;

  for (const r of selesai) {
    await prisma.audit_logs.create({
      data: {
        user_id: null,
        action: "update",
        entity_type: "jadwal_rapat",
        entity_id: r.id,
        description: `agenda rapat "${r.agenda_rapat}" ditandai selesai otomatis karena waktunya sudah lewat`,
      },
    });
  }
  for (const r of berlangsung) {
    await prisma.audit_logs.create({
      data: {
        user_id: null,
        action: "update",
        entity_type: "jadwal_rapat",
        entity_id: r.id,
        description: `agenda rapat "${r.agenda_rapat}" ditandai berlangsung otomatis karena waktu mulai sudah tiba`,
      },
    });
  }
  return selesai.length + berlangsung.length;
}
