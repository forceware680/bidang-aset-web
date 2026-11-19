import { selesaikanTurnstile } from "./turnstile.mts";
/** Cek filter rentang tanggal di /surat dan /keluar: kolom ada, angka tabel cocok dengan database, paginasi membawa rentang. Jalankan: node --env-file=.env --experimental-strip-types tmp/rentang-check.mts */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const prisma = new PrismaClient();
const browser = await chromium.launch({ channel: "chrome", headless: false });
const page = await browser.newContext({ viewport: { width: 1280, height: 900 } }).then((c) => c.newPage());
page.setDefaultTimeout(60_000);
await page.goto(`${BASE}/login`);
await page.fill("#email", "petugas.aset@magelang.go.id");
await page.fill("#password", "BCed08Gkc34dF1RM");
await selesaikanTurnstile(page);
await page.click("button[type=submit]");
await page.waitForURL("**/dashboard", { timeout: 30_000 });

let gagal = 0;
const cek = (nama: string, ok: boolean, detail = "") => {
  if (!ok) gagal++;
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? `  (${detail})` : ""}`);
};

async function jumlahDariText(): Promise<number> {
  const teks = await page.locator("body").innerText();
  const m = teks.match(/(\d+) surat(?: keluar)? ditemukan/);
  if (m) return Number(m[1]);
  return teks.includes("Tidak ada surat") ? 0 : Number.NaN;
}

async function jumlahDariLayar(rute: string): Promise<number> {
  await page.goto(`${BASE}${rute}`, { waitUntil: "networkidle" });
  return jumlahDariText();
}

// Kolom rentang ada dan bisa diisi lewat pemilih tanggal.
for (const rute of ["/surat", "/keluar"]) {
  await page.goto(`${BASE}${rute}`, { waitUntil: "networkidle" });
  cek(`${rute}: kolom dari ada`, (await page.locator("#dari").count()) === 1);
  cek(`${rute}: kolom sampai ada`, (await page.locator("#sampai").count()) === 1);
  cek(`${rute}: kolom dari bertipe date`, (await page.getAttribute("#dari", "type")) === "date");
}

// /surat: rentang 2025 harus cocok dengan hitung database.
const dbMasuk2025 = Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM v_surat_aktif WHERE tanggal_terima >= '2025-01-01'::date AND tanggal_terima <= '2025-12-31'::date`)[0].n);
const layarMasuk2025 = await jumlahDariLayar("/surat?dari=2025-01-01&sampai=2025-12-31");
cek("/surat rentang 2025", layarMasuk2025 === dbMasuk2025, `layar=${layarMasuk2025} db=${dbMasuk2025}`);
// tanpa sampai: dari 2026 saja
const dbMasukDari2026 = Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM v_surat_aktif WHERE tanggal_terima >= '2026-01-01'::date`)[0].n);
const layarMasukDari2026 = await jumlahDariLayar("/surat?dari=2026-01-01");
cek("/surat dari 2026 saja", layarMasukDari2026 === dbMasukDari2026, `layar=${layarMasukDari2026} db=${dbMasukDari2026}`);
// paginasi tetap membawa rentang (rentang 2026 berisi >1 halaman)
await page.goto(`${BASE}/surat?dari=2026-01-01&sampai=2026-11-30`, { waitUntil: "networkidle" });
const tautanHalaman2 = await page.locator('a[href*="halaman=2"]').first().getAttribute("href");
cek("/surat: paginasi membawa rentang", !!tautanHalaman2 && tautanHalaman2.includes("dari=2026-01-01") && tautanHalaman2.includes("sampai=2026-11-30"), `href=${tautanHalaman2}`);

// /keluar: semua surat keluar 2025-2026 vs tanpa filter harus tetap sama jumlahnya (data keluar hanya sedikit), pakai rentang sempit yang harus nol.
const dbKeluarJan2025 = Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM v_surat_keluar_aktif WHERE tanggal_surat >= '2025-01-01'::date AND tanggal_surat <= '2025-01-31'::date`)[0].n);
const layarKeluarJan2025 = await jumlahDariLayar("/keluar?dari=2025-01-01&sampai=2025-01-31");
cek("/keluar rentang Januari 2025", layarKeluarJan2025 === dbKeluarJan2025, `layar=${layarKeluarJan2025} db=${dbKeluarJan2025}`);
const dbKeluarSemua = Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM v_surat_keluar_aktif`)[0].n);
const layarKeluarSemua = await jumlahDariLayar("/keluar");
cek("/keluar tanpa rentang", layarKeluarSemua === dbKeluarSemua, `layar=${layarKeluarSemua} db=${dbKeluarSemua}`);

async function adaKonflik(rute: string): Promise<boolean> {
  await page.goto(`${BASE}${rute}`, { waitUntil: "networkidle" });
  const teks = await page.locator("body").innerText();
  return teks.includes("Filter tidak cocok") && !teks.includes("ditemukan");
}

// Kombinasi mustahil harus gagal dengan peringatan, bukan hasil kosong diam-diam.
cek("/surat sampai < dari gagal", await adaKonflik("/surat?dari=2026-05-01&sampai=2026-04-01"));
cek("/surat tahun sebelum dari gagal", await adaKonflik("/surat?tahun=2025&dari=2026-01-01"));
cek("/surat tahun setelah sampai gagal", await adaKonflik("/surat?tahun=2027&sampai=2026-11-30"));
cek("/keluar sampai < dari gagal", await adaKonflik("/keluar?dari=2026-05-01&sampai=2026-04-01"));
cek("/surat tahun di dalam rentang tetap jalan", (await jumlahDariLayar("/surat?tahun=2026&dari=2026-01-01&sampai=2026-11-30")) === dbMasukDari2026);

// Isian ketik punya tombol X: isi → filter jalan, klik X → isian dan param hilang.
await page.goto(`${BASE}/surat`, { waitUntil: "networkidle" });
await page.fill("#tahun", "2025");
await page.waitForURL((u) => u.pathname === "/surat" && u.search.includes("tahun=2025"), { timeout: 10_000 });
cek("X hanya muncul saat isian terisi", (await page.locator('button[aria-label="Kosongkan Tahun terima"]').count()) === 1);
const dbTahun2025 = Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM v_surat_aktif WHERE EXTRACT(year FROM tanggal_terima) = 2025`)[0].n);
cek("ketik tahun 2025 memfilter", (await jumlahDariText()) === dbTahun2025, `layar=${await jumlahDariText()} db=${dbTahun2025}`);
await page.click('button[aria-label="Kosongkan Tahun terima"]');
await page.waitForURL((u) => u.pathname === "/surat" && !u.search.includes("tahun"), { timeout: 10_000 });
const dbMasukSemua = Number((await prisma.$queryRaw`SELECT count(*)::int AS n FROM v_surat_aktif`)[0].n);
cek("klik X memulihkan seluruh daftar", (await jumlahDariText()) === dbMasukSemua, `layar=${await jumlahDariText()} db=${dbMasukSemua}`);
cek("X hilang setelah dikosongkan", (await page.locator('button[aria-label="Kosongkan Tahun terima"]').count()) === 0);

// Cari (teks-ikon) juga punya X.
await page.fill("#q", "Komando");
await page.waitForURL((u) => u.search.includes("q=Komando"), { timeout: 10_000 });
cek("X muncul di kolom cari", (await page.locator('button[aria-label^="Kosongkan Cari"]').count()) === 1);
await page.click('button[aria-label^="Kosongkan Cari"]');
await page.waitForURL((u) => u.pathname === "/surat" && !u.search.includes("q="), { timeout: 10_000 });
cek("X di kolom cari mengembalikan daftar penuh", (await jumlahDariText()) === dbMasukSemua);

// /keluar: sama untuk tahun surat.
await page.goto(`${BASE}/keluar`, { waitUntil: "networkidle" });
await page.fill("#tahun", "2026");
await page.waitForURL((u) => u.pathname === "/keluar" && u.search.includes("tahun=2026"), { timeout: 10_000 });
await page.click('button[aria-label="Kosongkan Tahun surat"]');
await page.waitForURL((u) => u.pathname === "/keluar" && !u.search.includes("tahun"), { timeout: 10_000 });
cek("X di /keluar memulihkan daftar", (await jumlahDariText()) === dbKeluarSemua);

await browser.close();
await prisma.$disconnect();
console.log(gagal === 0 ? "SEMUA PASS" : `${gagal} FAIL`);
process.exit(gagal === 0 ? 0 : 1);
