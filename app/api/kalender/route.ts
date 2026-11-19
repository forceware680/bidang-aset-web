import { labelStatusRapat } from "@/lib/status";
import { prisma } from "@/lib/db";
import { BATAS_KALENDER, PESAAN_TOKEN, PILIHAN_AGENDA, PILIHAN_PENULIS, PILIHAN_PESERTA, bentukAgenda, rentangText, jawab, tolak } from "@/lib/api";
import { sesiApi } from "@/lib/api-auth";
import { sinkronkanRapatLewatWaktu } from "@/lib/rapat-waktu";
import { awalHariIni, batasHari, waktuJakarta } from "@/lib/waktu";

/**
 * Kalender untuk aplikasi Android: daftar agenda pada rentang tanggal Asia/Jakarta. Semua peran yang masuk
 * boleh membaca kalender bidang — pengingat pejabat dan pegawai perlu melihat rapat yang mereka hadiri —
 * tapi agenda orang lain hanya terbaca, tidak bisa diubah dari Android.
 *
 * Param: `hari` (satu tanggal), atau `mulai` dan `selesai` (rentang; bawaannya hari ini sampai 30 hari ke
 * depan), `status` (satu status), dan `sejak` (waktu ISO: hanya agenda yang diubah setelah waktu itu,
 * dipakai Android untuk menyinkronkan ulang alarm).
 */
export async function GET(req: Request) {
  const sesi = await sesiApi(req);
  if (!sesi) return tolak(401, PESAAN_TOKEN);

  // Agenda yang waktunya sudah lewat ditandai selesai dulu supaya kalender Android dan alarm pengingat
  // memakai status yang benar.
  await sinkronkanRapatLewatWaktu();

  const q = new URL(req.url).searchParams;
  const hari = q.get("hari");
  const mulai = q.get("mulai");
  const selesai = q.get("selesai");
  if (hari && (mulai || selesai)) {
    return tolak(400, "Pilih salah satu: satu tanggal pada `hari`, atau rentang pada `mulai` dan `selesai`.");
  }

  const batasMulai = hari ? batasHari(hari, false) : mulai ? batasHari(mulai, false) : awalHariIni();
  if (!batasMulai) return tolak(400, "Tanggal mulai tidak dikenali. Gunakan yyyy-mm-dd.");
  const batasSelesai = hari
    ? batasHari(hari, true)
    : selesai
      ? batasHari(selesai, true)
      : new Date(batasMulai.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (!batasSelesai) return tolak(400, "Tanggal selesai tidak dikenali. Gunakan yyyy-mm-dd.");
  if (batasSelesai <= batasMulai) return tolak(400, "Tanggal selesai harus setelah tanggal mulai.");

  const sejakRaw = q.get("sejak");
  const sejak = sejakRaw ? waktuJakarta(sejakRaw) : null;
  if (sejakRaw && !sejak) {
    return tolak(400, "Waktu `sejak` tidak dikenali. Gunakan tanggal dan jam, misalnya 2026-11-02T08:00:00+07:00.");
  }

  const status = q.get("status");
  if (status && !(status in labelStatusRapat)) {
    return tolak(400, `Status agenda tidak dikenali. Yang ada: ${Object.keys(labelStatusRapat).join(", ")}.`);
  }

  const where = {
    tanggal_mulai: { gte: batasMulai, lt: batasSelesai },
    ...(status ? { status_rapat: status } : {}),
    ...(sejak ? { updated_at: { gt: sejak } } : {}),
  };

  const jumlah = await prisma.jadwal_rapat.count({ where });
  const baris = await prisma.jadwal_rapat.findMany({
    where,
    orderBy: { tanggal_mulai: "asc" },
    take: BATAS_KALENDER,
    include: { surat_masuk: PILIHAN_AGENDA, users: PILIHAN_PENULIS, peserta_rapat: PILIHAN_PESERTA },
  });

  return jawab(200, {
    ...rentangText(batasMulai, batasSelesai),
    ...(status ? { status } : {}),
    ...(sejak ? { sejak: sejak.toISOString() } : {}),
    jumlah,
    dikirim: baris.length,
    dipotong: jumlah > baris.length,
    agenda: baris.map((r) => bentukAgenda(r, sesi.user.id, sesi.user.name)),
  });
}
