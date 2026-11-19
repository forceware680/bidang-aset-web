import { z } from "zod";
import { logAudit } from "@/lib/auth";
import { namaTanpaAkun, pesanPesertaTanpaAkun } from "@/lib/akun";
import { catatNotifikasiPeserta } from "@/lib/notifikasi-peserta";
import { prisma } from "@/lib/db";
import { PESAAN_TOKEN, PILIHAN_AGENDA, PILIHAN_PENULIS, PILIHAN_PESERTA, bentukAgenda, bacaJson, jawab, pesanGalat, tolak } from "@/lib/api";
import { sesiApi } from "@/lib/api-auth";
import { waktuJakarta } from "@/lib/waktu";

/**
 * Tambah agenda milik sendiri dari aplikasi Android. Agenda ini tidak terhubung ke surat masuk (sama seperti
 * "agenda mandiri" di kalender web), jadi pembuatnya yang boleh mengubah dan menghapusnya. Pengingat alarm
 * di perangkat disusun dari `mulai` pada jawaban ini.
 */
const agendaSchema = z.object({
  agenda_rapat: z.string().trim().min(3, "Agenda wajib diisi (minimal 3 karakter)."),
  tanggal_mulai: z.string().min(1, "Waktu mulai wajib diisi."),
  tanggal_selesai: z.string().trim().optional(),
  tempat: z.string().trim().max(300, "Tempat paling panjang 300 karakter.").optional(),
  penyelenggara: z.string().trim().max(200, "Penyelenggara paling panjang 200 karakter.").optional(),
  catatan: z.string().trim().max(2000, "Catatan paling panjang 2000 karakter.").optional(),
  peserta: z.array(z.string().trim().min(1, "Nama peserta wajib diisi.").max(200, "Nama peserta maksimal 200 karakter.")).max(25, "Satu agenda maksimal 25 peserta.").optional(),
});

export async function POST(req: Request) {
  const sesi = await sesiApi(req);
  if (!sesi) return tolak(401, PESAAN_TOKEN);

  const isi = await bacaJson(req);
  if (!isi) return tolak(400, "Isi permintaan bukan JSON.");

  const parsed = agendaSchema.safeParse(isi);
  if (!parsed.success) return tolak(400, pesanGalat(parsed.error));
  const d = parsed.data;

  const mulai = waktuJakarta(d.tanggal_mulai);
  if (!mulai) return tolak(400, "Waktu mulai tidak dikenali. Gunakan tanggal dan jam, misalnya 2026-11-16T09:00.");
  const selesai = d.tanggal_selesai ? waktuJakarta(d.tanggal_selesai) : null;
  if (d.tanggal_selesai && !selesai) {
    return tolak(400, "Waktu selesai tidak dikenali. Gunakan tanggal dan jam, misalnya 2026-11-16T11:00.");
  }
  if (selesai && selesai.getTime() <= mulai.getTime()) {
    return tolak(400, "Waktu selesai harus setelah waktu mulai.");
  }

  // Peserta harus punya akun aplikasi aktif, sama seperti di kalender web: agenda hanya bisa
  // muncul di HP orang yang bisa masuk aplikasi.
  const dipilih = [...new Set((d.peserta ?? []).map((n) => n.trim()).filter(Boolean))];
  const tanpaAkun = await namaTanpaAkun(dipilih);
  if (tanpaAkun.length > 0) {
    return tolak(400, pesanPesertaTanpaAkun(tanpaAkun));
  }

  const dibuat = await prisma.jadwal_rapat.create({
    data: {
      surat_id: null,
      agenda_rapat: d.agenda_rapat,
      tanggal_mulai: mulai,
      tanggal_selesai: selesai,
      tempat: d.tempat || null,
      penyelenggara: d.penyelenggara || null,
      catatan: d.catatan || null,
      status_rapat: "terjadwal",
      created_by: sesi.user.id,
    },
    select: { id: true },
  });

  // Pembuatnya otomatis ikut sebagai peserta, sama seperti agenda mandiri di web.
  const semua = [sesi.user.name, ...dipilih].filter((n, i, arr) => arr.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i);
  await prisma.peserta_rapat.createMany({
    data: semua.map((n) => ({ rapat_id: dibuat.id, nama_peserta: n, instansi_bidang: "BPKAD - Bidang Aset" })),
  });
  await catatNotifikasiPeserta(dibuat.id, dipilih, sesi.user.name);

  await logAudit(sesi.user, "buat_agenda", "jadwal_rapat", dibuat.id, `Agenda tanpa surat dari aplikasi Android: ${d.agenda_rapat}${semua.length > 1 ? ` dengan ${semua.length} peserta` : ""}`);

  const baris = await prisma.jadwal_rapat.findUniqueOrThrow({
    where: { id: dibuat.id },
    include: { surat_masuk: PILIHAN_AGENDA, users: PILIHAN_PENULIS, peserta_rapat: PILIHAN_PESERTA },
  });
  return jawab(201, { pesan: `Agenda ${d.agenda_rapat} tersimpan.`, agenda: bentukAgenda(baris, sesi.user.id, sesi.user.name) });
}
