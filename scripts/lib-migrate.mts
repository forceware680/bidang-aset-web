import { readFileSync } from "node:fs";

/**
 * Alat bersama untuk menjalankan file migrasi tanpa `psql` (laptop ini tidak punya psql).
 * DATABASE_URL dari .env dipakai karena aset_app tidak punya hak CREATE/ALTER.
 */
export async function buka(): Promise<InstanceType<typeof import("@prisma/client").PrismaClient>> {
  // Kunci postgres bisa datang dari environment (Coolify, skrip uji) sebelum .env dibaca.
  const dariProses = process.env.DATABASE_URL;
  if (dariProses?.includes("postgres://postgres:")) {
    const { PrismaClient } = await import("@prisma/client");
    return new PrismaClient();
  }
  const env = readFileSync(".env", "utf8");
  const url = env.match(/^DATABASE_URL="?([^"\n]+)"?$/m)?.[1];
  if (!url) throw new Error("DATABASE_URL tidak ditemukan di .env");
  if (!url.includes("postgres://postgres:")) throw new Error(`DATABASE_URL bukan akun postgres: ${url.split("@")[0]}`);
  process.env.DATABASE_URL = url;
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

/** Pisahkan per pernyataan, ignore komentar dan body fungsi yang di-quote dengan $$ */
export function pisahStatement(sql: string): string[] {
  const keluar: string[] = [];
  let buffer = "";
  let dollar = false;
  let kutip = false;
  let komentar = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (komentar) {
      buffer += c;
      if (c === "\n") komentar = false;
      continue;
    }
    if (!dollar && !kutip && c === "-" && sql[i + 1] === "-") {
      komentar = true;
      buffer += c;
      continue;
    }
    if (!kutip && c === "$" && sql[i + 1] === "$") {
      dollar = !dollar;
      buffer += "$$";
      i++;
      continue;
    }
    if (!dollar && c === "'") {
      kutip = !kutip;
      buffer += c;
      continue;
    }
    if (!dollar && !kutip && c === ";") {
      const pernyataan = buffer.trim();
      if (pernyataan) keluar.push(pernyataan);
      buffer = "";
      continue;
    }
    buffer += c;
  }
  const sisa = buffer.trim();
  if (sisa) keluar.push(sisa);
  // BEGIN/COMMIT dipertahankan: kalau dibuang, setiap pernyataan berjalan tanpa transaksi dan
  // koneksi ditutup tanpa COMMIT sehingga DDL di rollback (tabel hilang lagi setelah skrip selesai).
  return keluar.filter((s) => s.replace(/--.*$/gm, "").trim() !== "");
}

export async function jalankan(prisma: ReturnType<typeof buka>, berkas: string) {
  const pernyataan = pisahStatement(readFileSync(berkas, "utf8"));
  for (const s of pernyataan) {
    const ringkas = s.replace(/\s+/g, " ").slice(0, 70);
    try {
      await prisma.$executeRawUnsafe(s);
      console.log(`ok   ${ringkas}`);
    } catch (e) {
      console.log(`GAGAL ${ringkas}\n     ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
      throw e;
    }
  }
  console.log(`${berkas}: ${pernyataan.length} pernyataan selesai\n`);
}
