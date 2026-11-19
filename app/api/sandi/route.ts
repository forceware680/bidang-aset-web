import { z } from "zod";
import { hashPassword, logAudit, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PESAAN_TOKEN, bacaJson, jawab, pesanGalat, tolak } from "@/lib/api";
import { sesiApi } from "@/lib/api-auth";

/**
 * Ubah kata sandi oleh yang bersangkutan lewat aplikasi Android. Aturannya sama seperti pada halaman akun di
 * web: minimal 8 karakter, konfirmasi harus sama, dan tidak boleh sama dengan yang lama. Token yang sudah
 * issued tidak dicabut, jadi perangkat lain tetap bisa dipakai sampai token itu kedaluwarsa.
 */
const sandiSchema = z.object({
  password_lama: z.string().min(1, "Kata sandi lama wajib diisi."),
  password_baru: z.string().min(8, "Kata sandi baru minimal 8 karakter."),
  password_konfirmasi: z.string().min(1, "Konfirmasi kata sandi wajib diisi."),
});

export async function POST(req: Request) {
  const sesi = await sesiApi(req);
  if (!sesi) return tolak(401, PESAAN_TOKEN);

  const isi = await bacaJson(req);
  if (!isi) return tolak(400, "Isi permintaan bukan JSON.");

  const parsed = sandiSchema.safeParse(isi);
  if (!parsed.success) return tolak(400, pesanGalat(parsed.error));
  const d = parsed.data;

  if (d.password_baru !== d.password_konfirmasi) return tolak(400, "Kata sandi baru dan konfirmasi tidak sama.");
  if (d.password_baru === d.password_lama) return tolak(400, "Kata sandi baru tidak boleh sama dengan kata sandi lama.");

  const record = await prisma.users.findUnique({ where: { id: sesi.user.id } });
  if (!record) return tolak(404, "Akun tidak ditemukan.");
  if (!(await verifyPassword(d.password_lama, record.password_hash))) {
    await logAudit(sesi.user, "login_gagal", "users", sesi.user.id, `Kata sandi lama salah saat ubah kata sandi dari aplikasi Android oleh ${sesi.user.email}`);
    return tolak(400, "Kata sandi lama salah.");
  }

  await prisma.users.update({ where: { id: sesi.user.id }, data: { password_hash: await hashPassword(d.password_baru) } });
  await logAudit(sesi.user, "update", "users", sesi.user.id, `Kata sandi ${sesi.user.name} diubah dari aplikasi Android`);

  return jawab(200, { pesan: "Kata sandi berhasil diganti." });
}
