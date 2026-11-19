import { z } from "zod";
import { logAudit } from "@/lib/auth";
import { jawab, bacaJson, pesanGalat, tolak } from "@/lib/api";
import { masukApi } from "@/lib/api-auth";

/**
 * Masuk untuk aplikasi Android. Email dan kata sandi sama dengan aplikasi web; jawabannya membawa token
 * pembawa yang dipakai pada semua alamat berikutnya. Perangkat boleh disebut supaya jejak menunjukkan HP
 * siapa yang masuk.
 */
const masukSchema = z.object({
  email: z.string().trim().min(1, "Email wajib diisi."),
  password: z.string().min(1, "Kata sandi wajib diisi."),
  perangkat: z.string().trim().max(60, "Nama perangkat paling panjang 60 karakter.").optional(),
});

export async function POST(req: Request) {
  const isi = await bacaJson(req);
  if (!isi) return tolak(400, "Isi permintaan bukan JSON.");

  const parsed = masukSchema.safeParse(isi);
  if (!parsed.success) return tolak(400, pesanGalat(parsed.error));

  const hasil = await masukApi(parsed.data.email, parsed.data.password, parsed.data.perangkat ?? null);
  if (!hasil.ok) {
    if (hasil.sebab === "nonaktif") {
      await logAudit(null, "login_gagal", "users", null, `Login lewat API ditolak, akun ${parsed.data.email.toLowerCase()} nonaktif`);
      return tolak(403, "Akun ini sedang dinonaktifkan oleh administrator.");
    }
    await logAudit(null, "login_gagal", "users", null, `Percobaan login lewat API oleh ${parsed.data.email.toLowerCase()}`);
    return tolak(401, "Email atau kata sandi tidak cocok.");
  }

  await logAudit(hasil.user, "login", "users", hasil.user.id, `${hasil.user.name} masuk dari aplikasi Android`);
  return jawab(200, {
    token: hasil.token,
    kedaluwarsa: hasil.kedaluwarsa.toISOString(),
    nama: hasil.user.name,
    email: hasil.user.email,
    peran: hasil.user.role,
  });
}
