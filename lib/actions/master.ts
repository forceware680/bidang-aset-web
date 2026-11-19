"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { galat, sukses, type Hasil } from "@/lib/hasil";

async function adminAktif(): Promise<Hasil | { id: string }> {
  const user = await requireUser();
  if (user.role !== "Administrator") return galat("Hanya Administrator yang bisa mengubah pengaturan.");
  return user;
}

function namaDariForm(fd: FormData, label: string): Hasil | string {
  const nama = String(fd.get("nama") ?? "").trim();
  if (!nama) return galat(`${label} wajib diisi.`);
  if (nama.length > 200) return galat("Nama paling panjang 200 karakter.");
  return nama;
}

async function catat(adminId: string, entitas: string, entityId: string, deskripsi: string) {
  await prisma.audit_logs.create({
    data: { user_id: adminId, action: "create", entity_type: entitas, entity_id: entityId, description: deskripsi },
  });
}

async function ubahAktif(
  adminId: string,
  entitas: string,
  fd: FormData,
  label: string,
  ubah: (id: string, aktif: boolean) => Promise<unknown>,
): Promise<Hasil> {
  const id = String(fd.get("id") ?? "");
  const aktif = fd.get("aktif") === "1";
  await ubah(id, aktif);
  await prisma.audit_logs.create({
    data: {
      user_id: adminId,
      action: "update",
      entity_type: entitas,
      entity_id: id,
      description: `${label} ${aktif ? "diaktifkan" : "dinonaktifkan"}`,
    },
  });
  return sukses(`${label} ${aktif ? "diaktifkan" : "dinonaktifkan"}.`);
}

export async function tambahPengirim(fd: FormData): Promise<Hasil> {
  const admin = await adminAktif();
  if ("ok" in admin) return admin;
  const nama = namaDariForm(fd, "Pengirim");
  if (typeof nama !== "string") return nama;
  if (await prisma.master_pengirim.findUnique({ where: { nama } })) return galat(`Pengirim ${nama} sudah terdaftar.`);

  const dibuat = await prisma.master_pengirim.create({ data: { nama } });
  await catat(admin.id, "master_pengirim", dibuat.id, `Pengirim ${nama} ditambahkan`);
  return sukses(`Pengirim ${nama} ditambahkan.`);
}

export async function ubahAktifPengirim(fd: FormData): Promise<Hasil> {
  const admin = await adminAktif();
  if ("ok" in admin) return admin;
  const ada = await prisma.master_pengirim.findUnique({ where: { id: String(fd.get("id") ?? "") } });
  if (!ada) return galat("Pengirim tidak ditemukan.");
  return ubahAktif(admin.id, "master_pengirim", fd, `Pengirim ${ada.nama}`, (id, aktif) =>
    prisma.master_pengirim.update({ where: { id }, data: { aktif } }),
  );
}

export async function tambahPejabat(fd: FormData): Promise<Hasil> {
  const admin = await adminAktif();
  if ("ok" in admin) return admin;
  const nama = namaDariForm(fd, "Pejabat");
  if (typeof nama !== "string") return nama;
  const jabatan = String(fd.get("jabatan") ?? "").trim() || null;
  if (await prisma.master_pejabat.findUnique({ where: { nama } })) return galat(`Pejabat ${nama} sudah terdaftar.`);

  const dibuat = await prisma.master_pejabat.create({ data: { nama, jabatan } });
  await catat(admin.id, "master_pejabat", dibuat.id, `Pemberi disposisi ${nama} ditambahkan`);
  return sukses(`Pemberi disposisi ${nama} ditambahkan.`);
}

export async function ubahAktifPejabat(fd: FormData): Promise<Hasil> {
  const admin = await adminAktif();
  if ("ok" in admin) return admin;
  const ada = await prisma.master_pejabat.findUnique({ where: { id: String(fd.get("id") ?? "") } });
  if (!ada) return galat("Pejabat tidak ditemukan.");
  return ubahAktif(admin.id, "master_pejabat", fd, `Pejabat ${ada.nama}`, (id, aktif) =>
    prisma.master_pejabat.update({ where: { id }, data: { aktif } }),
  );
}

export async function tambahTerusan(fd: FormData): Promise<Hasil> {
  const admin = await adminAktif();
  if ("ok" in admin) return admin;
  const nama = namaDariForm(fd, "Tujuan diteruskan");
  if (typeof nama !== "string") return nama;
  const jenis = fd.get("jenis") === "orang" ? "orang" : "unit";
  if (await prisma.master_terusan.findUnique({ where: { nama } })) return galat(`Tujuan ${nama} sudah terdaftar.`);

  const dibuat = await prisma.master_terusan.create({ data: { nama, jenis } });
  await catat(admin.id, "master_terusan", dibuat.id, `${nama} ditambahkan ke tujuan diteruskan sebagai ${jenis}`);
  return sukses(`${nama} ditambahkan ke tujuan diteruskan sebagai ${jenis}.`);
}

export async function ubahAktifTerusan(fd: FormData): Promise<Hasil> {
  const admin = await adminAktif();
  if ("ok" in admin) return admin;
  const ada = await prisma.master_terusan.findUnique({ where: { id: String(fd.get("id") ?? "") } });
  if (!ada) return galat("Tujuan diteruskan tidak ditemukan.");
  return ubahAktif(admin.id, "master_terusan", fd, `Tujuan ${ada.nama}`, (id, aktif) =>
    prisma.master_terusan.update({ where: { id }, data: { aktif } }),
  );
}

/** Tujuan surat keluar: instansi atau orang yang dikirimi surat. */
export async function tambahPenerima(fd: FormData): Promise<Hasil> {
  const admin = await adminAktif();
  if ("ok" in admin) return admin;
  const nama = namaDariForm(fd, "Tujuan surat keluar");
  if (typeof nama !== "string") return nama;
  const jenis = fd.get("jenis") === "orang" ? "orang" : "unit";
  if (await prisma.master_penerima.findUnique({ where: { nama } })) return galat(`Tujuan ${nama} sudah terdaftar.`);

  const dibuat = await prisma.master_penerima.create({ data: { nama, jenis } });
  await catat(admin.id, "master_penerima", dibuat.id, `${nama} ditambahkan ke tujuan surat keluar sebagai ${jenis}`);
  return sukses(`${nama} ditambahkan ke tujuan surat keluar sebagai ${jenis}.`);
}

export async function ubahAktifPenerima(fd: FormData): Promise<Hasil> {
  const admin = await adminAktif();
  if ("ok" in admin) return admin;
  const ada = await prisma.master_penerima.findUnique({ where: { id: String(fd.get("id") ?? "") } });
  if (!ada) return galat("Tujuan surat keluar tidak ditemukan.");
  return ubahAktif(admin.id, "master_penerima", fd, `Tujuan surat keluar ${ada.nama}`, (id, aktif) =>
    prisma.master_penerima.update({ where: { id }, data: { aktif } }),
  );
}

/** Pegawai Bidang Aset: daftar yang dipakai saat memilih nama peserta rapat. */
export async function tambahPegawai(fd: FormData): Promise<Hasil> {
  const admin = await adminAktif();
  if ("ok" in admin) return admin;
  const nama = namaDariForm(fd, "Pegawai");
  if (typeof nama !== "string") return nama;
  const jabatan = String(fd.get("jabatan") ?? "").trim() || null;
  if (await prisma.master_pegawai.findUnique({ where: { nama } })) return galat(`Pegawai ${nama} sudah terdaftar.`);

  const dibuat = await prisma.master_pegawai.create({ data: { nama, jabatan } });
  await catat(admin.id, "master_pegawai", dibuat.id, `Pegawai ${nama} ditambahkan ke daftar pegawai`);
  return sukses(`Pegawai ${nama} ditambahkan ke daftar pegawai.`);
}

export async function ubahAktifPegawai(fd: FormData): Promise<Hasil> {
  const admin = await adminAktif();
  if ("ok" in admin) return admin;
  const ada = await prisma.master_pegawai.findUnique({ where: { id: String(fd.get("id") ?? "") } });
  if (!ada) return galat("Pegawai tidak ditemukan.");
  return ubahAktif(admin.id, "master_pegawai", fd, `Pegawai ${ada.nama}`, (id, aktif) =>
    prisma.master_pegawai.update({ where: { id }, data: { aktif } }),
  );
}
