"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { currentUser, endSession, hashPassword, logAudit, startSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type AuthState = { error?: string; ok?: string };

export async function login(prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Email dan kata sandi wajib diisi." };

  // Cloudflare Turnstile: verifikasi bot server-side sebelum credential check.
  // TURNSTILE_SKIP=1 hanya dipakai uji otomatis headless (widget tidak render di browser
  // headless); di deployment nilai ini tidak pernah di-set sehingga gate selalu aktif.
  if (process.env.TURNSTILE_SKIP !== "1") {
    const hostnames = new Set(
      (process.env.TURNSTILE_HOSTNAMES ?? "")
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean),
    );
    const token = formData.get("cf-turnstile-response");
    if (typeof token !== "string" || token.length === 0 || token.length > 2048 || hostnames.size === 0) {
      return { error: "Mohon centang kotak verifikasi di bawah kata sandi." };
    }
    const fwd = (await headers()).get("x-forwarded-for");
    const clientIp = fwd?.split(",")[0]?.trim() ?? "";
    let result;
    try {
      const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(10_000),
        body: new URLSearchParams({
          secret: process.env.TURNSTILE_SECRET ?? "",
          response: token,
          remoteip: clientIp,
        }),
      });
      if (!r.ok) throw new Error(`siteverify ${r.status}`);
      result = await r.json();
    } catch {
      return { error: "Verifikasi gagal, coba lagi." };
    }
    // Widget ini dibuat tanpa action di dashboard, jadi action hanya dicek bila dipatok lewat env.
    const widgetAction = process.env.TURNSTILE_ACTION ?? "";
    if (!result.success || (widgetAction && result.action !== widgetAction) || !hostnames.has(result.hostname)) {
      return { error: "Verifikasi bot gagal, coba lagi." };
    }
  }

  const user = await prisma.users.findFirst({
    where: { email },
    include: { roles: { select: { name: true } } },
  });

  if (!user) {
    await logAudit(null, "login_gagal", "users", null, `Percobaan login oleh ${email}`);
    return { error: "Email atau kata sandi tidak cocok." };
  }
  // Akun nonaktif tetap bisa login bila kata sandi benar, jadi penyebabnya dijelaskan terpisah.
  if (!user.is_active) {
    await logAudit(null, "login_gagal", "users", user.id, `Login ditolak, akun ${email} nonaktif`);
    return { error: "Akun ini sedang dinonaktifkan oleh administrator." };
  }
  if (!(await verifyPassword(password, user.password_hash))) {
    await logAudit(null, "login_gagal", "users", user.id, `Percobaan login oleh ${email}`);
    return { error: "Email atau kata sandi tidak cocok." };
  }

  await startSession(user.id, user.roles.name);
  await logAudit(
    { id: user.id, name: user.name, email: user.email, role: user.roles.name },
    "login",
    "users",
    user.id,
    `${user.name} masuk ke aplikasi`,
  );
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get("aset_session")?.value;
  await endSession();
  if (token) await logAudit(null, "logout", "users", null, "Pengguna keluar dari aplikasi");
  redirect("/login");
}

export async function gantiKataSandi(prev: AuthState, formData: FormData): Promise<AuthState> {
  const user = await currentUser();
  if (!user) redirect("/login");

  const lama = String(formData.get("password_lama") ?? "");
  const baru = String(formData.get("password_baru") ?? "");
  const konfirmasi = String(formData.get("password_konfirmasi") ?? "");

  if (!lama || !baru || !konfirmasi) return { error: "Kata sandi lama, baru, dan konfirmasi wajib diisi." };
  if (baru.length < 8) return { error: "Kata sandi baru minimal 8 karakter." };
  if (baru !== konfirmasi) return { error: "Kata sandi baru dan konfirmasi tidak sama." };
  if (baru === lama) return { error: "Kata sandi baru tidak boleh sama dengan kata sandi lama." };

  const record = await prisma.users.findUnique({ where: { id: user.id } });
  if (!record) return { error: "Akun tidak ditemukan." };
  if (!(await verifyPassword(lama, record.password_hash))) {
    await logAudit(user, "login_gagal", "users", user.id, `Kata sandi lama salah saat ubah kata sandi oleh ${user.email}`);
    return { error: "Kata sandi lama salah." };
  }

  await prisma.users.update({ where: { id: user.id }, data: { password_hash: await hashPassword(baru) } });
  await logAudit(user, "update", "users", user.id, `Kata sandi ${user.name} diubah oleh yang bersangkutan`);
  return { ok: "Kata sandi berhasil diganti." };
}
