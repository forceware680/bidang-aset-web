import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { AktifUser } from "./auth";

/** Token Android diperpanjang setiap kali dipakai; setelah 90 hari tanpa pakai ia kedaluwarsa. */
const HARI_TOKEN = 90;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function aktifOtomatis(): Date {
  return new Date(Date.now() + HARI_TOKEN * 24 * 60 * 60 * 1000);
}

export type HasilMasuk =
  | { ok: false; sebab: "tidak_ada" | "nonaktif" | "salah" }
  | { ok: true; token: string; kedaluwarsa: Date; user: AktifUser };

/**
 * Masuk API memakai akun yang sama dengan aplikasi web. Yang dikirim adalah hash SHA-256 dari token, jadi
 * tabel token tidak menyimpan token asli; token asli hanya ada di jawaban dan di perangkat.
 */
export async function masukApi(email: string, password: string, perangkat: string | null): Promise<HasilMasuk> {
  const user = await prisma.users.findFirst({
    where: { email: email.toLowerCase() },
    include: { roles: { select: { name: true } } },
  });
  if (!user) return { ok: false, sebab: "tidak_ada" };
  if (!user.is_active) return { ok: false, sebab: "nonaktif" };
  if (!(await bcrypt.compare(password, user.password_hash))) return { ok: false, sebab: "salah" };

  const token = randomBytes(32).toString("base64url");
  const kedaluwarsa = aktifOtomatis();
  await prisma.api_token.create({
    data: { user_id: user.id, token_hash: hashToken(token), perangkat, expires_at: kedaluwarsa },
  });

  return {
    ok: true,
    token,
    kedaluwarsa,
    user: { id: user.id, name: user.name, email: user.email, role: user.roles.name },
  };
}

export type SesiApi = { user: AktifUser; tokenId: string; perangkat: string | null; kedaluwarsa: Date };

/**
 * Baca token pembawa. Setiap pemakaian diperpanjang dan dicatat waktunya, supaya perangkat yang dipakai
 * terus tidak keluar di tengah jalan dan perangkat yang berhenti dipakai kedaluwarsa sendiri.
 */
export async function sesiApi(req: Request): Promise<SesiApi | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const row = await prisma.api_token.findFirst({
    where: { token_hash: hashToken(token) },
    include: { users: { select: { id: true, name: true, email: true, is_active: true, roles: { select: { name: true } } } } },
  });
  if (!row) return null;

  // Hash hex panjangnya tetap, jadi perbandingan konstanta waktu aman.
  const diberikan = Buffer.from(hashToken(token));
  const tersimpan = Buffer.from(row.token_hash);
  if (diberikan.length !== tersimpan.length || !timingSafeEqual(diberikan, tersimpan)) return null;
  if (row.expires_at.getTime() < Date.now()) return null;
  if (!row.users.is_active) return null;

  const kedaluwarsa = aktifOtomatis();
  await prisma.api_token.update({
    where: { id: row.id },
    data: { terakhir_pakai: new Date(), expires_at: kedaluwarsa },
  });

  return {
    user: { id: row.users.id, name: row.users.name, email: row.users.email, role: row.users.roles.name },
    tokenId: row.id,
    perangkat: row.perangkat,
    kedaluwarsa,
  };
}

/** Cabut token perangkat (keluar dari aplikasi Android). */
export async function cabutApi(tokenId: string): Promise<void> {
  await prisma.api_token.delete({ where: { id: tokenId } });
}
