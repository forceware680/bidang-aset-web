import { randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

/**
 * Kunci layar monitor yang berlaku sekarang: kunci aktif di database kalau kunci sudah dibalik dari
 * Pengaturan, `MONITOR_TOKEN` dari .env kalau tabel masih kosong. Tabel `monitor_token` jadi sumber
 * kebenaran setelah rotasi pertama, jadi kunci di .env hanya jadi nilai awal.
 */
export async function kunciMonitorAktif(): Promise<string> {
  const baris = await prisma.monitor_token.findFirst({ where: { aktif: true }, select: { token: true } });
  return baris?.token ?? process.env.MONITOR_TOKEN ?? "";
}

/**
 * Kunci monitor dibandingkan tanpa waktu-bocor: panjang kunci tidak mengungkap berapa karakter yang cocok.
 * Dipakai halaman monitor dan jalur pembaruan realtime, yang keduanya terbuka tanpa masuk.
 */
export async function kunciMonitorCocok(kunci: string): Promise<boolean> {
  const sebenarnya = await kunciMonitorAktif();
  if (!sebenarnya) return false;
  const a = Buffer.from(sebenarnya);
  const b = Buffer.from(kunci);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Balas kunci monitor: kunci baru dibuat dan yang lama berhenti berlaku seketika. Baris lama disimpan
 * sebagai riwayat. Halaman monitor yang masih memakai kunci lama akan menolak sampai alamatnya diganti.
 */
export async function balasKunciMonitor(userId: string): Promise<{ id: string; token: string }> {
  const token = randomBytes(16).toString("hex");
  const [, baru] = await prisma.$transaction([
    prisma.monitor_token.updateMany({ where: { aktif: true }, data: { aktif: false } }),
    prisma.monitor_token.create({ data: { token, aktif: true, dibuat_oleh: userId }, select: { id: true, token: true } }),
  ]);
  return baru;
}

/** Keterangan kunci aktif untuk halaman Pengaturan: kapan dibuat dan oleh siapa. */
export async function keteranganKunciMonitor(): Promise<{ token: string; dibuatPada: Date | null; oleh: string | null; dariEnv: boolean }> {
  const baris = await prisma.monitor_token.findFirst({
    where: { aktif: true },
    select: { token: true, dibuat_pada: true, dibuat_oleh: true },
  });
  if (baris) {
    const pembuat = baris.dibuat_oleh
      ? await prisma.users.findUnique({ where: { id: baris.dibuat_oleh }, select: { name: true } })
      : null;
    return { token: baris.token, dibuatPada: baris.dibuat_pada, oleh: pembuat?.name ?? null, dariEnv: false };
  }
  return { token: process.env.MONITOR_TOKEN ?? "", dibuatPada: null, oleh: null, dariEnv: true };
}
