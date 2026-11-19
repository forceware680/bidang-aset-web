import type { PrismaClient } from "@prisma/client";

/** Kunci monitor yang berlaku sekarang: kunci aktif di database, MONITOR_TOKEN dari .env kalau tabel masih kosong. */
export async function kunciMonitorAktif(prisma: PrismaClient): Promise<string> {
  const baris = await prisma.monitor_token.findFirst({ where: { aktif: true }, select: { token: true } });
  return baris?.token ?? process.env.MONITOR_TOKEN ?? "";
}
