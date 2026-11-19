import { selesaikanTurnstile } from "./turnstile.mts";
/**
 * Pemeriksa modal "tambah surat": dibuka dari daftar lewat intercepting route, daftar tetap terlihat
 * di latar, galat validasi server tampil di dalam dialog, simpan membawa ke halaman detail dan dialog
 * hilang, Batal/Escape/tombol tutup kembali ke daftar, dan di HP dialognya sheet bawah tanpa overflow.
 * Alamat /surat/baru dan /keluar/baru tetap halaman penuh saat dibuka langsung.
 * Jalankan: npm run test:modal (butuh server dev di http://localhost:3000)
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const hasil: string[] = [];
function cat(nama: string, ok: boolean, detail = "") {
  const baris = `${ok ? "PASS" : "FAIL"} ${nama}${detail ? `  (${detail})` : ""}`;
  hasil.push(baris);
  console.log(baris);
}
async function tungguUrl(uji: (u: string) => boolean, label: string, batas = 40000) {
  const akhir = Date.now() + batas;
  while (Date.now() < akhir) {
    if (uji(page.url())) {
      cat(label, true, page.url());
      return true;
    }
    await page.waitForTimeout(150);
  }
  cat(label, false, `url=${page.url()}`);
  return false;
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
await prisma.surat_keluar.deleteMany({ where: { OR: [{ perihal: { startsWith: "Uji modal " } }, { nomor_surat: { startsWith: "UJ/MODAL" } }] } });
const suratUji = await prisma.surat_masuk.findFirst({ where: { deleted_at: null }, orderBy: { created_at: "desc" } });

const browser = await chromium.launch({ channel: "chrome", headless: false });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(60000);
const galatConsole: string[] = [];
page.on("console", (m) => {
  // Halaman masuk belum punya sesi, jadi langganan pembaruan dijawab 401 — itu bukan galat aplikasi.
  if (m.type() === "error" && page.url().includes("/login") && m.text().includes("401")) return;
  if (m.type() === "error") galatConsole.push(m.text());
});
page.on("pageerror", (e) => galatConsole.push(String(e)));

await ctx.clearCookies();
await page.goto(`${BASE}/login`);
await page.fill("#email", "petugas.aset@magelang.go.id");
await page.fill("#password", "BCed08Gkc34dF1RM");
await selesaikanTurnstile(page);
await page.getByRole("button", { name: "Masuk" }).click();
await page.waitForURL(/\/dashboard/);

// --- modal surat masuk ---
await page.goto(`${BASE}/surat`);
await page.waitForSelector("#q");
await page.waitForTimeout(600);
await page.getByRole("link", { name: "Tambah Surat" }).first().click();
await page.waitForSelector('[data-slot="dialog-content"]');
cat("modal surat masuk terbuka di atas daftar", await page.locator('[data-slot="dialog-content"]').isVisible() && (await page.locator("#q").isVisible()));
await page.waitForSelector("#tanggal_terima");
await page.fill("#tanggal_terima", new Date().toISOString().slice(0, 10));
await page.selectOption("#pengirim", "Sekretariat Daerah");
await page.fill("#perihal", "Uji modal undangan koordinasi aset");
await page.check('input[name="undangan"][value="ya"]');
await page.getByRole("button", { name: "Simpan surat" }).click();
await page.waitForTimeout(2500);
const galatModal = await page.locator('[data-slot="dialog-content"]').filter({ hasText: "Judul agenda wajib" }).count();
cat("galat validasi server tampil di dalam modal", galatModal > 0, JSON.stringify(await page.locator('[data-slot="dialog-content"] [data-slot="alert"] ').allInnerTexts()));
await page.fill("#rapat_agenda", "Koordinasi inventaris barang milik daerah");
await page.fill("#rapat_mulai", "2026-11-20T10:00");
await page.getByRole("button", { name: "Simpan surat" }).click();
await tungguUrl((u) => /\/surat\/[0-9a-f-]{36}/.test(u), "simpan dari modal membawa ke detail surat");
console.log(
  "DEBUG setelah simpan:",
  JSON.stringify(await page.evaluate(() => ({ url: location.pathname, dialog: document.querySelectorAll('[data-slot="dialog-content"]').length, h1: document.querySelector("h1")?.textContent ?? null, identitas: !!document.querySelector("#bagian-identitas") }))),
);
await page.waitForSelector("#bagian-identitas", { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);
cat("modal hilang setelah surat tersimpan", (await page.locator('[data-slot="dialog-content"]').count()) === 0, `dialog ${(await page.locator('[data-slot="dialog-content"]').count())}`);
const tersimpan = await prisma.surat_masuk.findFirst({ where: { perihal: "Uji modal undangan koordinasi aset" } });
cat("surat dari modal masuk database", !!tersimpan);
await prisma.jadwal_rapat.deleteMany({ where: { surat_id: tersimpan!.id } });
await prisma.surat_masuk.delete({ where: { id: tersimpan!.id } });
await prisma.audit_logs.deleteMany({ where: { description: { contains: "Uji modal" } } });

// --- modal tertutup lewat Batal tanpa menyimpan ---
await page.goto(`${BASE}/surat`);
await page.waitForSelector("#q");
await page.waitForTimeout(600);
await page.getByRole("link", { name: "Tambah Surat" }).first().click();
await page.waitForSelector('[data-slot="dialog-content"]');
await page.fill("#perihal", "Uji modal yang dibatalkan");
await page.getByRole("button", { name: "Batal" }).click();
await page.waitForTimeout(2000);
cat("Batal di modal menutup dan kembali ke daftar", (await page.locator('[data-slot="dialog-content"]').count()) === 0 && page.url().endsWith("/surat"), page.url());
cat("Batal tidak menyimpan surat", (await prisma.surat_masuk.findFirst({ where: { perihal: "Uji modal yang dibatalkan" } })) === null);

// --- Escape dan tombol tutup ---
await page.getByRole("link", { name: "Tambah Surat" }).first().click();
await page.waitForSelector('[data-slot="dialog-content"]');
await page.keyboard.press("Escape");
await page.waitForTimeout(1500);
cat("Escape menutup modal surat masuk", (await page.locator('[data-slot="dialog-content"]').count()) === 0 && page.url().endsWith("/surat"), page.url());
await page.getByRole("link", { name: "Tambah Surat" }).first().click();
await page.waitForSelector('[data-slot="dialog-content"]');
await page.getByRole("button", { name: "Tutup" }).click();
await page.waitForTimeout(1500);
cat("tombol tutup menutup modal surat masuk", (await page.locator('[data-slot="dialog-content"]').count()) === 0 && page.url().endsWith("/surat"), page.url());

// --- modal surat keluar ---
await page.goto(`${BASE}/keluar`);
await page.waitForSelector("#q");
await page.waitForTimeout(600);
await page.getByRole("link", { name: "Tambah Surat Keluar" }).first().click();
await page.waitForSelector('[data-slot="dialog-content"]');
cat("modal surat keluar terbuka di atas daftar", await page.locator('[data-slot="dialog-content"]').isVisible() && (await page.locator("#q").isVisible()));
await page.waitForSelector("#tanggal_surat");
await page.fill("#tanggal_surat", new Date().toISOString().slice(0, 10));
await page.selectOption("#tujuan", "Sekretariat Daerah");
await page.fill("#nomor_surat", "UJ/MODAL-1");
await page.fill("#perihal", "Uji modal balasan undangan inventaris");
if (suratUji) await page.selectOption("#surat_asal_id", suratUji.id);
await page.getByRole("button", { name: "Simpan surat keluar" }).click();
await tungguUrl((u) => /\/keluar\/[0-9a-f-]{36}/.test(u), "simpan dari modal surat keluar membawa ke detail");
const keluarSimpan = await prisma.surat_keluar.findFirst({ where: { nomor_surat: "UJ/MODAL-1" } });
cat("surat keluar dari modal masuk database", !!keluarSimpan);
if (keluarSimpan) await prisma.surat_keluar.delete({ where: { id: keluarSimpan.id } });
await prisma.audit_logs.deleteMany({ where: { description: { contains: "UJ/MODAL" } } });

// --- HP: FAB membuka modal surat keluar sebagai sheet bawah ---
await page.setViewportSize({ width: 375, height: 720 });
await page.goto(`${BASE}/keluar`);
await page.waitForSelector("#q");
await page.waitForTimeout(600);
await page.locator("[data-fab]").first().click();
await page.waitForSelector('[data-slot="dialog-content"]');
const sheet = await page.evaluate(() => {
  const el = document.querySelector('[data-slot="dialog-content"]')!;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, dariBawah: window.innerHeight - r.bottom };
});
cat("dialog HP adalah sheet bawah melebar penuh", sheet.w >= 375 && sheet.dariBawah < 8, JSON.stringify(sheet));
const lebih = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
cat("HP tanpa overflow saat modal terbuka", lebih <= 1, `selisih ${lebih}px`);
const kontrol = await page.evaluate(() =>
  [...document.querySelectorAll('[data-slot="dialog-content"] [data-slot="button"], [data-slot="dialog-content"] [data-slot="input"], [data-slot="dialog-content"] [data-slot="native-select"], [data-slot="dialog-content"] [data-slot="textarea"]')]
    .filter((el) => el.getBoundingClientRect().width > 0)
    .map((el) => Math.round(el.getBoundingClientRect().height)),
);
cat("target sentuh dalam dialog HP >= 44px", kontrol.length > 0 && kontrol.every((h) => h >= 44), kontrol.join(", "));
await page.screenshot({ path: "tmp/modal-keluar-375.png" });
await page.getByRole("button", { name: "Tutup" }).click();
await page.waitForTimeout(1500);
cat("tombol tutup bekerja di HP", (await page.locator('[data-slot="dialog-content"]').count()) === 0 && page.url().endsWith("/keluar"), page.url());

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${BASE}/surat`);
await page.waitForSelector("#q");
await page.waitForTimeout(600);
await page.getByRole("link", { name: "Tambah Surat" }).first().click();
await page.waitForSelector('[data-slot="dialog-content"]');
await page.screenshot({ path: "tmp/modal-surat-1280.png" });

cat("console bersih dari galat", galatConsole.length === 0, galatConsole.slice(0, 3).join(" | "));
const lulus = hasil.filter((h) => h.startsWith("PASS")).length;
const gagal = hasil.filter((h) => h.startsWith("FAIL"));
console.log(hasil.join("\n"));
console.log(`\n${lulus} PASS, ${gagal.length} FAIL`);
if (gagal.length) console.log(gagal.join("\n"));
await browser.close();
await prisma.$disconnect();
