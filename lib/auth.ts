import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const COOKIE = "aset_session";
const MAX_AGE_SECONDS = 12 * 60 * 60;

export type SessionPayload = { uid: string; role: string; exp: number };

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET belum diisi di .env");
  return value;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function sessionToken(payload: SessionPayload): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

function readPayload(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (typeof payload.uid !== "string" || typeof payload.role !== "string") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function startSession(uid: string, role: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, sessionToken({ uid, role, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS }), {
    maxAge: MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export type AktifUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export async function currentUser(): Promise<AktifUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const payload = readPayload(token);
  if (!payload) return null;
  const user = await prisma.users.findFirst({
    where: { id: payload.uid, is_active: true },
    include: { roles: { select: { name: true } } },
  });
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.roles.name };
}

export async function requireUser(): Promise<AktifUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export function bolehMengubah(role: string): boolean {
  return role === "Administrator" || role === "Petugas Agenda";
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function logAudit(
  user: AktifUser | null,
  action: string,
  entityType: string,
  entityId: string | null,
  description: string,
): Promise<void> {
  await prisma.audit_logs.create({
    data: {
      user_id: user?.id ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      description,
    },
  });
}
