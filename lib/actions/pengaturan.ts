"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { balasKunciMonitor } from "@/lib/monitor-token";
import { galat, sukses, type Hasil } from "@/lib/hasil";


async function adminAktif(): Promise<Hasil | { id: string }> {
  const user = await requireUser();
  if (user.role !== "Administrator") return galat("Hanya Administrator yang bisa mengubah pengaturan.");
  return user;
}

export async function buatPengguna(formData: FormData): Promise<Hasil> {
  const admin = await adminAktif();
  if ("ok" in admin) return admin;

  const nama = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roleName = String(formData.get("role") ?? "");

  if (!nama || !email || !password) return galat("Nama, email, dan kata sandi wajib diisi.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return galat("Format email belum benar.");
  if (password.length < 8) return galat("Kata sandi minimal 8 karakter.");

  const role = await prisma.roles.findUnique({ where: { name: roleName } });
  if (!role) return galat("Peran tidak dikenali.");

  const ada = await prisma.users.findUnique({ where: { email } });
  if (ada) return galat(`Email ${email} sudah dipakai.`);

  const user = await prisma.users.create({
    data: { name: nama, email, password_hash: await bcrypt.hash(password, 10), role_id: role.id },
  });
  await prisma.audit_logs.create({
    data: {
      user_id: admin.id,
      action: "create",
      entity_type: "users",
      entity_id: user.id,
      description: `Akun ${nama} dibuat sebagai ${role.name}`,
    },
  });

  return sukses(`Akun ${nama} dibuat sebagai ${role.name}.`);
}

export async function ubahPengguna(formData: FormData): Promise<Hasil> {
  const admin = await adminAktif();
  if ("ok" in admin) return admin;

  const id = String(formData.get("id") ?? "");
  const roleName = String(formData.get("role") ?? "");
  const aktif = formData.get("is_active") === "1";

  if (id === admin.id && !aktif) return galat("Administrator yang sedang login tidak bisa dinonaktifkan.");

  const role = await prisma.roles.findUnique({ where: { name: roleName } });
  if (!role) return galat("Peran tidak dikenali.");

  const user = await prisma.users.update({ where: { id }, data: { role_id: role.id, is_active: aktif } });
  await prisma.audit_logs.create({
    data: {
      user_id: admin.id,
      action: "update",
      entity_type: "users",
      entity_id: id,
      description: `Akun ${user.name} diubah menjadi ${role.name}${aktif ? "" : " dan dinonaktifkan"}`,
    },
  });

  return sukses(`Akun ${user.name} diubah menjadi ${role.name}${aktif ? "" : " dan dinonaktifkan"}.`);
}

export async function tambahJenis(formData: FormData): Promise<Hasil> {
  const admin = await adminAktif();
  if ("ok" in admin) return admin;

  const nama = String(formData.get("nama") ?? "").trim();
  const arah = formData.get("arah") === "keluar" ? "keluar" : "masuk";
  if (!nama) return galat("Nama kategori surat wajib diisi.");

  const ada = await prisma.jenis_surat.findUnique({ where: { nama } });
  if (ada) return galat(`Kategori surat ${nama} sudah terdaftar.`);

  const jenis = await prisma.jenis_surat.create({ data: { nama, arah } });
  await prisma.audit_logs.create({
    data: {
      user_id: admin.id,
      action: "create",
      entity_type: "jenis_surat",
      entity_id: jenis.id,
      description: `Kategori surat ${nama} untuk ${arah === "keluar" ? "surat keluar" : "surat masuk"} ditambahkan`,
    },
  });

  return sukses(`Kategori surat ${nama} untuk ${arah === "keluar" ? "surat keluar" : "surat masuk"} ditambahkan.`);
}

export async function ubahAktifJenis(formData: FormData): Promise<Hasil> {
  const admin = await adminAktif();
  if ("ok" in admin) return admin;

  const id = String(formData.get("id") ?? "");
  const aktif = formData.get("aktif") === "1";

  const jenis = await prisma.jenis_surat.findUnique({ where: { id } });
  if (!jenis) return galat("Kategori surat tidak ditemukan.");

  await prisma.jenis_surat.update({ where: { id }, data: { aktif } });
  await prisma.audit_logs.create({
    data: {
      user_id: admin.id,
      action: "update",
      entity_type: "jenis_surat",
      entity_id: id,
      description: `Kategori surat ${jenis.nama} ${aktif ? "diaktifkan" : "dinonaktifkan"}`,
    },
  });

  return sukses(`Kategori surat ${jenis.nama} ${aktif ? "diaktifkan" : "dinonaktifkan"}.`);
}

/**
 * Balas kunci layar monitor. Kunci baru dibuat acak, kunci lama berhenti berlaku seketika, dan baris lama
 * disimpan sebagai riwayat. Halaman monitor yang masih memakai kunci lama menolak sampai alamatnya diganti.
 */
export async function rotasiKunciMonitor(): Promise<Hasil> {
  const admin = await adminAktif();
  if ("ok" in admin) return admin;

  const baru = await balasKunciMonitor(admin.id);
  await prisma.audit_logs.create({
    data: {
      user_id: admin.id,
      action: "update",
      entity_type: "monitor_token",
      entity_id: baru.id,
      description: "Kunci layar monitor dibalik; kunci lama berhenti berlaku",
    },
  });

  return sukses("Kunci monitor baru dibuat. Pakai alamat layar yang baru di ruang rapat.");
}

/**
 * Cabut token perangkat Android dari jauh: token dihapus, jadi saat perangkat memeriksa sesi ia mendapat
 * 401 dan harus masuk lagi. Jejak mencatat siapa mencabut perangkat siapa.
 */
export async function cabutTokenPerangkat(form: FormData): Promise<Hasil> {
  const admin = await adminAktif();
  if ("ok" in admin) return admin;

  const id = String(form.get("id") ?? "");
  const token = await prisma.api_token.findUnique({
    where: { id },
    include: { users: { select: { name: true, email: true } } },
  });
  if (!token) return galat("Token sudah dicabut atau tidak ditemukan.");

  await prisma.api_token.delete({ where: { id } });
  await prisma.audit_logs.create({
    data: {
      user_id: admin.id,
      action: "cabut_token",
      entity_type: "api_token",
      entity_id: id,
      description: `Token ${token.users.name} (${token.users.email})${token.perangkat ? ` pada ${token.perangkat}` : ""} dicabut oleh Administrator`,
    },
  });

  return sukses(`Token ${token.users.name}${token.perangkat ? ` pada ${token.perangkat}` : ""} dicabut; perangkat itu harus masuk lagi.`);
}


/**
 * Atur tautan unduh APK Android yang tampil sebagai tombol di pojok kiri atas halaman login.
 * Baris tunggal apk_unduh; kosong berarti tombol dihapus dari login.
 */
export async function aturTautanAPK(formData: FormData): Promise<Hasil> {
  const admin = await adminAktif();
  if ("ok" in admin) return admin;

  const url = String(formData.get("url") ?? "").trim();
  if (!url) {
    await prisma.apk_unduh.deleteMany({ where: { id: "tunggal" } });
    await prisma.audit_logs.create({
      data: { user_id: admin.id, action: "update", entity_type: "apk_unduh", description: "Tautan unduh APK dihapus" },
    });
    return sukses("Tautan unduh APK dihapus — tombol tidak lagi tampil di halaman login.");
  }
  if (!/^https?:\/\/[^\s]+$/.test(url)) return galat("Tautan harus dimulai dengan http:// atau https://.");

  await prisma.apk_unduh.upsert({
    where: { id: "tunggal" },
    create: { url, diubah_oleh: admin.id },
    update: { url, diubah_oleh: admin.id, updated_at: new Date() },
  });
  await prisma.audit_logs.create({
    data: { user_id: admin.id, action: "update", entity_type: "apk_unduh", description: `Tautan unduh APK diatur ke ${url}` },
  });
  return sukses("Tautan unduh APK disimpan — tombol tampil di halaman login.");
}
