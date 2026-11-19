import { buka, jalankan } from "./lib-migrate.mts";

const prisma = await buka();
await jalankan(prisma, "db/migrate-013-nomor-tahan.sql");

// Uji tanpa mengubah counter: panggilan fungsi di dalam transaksi yang di-rollback.
const uji = async (tahun: number) => {
  try {
    await prisma.$transaction(async (tx) => {
      const [baris] = await tx.$queryRaw<{ nomor: string }[]>`SELECT next_nomor_agenda(${tahun}::integer) AS nomor`;
      console.log(`nomor berikutnya untuk ${tahun}: ${baris.nomor}`);
      throw new Error("rollback uji");
    });
  } catch {
    // transaksi dibatalkan, counter tidak bergerak
  }
};
await uji(2026);
await uji(2025);

const counter = await prisma.$queryRaw<{ tahun: number; nomor_terakhir: number }[]>`
  SELECT tahun, nomor_terakhir FROM agenda_counter ORDER BY tahun`;
console.log("counter setelah uji:", JSON.stringify(counter));

await prisma.$disconnect();
