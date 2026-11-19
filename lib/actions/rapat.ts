"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { bolehMengubah, currentUser, logAudit } from "@/lib/auth";
import { namaTanpaAkun, pesanPesertaTanpaAkun } from "@/lib/akun";
import { catatNotifikasiPeserta } from "@/lib/notifikasi-peserta";
import { prisma } from "@/lib/db";
import { agendaTertutup, PESAAN_TERTUTUP } from "@/lib/status-surat";
import { labelStatusRapat, opsiStatusRapat, pesanStatusOtomatis, statusRapatOtomatis } from "@/lib/status";
import { waktuJakarta } from "@/lib/waktu";
import { galat, sukses, type Hasil } from "@/lib/hasil";

async function penulis() {
  const user = await currentUser();
  if (!user) return null;
  return bolehMengubah(user.role) ? user : null;
}

/** Hak atas sebuah agenda: petugas/agenda boleh mengubah semua agenda; pengguna lain hanya agenda miliknya. */
async function penulisAgenda(rapat: { surat_id: string | null; created_by: string | null }) {
  const user = await currentUser();
  if (!user) return null;
  if (bolehMengubah(user.role)) return user;
  return rapat.surat_id === null && rapat.created_by === user.id ? user : null;
}

const statusSchema = z.enum(["terjadwal", "berlangsung", "selesai", "dibatalkan", "dijadwalkan_ulang"]);

/** Status agenda. Tidak berpindah halaman: pemanggil menyegarkan payload di tempat yang sama. */
export async function ubahStatusRapat(formData: FormData): Promise<Hasil> {
  const id = String(formData.get("id") ?? "");
  const status = statusSchema.safeParse(String(formData.get("status_rapat") ?? ""));
  if (!id || !status.success) return galat("Status agenda tidak dikenali.");

  const rapat = await prisma.jadwal_rapat.findUnique({ where: { id } });
  if (!rapat) return galat("Agenda tidak ditemukan.");
  if (await agendaTertutup(rapat)) return galat(PESAAN_TERTUTUP);
  const user = await penulisAgenda(rapat);
  if (!user) return galat("Akun ini hanya berhak membaca data.");

  // "berlangsung" dan "sudah dilaksanakan" berubah sendiri menurut waktu, tidak dipilih manual.
  if (statusRapatOtomatis.includes(status.data as (typeof statusRapatOtomatis)[number])) {
    return galat(pesanStatusOtomatis(status.data));
  }
  // Status yang tidak masuk akal ditolak: agenda yang waktunya sudah lewat tidak bisa dijadwal sebagai
  // agenda baru tanpa mengubah waktunya.
  const boleh = opsiStatusRapat({ tanggal_mulai: rapat.tanggal_mulai, tanggal_selesai: rapat.tanggal_selesai });
  if (!boleh.includes(status.data)) {
    return galat(`Status "${labelStatusRapat[status.data]}" tidak masuk akal untuk agenda ini — pilih ${boleh.map((k) => labelStatusRapat[k]).join(", ")}.`);
  }

  await prisma.jadwal_rapat.update({ where: { id }, data: { status_rapat: status.data } });
  await logAudit(user, "ubah_rapat", "jadwal_rapat", id, `${rapat.agenda_rapat} menjadi ${status.data}`);
  return sukses(`Status agenda diubah menjadi ${labelStatusRapat[status.data]}.`);
}

/** Publikasi agenda ke monitor di depan ruangan Bidang Aset. Tidak berpindah halaman: pemanggil menyegarkan di tempat yang sama. */
export async function ubahTerbitRapat(formData: FormData): Promise<Hasil> {
  const id = String(formData.get("id") ?? "");
  const terbit = String(formData.get("terbit") ?? "") === "1";
  if (!id) return galat("Agenda tidak dikenali.");

  const rapat = await prisma.jadwal_rapat.findUnique({ where: { id } });
  if (!rapat) return galat("Agenda tidak ditemukan.");
  if (await agendaTertutup(rapat)) return galat(PESAAN_TERTUTUP);
  const user = await penulisAgenda(rapat);
  if (!user) return galat("Akun ini hanya berhak membaca data.");

  await prisma.jadwal_rapat.update({ where: { id }, data: { terbit } });
  await logAudit(user, "ubah_terbit_rapat", "jadwal_rapat", id, `${rapat.agenda_rapat} ${terbit ? "tampil di layar monitor" : "disembunyikan dari layar monitor"}`);
  return sukses(terbit ? "Agenda ditampilkan di layar monitor." : "Agenda disembunyikan dari layar monitor.");
}

const geserSchema = z.object({
  id: z.string().min(1),
  tanggal_mulai_baru: z.string().min(1, "Waktu mulai baru wajib diisi."),
  tanggal_selesai_baru: z.string().trim().optional(),
  alasan_perubahan: z.string().trim().min(3, "Alasan perubahan wajib diisi."),
});

/** Geser jadwal rapat; perubahan lama tercatat di riwayat. */
export async function jadwalkanUlang(formData: FormData): Promise<Hasil> {
  const parsed = geserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return galat(parsed.error.issues.map((e: { message: string }) => e.message).join(" "));
  const d = parsed.data;

  const rapat = await prisma.jadwal_rapat.findUnique({ where: { id: d.id } });
  if (!rapat) return galat("Agenda tidak ditemukan.");
  if (await agendaTertutup(rapat)) return galat(PESAAN_TERTUTUP);
  const user = await penulisAgenda(rapat);
  if (!user) return galat("Akun ini hanya berhak membaca data.");

  const baru = waktuJakarta(d.tanggal_mulai_baru);
  const selesaiBaru = d.tanggal_selesai_baru ? waktuJakarta(d.tanggal_selesai_baru) : null;
  if (!baru) return galat("Waktu mulai baru tidak dikenali. Gunakan tanggal dan jam yang benar.");
  if (selesaiBaru && selesaiBaru <= baru) {
    return galat("Waktu selesai baru tidak boleh mendahului waktu mulai baru.");
  }

  await prisma.$transaction([
    prisma.riwayat_jadwal_rapat.create({
      data: {
        rapat_id: d.id,
        tanggal_mulai_lama: rapat.tanggal_mulai,
        tanggal_selesai_lama: rapat.tanggal_selesai,
        tanggal_mulai_baru: baru,
        tanggal_selesai_baru: selesaiBaru,
        alasan_perubahan: d.alasan_perubahan,
        changed_by: user.id,
      },
    }),
    prisma.jadwal_rapat.update({
      where: { id: d.id },
      data: {
        tanggal_mulai: baru,
        tanggal_selesai: selesaiBaru,
        status_rapat: "dijadwalkan_ulang",
      },
    }),
  ]);

  await logAudit(user, "geser_rapat", "jadwal_rapat", d.id, `Jadwal ${rapat.agenda_rapat} diubah ke ${baru.toISOString()}`);
  return sukses("Jadwal agenda diperbarui dan perubahan lama tercatat.");
}

const detailSchema = z.object({
  id: z.string().min(1),
  tempat: z.string().trim().max(300, "Tempat paling panjang 300 karakter.").optional(),
  penyelenggara: z.string().trim().max(200, "Penyelenggara paling panjang 200 karakter.").optional(),
});

/** Tempat dan penyelenggara agenda bisa dilengkapi setelah surat disimpan. */
export async function ubahDetailRapat(form: FormData): Promise<Hasil> {
  const parsed = detailSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return galat(parsed.error.issues.map((e: { message: string }) => e.message).join(" "));
  const d = parsed.data;

  const rapat = await prisma.jadwal_rapat.findUnique({ where: { id: d.id } });
  if (!rapat) return galat("Agenda tidak ditemukan.");
  if (await agendaTertutup(rapat)) return galat(PESAAN_TERTUTUP);
  const user = await penulisAgenda(rapat);
  if (!user) return galat("Akun ini hanya berhak membaca data.");

  await prisma.jadwal_rapat.update({
    where: { id: d.id },
    data: { tempat: d.tempat || null, penyelenggara: d.penyelenggara || null },
  });
  await logAudit(user, "ubah_rapat", "jadwal_rapat", d.id, `Tempat/penyelenggara ${rapat.agenda_rapat} diperbarui`);
  return sukses(`Tempat dan penyelenggara agenda ${rapat.agenda_rapat} diperbarui.`);
}

/**
 * Mencatat agenda rapat untuk surat yang sudah tersimpan dan ditandai sebagai undangan rapat. Surat yang
 * dibuat tanpa agenda bisa mendapat agendanya di halaman suratnya. Tidak berpindah halaman: detail surat
 * di-refresh sehingga bagian Rapat muncul setelah agenda tersimpan.
 */
export async function catatAgendaSurat(form: FormData): Promise<Hasil> {
  const parsed = agendaSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return galat(parsed.error.issues.map((e: { message: string }) => e.message).join(" "));
  const d = parsed.data;

  const suratId = String(form.get("surat_id") ?? "");
  const surat = await prisma.surat_masuk.findUnique({ where: { id: suratId } });
  if (!surat) return galat("Surat tidak ditemukan.");
  if (surat.deleted_at) return galat("Surat ini sudah dihapus.");
  if (surat.status_surat === "arsip") return galat(PESAAN_TERTUTUP);
  const user = await penulis();
  if (!user) return galat("Akun ini hanya berhak membaca data.");
  if (surat.status_undangan_rapat !== "ya") return galat("Surat ini belum ditandai sebagai undangan rapat.");

  const mulai = waktuJakarta(d.tanggal_mulai);
  if (!mulai) return galat("Waktu mulai belum benar.");
  const selesai = d.tanggal_selesai ? waktuJakarta(d.tanggal_selesai) : null;
  if (d.tanggal_selesai && !selesai) return galat("Waktu selesai belum benar.");
  if (selesai && selesai.getTime() <= mulai.getTime()) return galat("Waktu selesai harus setelah waktu mulai.");

  const rapat = await prisma.jadwal_rapat.create({
    data: {
      surat_id: suratId,
      agenda_rapat: d.agenda_rapat,
      tanggal_mulai: mulai,
      tanggal_selesai: selesai,
      tempat: d.tempat || null,
      penyelenggara: d.penyelenggara || null,
      catatan: d.catatan || null,
      created_by: user.id,
    },
    select: { id: true, agenda_rapat: true },
  });

  await logAudit(user, "catat_agenda", "jadwal_rapat", rapat.id, `Agenda ${rapat.agenda_rapat} dicatat dari surat ${surat.nomor_agenda}`);
  return sukses(`Agenda ${rapat.agenda_rapat} dicatat dan masuk ke kalender.`);
}

/**
 * Menghapus agenda yang bersumber dari surat, dari detail suratnya. Peserta dan riwayat jadwal ikut terhapus
 * (ON DELETE CASCADE), jadi konfirmasi menyebut jumlah peserta. Surat yang sedang diarsipkan tertutup.
 */
export async function hapusAgendaDariSurat(form: FormData): Promise<Hasil> {
  const id = String(form.get("id") ?? "");
  const rapat = await prisma.jadwal_rapat.findUnique({ where: { id } });
  if (!rapat) return galat("Agenda tidak ditemukan.");
  if (rapat.surat_id === null) return galat("Agenda tanpa surat dihapus dari kalender, bukan dari halaman suratnya.");
  if (await agendaTertutup(rapat)) return galat(PESAAN_TERTUTUP);
  const user = await penulisAgenda(rapat);
  if (!user) return galat("Akun ini hanya berhak membaca data.");

  const peserta = await prisma.peserta_rapat.count({ where: { rapat_id: id } });
  await prisma.jadwal_rapat.delete({ where: { id } });
  await logAudit(
    user,
    "hapus_agenda",
    "jadwal_rapat",
    id,
    `Agenda ${rapat.agenda_rapat} dihapus dari surat${peserta ? ` beserta ${peserta} pesertanya` : ""}`,
  );
  return sukses(
    `Agenda ${rapat.agenda_rapat} dihapus dari surat ini${peserta ? ` beserta ${peserta} pesertanya` : ""}.`,
  );
}

const agendaSchema = z.object({
  agenda_rapat: z.string().trim().min(3, "Agenda wajib diisi (minimal 3 karakter)."),
  tanggal_mulai: z.string().min(1, "Waktu mulai wajib diisi."),
  tanggal_selesai: z.string().trim().optional(),
  tempat: z.string().trim().max(300, "Tempat paling panjang 300 karakter.").optional(),
  penyelenggara: z.string().trim().max(200, "Penyelenggara paling panjang 200 karakter.").optional(),
  catatan: z.string().trim().max(2000, "Catatan paling panjang 2000 karakter.").optional(),
});

/** Peserta yang dipilih dari daftar selalu milik bidang ini, jadi instansi tidak perlu diketik. */
const INSTANSI_PEGAWAI_ASET = "BPKAD - Bidang Aset";
const MAKSIMAL_PESERTA = 25;

/**
 * Nama peserta dari formulir. Sama aturannya dengan peserta agenda surat: hanya nama yang ada di daftar
 * pegawai bidang aset yang aktif boleh masuk; yang di luar daftar harus ditambah dulu di Pengaturan.
 */
async function pesertaDariForm(form: FormData): Promise<{ nama: string[]; galat: string | null }> {
  const dipilih = [...new Set(form.getAll("nama_peserta").map((v) => String(v).trim()).filter(Boolean))];
  if (dipilih.length > MAKSIMAL_PESERTA) return { nama: [], galat: `Satu agenda maksimal ${MAKSIMAL_PESERTA} peserta.` };
  if (dipilih.some((n) => n.length > 200)) return { nama: [], galat: "Nama peserta maksimal 200 karakter." };
  if (dipilih.length === 0) return { nama: [], galat: null };

  // Peserta hanya orang yang punya akun aplikasi aktif — agenda harus bisa muncul di HP peserta.
  const tanpaAkun = await namaTanpaAkun(dipilih);
  if (tanpaAkun.length > 0) {
    return { nama: [], galat: pesanPesertaTanpaAkun(tanpaAkun) };
  }
  return { nama: dipilih, galat: null };
}

/**
 * Peserta agenda baru: pembuatnya otomatis ikut (mis. kepala bidang yang membuat pengingat), ditambah
 * nama yang dipilih di formulir. Nama yang sama tidak dicatat dua kali.
 */
async function catatPesertaAgenda(rapatId: string, namaSendiri: string, dipilih: string[]) {
  const semua = [namaSendiri, ...dipilih].filter((n, i, arr) => arr.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i);
  const dibuat = await prisma.peserta_rapat.createManyAndReturn({
    data: semua.map((n) => ({ rapat_id: rapatId, nama_peserta: n, instansi_bidang: INSTANSI_PEGAWAI_ASET })),
  });
  await catatNotifikasiPeserta(rapatId, dipilih, namaSendiri);
  return dibuat.length;
}

/**
 * Agenda tanpa surat masuk: pengingat untuk dirinya sendiri atau kegiatan internal bidang. Satu-satunya
 * aksi agenda yang tetap berpindah halaman — pembuat harus langsung melihat tanggal yang ia isi, jadi
 * hasilnya membawa `redirect()` ke detail tanggal itu.
 */
export async function buatAgendaMandiri(form: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) arahAgenda(form, "agenda", "galat", "Belum masuk.");

  const parsed = agendaSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    arahAgenda(form, "agenda", "galat", parsed.error.issues.map((e: { message: string }) => e.message).join(" "));
  }
  const d = parsed.data;

  const mulai = waktuJakarta(d.tanggal_mulai);
  const selesai = d.tanggal_selesai ? waktuJakarta(d.tanggal_selesai) : null;
  if (!mulai) arahAgenda(form, "agenda", "galat", "Waktu mulai tidak dikenali. Gunakan tanggal dan jam yang benar.");
  if (selesai && selesai <= mulai) arahAgenda(form, "agenda", "galat", "Waktu selesai tidak boleh mendahului waktu mulai.");

  const peserta = await pesertaDariForm(form);
  if (peserta.galat) arahAgenda(form, "agenda", "galat", peserta.galat);

  const dibuat = await prisma.jadwal_rapat.create({
    data: {
      surat_id: null,
      agenda_rapat: d.agenda_rapat,
      penyelenggara: d.penyelenggara || null,
      tempat: d.tempat || null,
      catatan: d.catatan || null,
      tanggal_mulai: mulai,
      tanggal_selesai: selesai,
      status_rapat: "terjadwal",
      created_by: user.id,
    },
  });
  // Pembuatnya sendiri ikut tercatat sebagai peserta, ditambah pejabat yang dipilih di formulir.
  const jumlah = await catatPesertaAgenda(dibuat.id, user.name, peserta.nama);
  await logAudit(user, "buat_agenda", "jadwal_rapat", dibuat.id, `Agenda tanpa surat: ${d.agenda_rapat}${jumlah > 1 ? ` dengan ${jumlah} peserta` : ""}`);

  // Buka halaman pada tanggal agenda baru dibuat, supaya pembuat langsung melihat hasilnya.
  const bagianTanggal = [
    { type: "year", value: String(mulai.getUTCFullYear()) },
    { type: "month", value: String(mulai.getUTCMonth() + 1).padStart(2, "0") },
    { type: "day", value: String(mulai.getUTCDate()).padStart(2, "0") },
  ];
  const kunciTanggal = `${bagianTanggal[0].value}-${bagianTanggal[1].value}-${bagianTanggal[2].value}`;
  const bulanBaru = `${bagianTanggal[0].value}-${bagianTanggal[1].value}`;
  const formTanggal = new FormData();
  formTanggal.set("bulan", bulanBaru);
  formTanggal.set("tanggal", kunciTanggal);
  arahAgenda(formTanggal, "agenda", "ok", `Agenda ${d.agenda_rapat} tersimpan.`);
}

/** Redirect untuk agenda mandiri: tetap di halaman kalender, pada bulan/tanggal yang sedang dibuka. */
function arahAgenda(form: FormData, flag: "agenda" | "ubah", status: "ok" | "galat" | "hapus", pesan?: string): never {
  const bulan = String(form.get("bulan") ?? "");
  const tanggal = String(form.get("tanggal") ?? "");
  const prefix = `/rapat?${flag}=${status}`;
  const ekstra = `${bulan ? `&bulan=${bulan}` : ""}${tanggal ? `&tanggal=${tanggal}` : ""}${pesan ? `&pesan=${encodeURIComponent(pesan)}` : ""}`;
  redirect(`${prefix}${ekstra}&t=${Date.now()}`);
}

const ubahMandiriSchema = agendaSchema.extend({ id: z.string().min(1, "Agenda tidak dikenali.") });

/**
 * Mengubah agenda tanpa surat milik sendiri dari kalender — tidak perlu hapus lalu input ulang.
 * Tetap di halaman kalender pada bulan/tanggal yang sedang dibuka (form membawa bulan/tanggal itu).
 * Agenda dari surat tetap diubah di halaman suratnya.
 */
export async function ubahAgendaMandiri(form: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) arahAgenda(form, "agenda", "galat", "Belum masuk.");

  const parsed = ubahMandiriSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    arahAgenda(form, "agenda", "galat", parsed.error.issues.map((e: { message: string }) => e.message).join(" "));
  }
  const d = parsed.data;

  const rapat = await prisma.jadwal_rapat.findUnique({ where: { id: d.id } });
  if (!rapat) arahAgenda(form, "agenda", "galat", "Agenda tidak ditemukan.");
  if (rapat!.surat_id !== null) arahAgenda(form, "agenda", "galat", "Agenda dari surat diubah di halaman suratnya.");
  if (await agendaTertutup(rapat!)) arahAgenda(form, "agenda", "galat", PESAAN_TERTUTUP);
  const pemilik = await penulisAgenda(rapat!);
  if (!pemilik) arahAgenda(form, "agenda", "galat", "Hanya pembuat agenda yang bisa mengubahnya.");

  const mulai = waktuJakarta(d.tanggal_mulai);
  const selesai = d.tanggal_selesai ? waktuJakarta(d.tanggal_selesai) : null;
  if (!mulai) arahAgenda(form, "agenda", "galat", "Waktu mulai tidak dikenali. Gunakan tanggal dan jam yang benar.");
  if (selesai && selesai <= mulai) arahAgenda(form, "agenda", "galat", "Waktu selesai tidak boleh mendahului waktu mulai.");

  const peserta = await pesertaDariForm(form);
  if (peserta.galat) arahAgenda(form, "agenda", "galat", peserta.galat);

  await prisma.jadwal_rapat.update({
    where: { id: d.id },
    data: {
      agenda_rapat: d.agenda_rapat,
      penyelenggara: d.penyelenggara || null,
      tempat: d.tempat || null,
      catatan: d.catatan || null,
      tanggal_mulai: mulai,
      tanggal_selesai: selesai,
    },
  });

  // Formulir ubah hanya menambah peserta; yang sudah tercatat tidak hilang karena tidak dipilih ulang.
  const tercatat = await prisma.peserta_rapat.findMany({ where: { rapat_id: d.id }, select: { nama_peserta: true } });
  const sudah = new Set(tercatat.map((p) => p.nama_peserta.toLowerCase()));
  const baru = peserta.nama.filter((n) => !sudah.has(n.toLowerCase()));
  if (baru.length > 0) {
    await prisma.peserta_rapat.createMany({
      data: baru.map((n) => ({ rapat_id: d.id, nama_peserta: n, instansi_bidang: INSTANSI_PEGAWAI_ASET })),
    });
    await catatNotifikasiPeserta(d.id, baru, pemilik!.name);
  }
  await logAudit(
    pemilik!,
    "ubah_agenda",
    "jadwal_rapat",
    d.id,
    `Agenda tanpa surat diubah: ${rapat!.agenda_rapat} menjadi ${d.agenda_rapat}${baru.length > 0 ? ` dengan ${baru.length} peserta baru` : ""}`,
  );

  arahAgenda(form, "agenda", "ok", `Agenda ${d.agenda_rapat} diperbarui.`);
}

/** Menghapus agenda tanpa surat. Pemiliknya bisa menghapus miliknya sendiri; petugas menghapus semua. */
export async function hapusAgendaMandiri(form: FormData): Promise<Hasil> {
  const id = String(form.get("id") ?? "");
  const rapat = await prisma.jadwal_rapat.findUnique({ where: { id } });
  if (!rapat) return galat("Agenda tidak ditemukan.");
  if (rapat.surat_id !== null) return galat("Agenda dari surat dihapus dari halaman suratnya, bukan dari kalender.");

  const user = await currentUser();
  if (!user) return galat("Belum masuk.");
  if (!bolehMengubah(user.role) && rapat.created_by !== user.id) {
    return galat("Hanya pembuat agenda atau petugas yang bisa menghapus agenda ini.");
  }

  await prisma.jadwal_rapat.delete({ where: { id } });
  await logAudit(user, "hapus_agenda", "jadwal_rapat", id, `Agenda ${rapat.agenda_rapat} dihapus`);
  return sukses(`Agenda ${rapat.agenda_rapat} dihapus.`);
}
