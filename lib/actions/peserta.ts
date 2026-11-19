"use server";

import { redirect } from "next/navigation";
import { bolehMengubah, currentUser, logAudit, type AktifUser } from "@/lib/auth";
import { namaTanpaAkun, pesanPesertaTanpaAkun } from "@/lib/akun";
import { catatNotifikasiPeserta } from "@/lib/notifikasi-peserta";
import { prisma } from "@/lib/db";
import { galat, sukses, type Hasil } from "@/lib/hasil";
import { PESAAN_TERTUTUP, suratTertutup } from "@/lib/status-surat";

/** Peserta yang dipilih dari daftar pegawai selalu milik bidang ini, jadi instansi tidak perlu diketik. */
const INSTANSI_PEGAWAI_ASET = "BPKAD - Bidang Aset";

const MAKSIMAL_PESERTA = 25;

/** Hak mengubah daftar peserta: peserta milik penulis surat; untuk agenda mandiri hanya pembuatnya atau Administrator. */
async function hakMengubah(rapatId: string, suratId: string): Promise<Hasil | AktifUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!bolehMengubah(user.role)) return galat("Peran kamu tidak bisa mengubah daftar peserta.");
  const rapat = await prisma.jadwal_rapat.findUnique({
    where: { id: rapatId },
    select: { id: true, surat_id: true, created_by: true },
  });
  if (!rapat) return galat("Agenda tidak ditemukan.");
  if (suratId && rapat.surat_id !== suratId) return galat("Peserta tidak tercatat pada agenda ini.");
  if (rapat.surat_id) {
    if (await suratTertutup(rapat.surat_id)) return galat(PESAAN_TERTUTUP);
    return user;
  }
  // Agenda mandiri tidak punya surat; pembuatnya yang memegang daftar pesertanya.
  if (rapat.created_by !== user.id && user.role !== "Administrator") {
    return galat("Hanya pembuat agenda ini yang bisa mengubah daftar pesertanya.");
  }
  return user;
}

/** Beberapa peserta sekaligus: nama dipilih dari daftar pegawai atau diketik bebas, instansi diisi otomatis. */
export async function tambahPeserta(form: FormData): Promise<Hasil> {
  const rapatId = String(form.get("rapat_id") ?? "");
  const suratId = String(form.get("surat_id") ?? "");
  if (!rapatId) return galat("Agenda tujuan tidak dikenali.");

  const pengubah = await hakMengubah(rapatId, suratId);
  if ("ok" in pengubah) return pengubah;

  const nama = [...new Set(form.getAll("nama_peserta").map((v) => String(v).trim()).filter(Boolean))];
  if (nama.length === 0) return galat("Nama peserta wajib diisi.");
  if (nama.length > MAKSIMAL_PESERTA) return galat(`Satu agenda maksimal ${MAKSIMAL_PESERTA} peserta.`);
  if (nama.some((n) => n.length > 200)) return galat("Nama peserta maksimal 200 karakter.");

  const keterangan = String(form.get("keterangan") ?? "").trim();
  if (keterangan.length > 500) return galat("Keterangan maksimal 500 karakter.");

  const rapat = await prisma.jadwal_rapat.findUnique({ where: { id: rapatId } });
  if (!rapat) return galat("Agenda tujuan tidak ditemukan.");

  const tercatat = await prisma.peserta_rapat.findMany({ where: { rapat_id: rapatId }, select: { nama_peserta: true } });
  const sudah = new Set(tercatat.map((p) => p.nama_peserta.toLowerCase()));
  const baru = nama.filter((n) => !sudah.has(n.toLowerCase()));
  if (baru.length === 0) return sukses("Nama yang kamu pilih sudah tercatat di agenda ini.");

  // Nama peserta harus tertaut akun aplikasi aktif: agenda dari surat hanya boleh muncul di HP
  // orang yang bisa masuk aplikasi, jadi tanpa akun nama tidak bisa dijadikan peserta.
  const tanpaAkun = await namaTanpaAkun(baru);
  if (tanpaAkun.length > 0) {
    return galat(pesanPesertaTanpaAkun(tanpaAkun));
  }

  const dibuat = await prisma.peserta_rapat.createManyAndReturn({
    data: baru.map((n) => ({ rapat_id: rapatId, nama_peserta: n, instansi_bidang: INSTANSI_PEGAWAI_ASET, keterangan: keterangan || null })),
  });
  for (const p of dibuat) await logAudit(pengubah, "create", "peserta_rapat", p.id, `Tambah peserta ${p.nama_peserta} pada rapat ${rapat.agenda_rapat}`);
  await catatNotifikasiPeserta(rapatId, dibuat.map((p) => p.nama_peserta), pengubah.name);

  return sukses(baru.length === 1 ? `Peserta ${baru[0]} ditambahkan ke agenda ini.` : `${baru.length} peserta ditambahkan ke agenda ini.`);
}

export async function hapusPeserta(form: FormData): Promise<Hasil> {
  const pesertaId = String(form.get("peserta_id") ?? "");
  const suratId = String(form.get("surat_id") ?? "");

  const peserta = await prisma.peserta_rapat.findUnique({
    where: { id: pesertaId },
    include: { jadwal_rapat: { select: { id: true, agenda_rapat: true, surat_id: true } } },
  });
  if (!peserta) return galat("Peserta tidak ditemukan.");

  const pengubah = await hakMengubah(peserta.jadwal_rapat.id, suratId);
  if ("ok" in pengubah) return pengubah;

  await prisma.peserta_rapat.delete({ where: { id: pesertaId } });
  await logAudit(pengubah, "delete", "peserta_rapat", pesertaId, `Hapus peserta ${peserta.nama_peserta} dari rapat ${peserta.jadwal_rapat.agenda_rapat}`);

  return sukses("Peserta dihapus dari agenda ini.");
}
