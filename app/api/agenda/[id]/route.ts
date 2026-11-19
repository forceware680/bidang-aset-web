import { z } from "zod";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  PESAAN_BUKAN_PEMILIK,
  PESAAN_DARI_SURAT,
  PESAAN_TOKEN,
  PILIHAN_AGENDA,
  PILIHAN_PENULIS,
  PILIHAN_PESERTA,
  bentukAgenda,
  bacaJson,
  jawab,
  pesanGalat,
  tolak,
} from "@/lib/api";
import { sesiApi } from "@/lib/api-auth";
import { waktuJakarta } from "@/lib/waktu";
import { labelStatusRapat, opsiStatusRapat, pesanStatusOtomatis, statusRapatOtomatis } from "@/lib/status";

const statusSchema = z.enum(Object.keys(labelStatusRapat) as [string, ...string[]]);

/**
 * Koreksi agenda milik sendiri dari aplikasi Android: judul, tempat, penyelenggara, catatan, status, dan
 * waktu. Menggeser waktu tercatat pada riwayat jadwal, sama seperti "Jadwalkan ulang" di aplikasi web.
 * Agenda dari surat dan agenda buatan orang lain ditolak (403): Android hanya mengurus agenda sendiri.
 */
const ubahSchema = z.object({
  agenda_rapat: z.string().trim().min(3, "Agenda wajib diisi (minimal 3 karakter).").optional(),
  tempat: z.string().trim().max(300, "Tempat paling panjang 300 karakter.").nullable().optional(),
  penyelenggara: z.string().trim().max(200, "Penyelenggara paling panjang 200 karakter.").nullable().optional(),
  catatan: z.string().trim().max(2000, "Catatan paling panjang 2000 karakter.").nullable().optional(),
  status_rapat: statusSchema.optional(),
  tanggal_mulai: z.string().min(1, "Waktu mulai wajib diisi.").optional(),
  tanggal_selesai: z.string().trim().nullable().optional(),
  alasan: z.string().trim().max(200, "Alasan paling panjang 200 karakter.").optional(),
});

async function agendaMilikSendiri(req: Request, id: string) {
  const sesi = await sesiApi(req);
  if (!sesi) return { galat: tolak(401, PESAAN_TOKEN) } satisfies { galat: NextResponse };
  const baris = await prisma.jadwal_rapat.findUnique({
    where: { id },
    include: { surat_masuk: PILIHAN_AGENDA, users: PILIHAN_PENULIS, peserta_rapat: PILIHAN_PESERTA },
  });
  if (!baris) return { galat: tolak(404, "Agenda tidak ditemukan.") } satisfies { galat: NextResponse };
  if (baris.surat_id !== null) return { galat: tolak(403, PESAAN_DARI_SURAT) } satisfies { galat: NextResponse };
  if (baris.created_by !== sesi.user.id) return { galat: tolak(403, PESAAN_BUKAN_PEMILIK) } satisfies { galat: NextResponse };
  return { sesi, baris };
}

/** Agenda tunggal terbaca oleh semua akun yang masuk; yang diubah hanya pembuatnya. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sesi = await sesiApi(req);
  if (!sesi) return tolak(401, PESAAN_TOKEN);
  const { id } = await ctx.params;
  const baris = await prisma.jadwal_rapat.findUnique({
    where: { id },
    include: { surat_masuk: PILIHAN_AGENDA, users: PILIHAN_PENULIS, peserta_rapat: PILIHAN_PESERTA },
  });
  if (!baris) return tolak(404, "Agenda tidak ditemukan.");
  return jawab(200, { agenda: bentukAgenda(baris, sesi.user.id, sesi.user.name) });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const hasil = await agendaMilikSendiri(req, id);
  if ("galat" in hasil) return hasil.galat;
  const { sesi, baris } = hasil;

  const isi = await bacaJson(req);
  if (!isi) return tolak(400, "Isi permintaan bukan JSON.");

  const parsed = ubahSchema.safeParse(isi);
  if (!parsed.success) return tolak(400, pesanGalat(parsed.error));
  const d = parsed.data;

  const adaIsian =
    d.agenda_rapat !== undefined ||
    d.tempat !== undefined ||
    d.penyelenggara !== undefined ||
    d.catatan !== undefined ||
    d.status_rapat !== undefined ||
    d.tanggal_mulai !== undefined ||
    d.tanggal_selesai !== undefined;
  if (!adaIsian) return tolak(400, "Tidak ada yang diubah. Isi minimal satu bagian.");

  let mulaiBaru: Date;
  if (d.tanggal_mulai === undefined) {
    mulaiBaru = baris.tanggal_mulai;
  } else {
    const nilaiMulai = waktuJakarta(d.tanggal_mulai);
    if (!nilaiMulai) {
      return tolak(400, "Waktu mulai tidak dikenali. Gunakan tanggal dan jam, misalnya 2026-11-16T09:00.");
    }
    mulaiBaru = nilaiMulai;
  }

  let selesaiBaru: Date | null;
  if (d.tanggal_selesai === undefined) {
    selesaiBaru = baris.tanggal_selesai;
  } else if (d.tanggal_selesai === null) {
    selesaiBaru = null;
  } else {
    const nilaiSelesai = waktuJakarta(d.tanggal_selesai);
    if (!nilaiSelesai) {
      return tolak(400, "Waktu selesai tidak dikenali. Gunakan tanggal dan jam, atau kosongkan dengan null.");
    }
    selesaiBaru = nilaiSelesai;
  }
  if (selesaiBaru && selesaiBaru.getTime() <= mulaiBaru.getTime()) {
    return tolak(400, "Waktu selesai harus setelah waktu mulai.");
  }

  // Status yang diminta harus masuk akal untuk waktu agenda yang baru, dan status otomatis tidak dipilih manual.
  if (d.status_rapat !== undefined) {
    if (statusRapatOtomatis.includes(d.status_rapat as (typeof statusRapatOtomatis)[number])) {
      return tolak(400, pesanStatusOtomatis(d.status_rapat));
    }
    const boleh = opsiStatusRapat({ tanggal_mulai: mulaiBaru, tanggal_selesai: selesaiBaru });
    if (!boleh.includes(d.status_rapat)) {
      return tolak(400, `Status "${labelStatusRapat[d.status_rapat]}" tidak masuk akal untuk agenda ini — pilih ${boleh.map((k) => labelStatusRapat[k]).join(", ")}.`);
    }
  }

  const waktuBerubah =
    mulaiBaru.getTime() !== baris.tanggal_mulai.getTime() ||
    (selesaiBaru?.getTime() ?? null) !== (baris.tanggal_selesai?.getTime() ?? null);

  const data = {
    agenda_rapat: d.agenda_rapat ?? baris.agenda_rapat,
    tempat: d.tempat === undefined ? baris.tempat : d.tempat || null,
    penyelenggara: d.penyelenggara === undefined ? baris.penyelenggara : d.penyelenggara || null,
    catatan: d.catatan === undefined ? baris.catatan : d.catatan || null,
    status_rapat: d.status_rapat ?? (waktuBerubah ? "dijadwalkan_ulang" : baris.status_rapat),
    tanggal_mulai: mulaiBaru,
    tanggal_selesai: selesaiBaru,
  };

  if (waktuBerubah) {
    await prisma.$transaction([
      prisma.riwayat_jadwal_rapat.create({
        data: {
          rapat_id: baris.id,
          tanggal_mulai_lama: baris.tanggal_mulai,
          tanggal_selesai_lama: baris.tanggal_selesai,
          tanggal_mulai_baru: mulaiBaru,
          tanggal_selesai_baru: selesaiBaru,
          alasan_perubahan: d.alasan || "Digeser dari aplikasi Android.",
          changed_by: sesi.user.id,
        },
      }),
      prisma.jadwal_rapat.update({ where: { id: baris.id }, data }),
    ]);
    await logAudit(
      sesi.user,
      "geser_rapat",
      "jadwal_rapat",
      baris.id,
      `Jadwal ${baris.agenda_rapat} digeser dari aplikasi Android ke ${mulaiBaru.toISOString()}`,
    );
  } else {
    await prisma.jadwal_rapat.update({ where: { id: baris.id }, data });
    await logAudit(sesi.user, "ubah_rapat", "jadwal_rapat", baris.id, `Agenda ${baris.agenda_rapat} dikoreksi dari aplikasi Android`);
  }

  const terbaru = await prisma.jadwal_rapat.findUniqueOrThrow({
    where: { id: baris.id },
    include: { surat_masuk: PILIHAN_AGENDA, users: PILIHAN_PENULIS, peserta_rapat: PILIHAN_PESERTA },
  });
  return jawab(200, { pesan: "Agenda diperbarui.", agenda: bentukAgenda(terbaru, sesi.user.id, sesi.user.name) });
}

/** Hapus agenda milik sendiri. Peserta yang sudah tercatat ikut terhapus. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const hasil = await agendaMilikSendiri(req, id);
  if ("galat" in hasil) return hasil.galat;
  const { sesi, baris } = hasil;

  const peserta = await prisma.peserta_rapat.count({ where: { rapat_id: baris.id } });
  await prisma.jadwal_rapat.delete({ where: { id: baris.id } });
  await logAudit(
    sesi.user,
    "hapus_agenda",
    "jadwal_rapat",
    baris.id,
    `Agenda ${baris.agenda_rapat} dihapus dari aplikasi Android${peserta ? ` beserta ${peserta} pesertanya` : ""}`,
  );
  return jawab(200, {
    pesan: `Agenda ${baris.agenda_rapat} dihapus${peserta ? ` beserta ${peserta} pesertanya` : ""}.`,
  });
}
