import { selesaikanTurnstile } from "./turnstile.mts";
/**
 * Pemeriksa bagian rapat pada detail surat masuk: surat yang belum terkait rapat tidak menampilkan bagian
 * Rapat, surat yang ditandai undangan rapat menampilkan formulir agenda, agenda yang dicatat masuk kalender,
 * dan waktu yang salah ditolak dengan pesan ramah.
 * Jalankan: npm run test:rapat (butuh server dev di http://localhost:3000)
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const hasil: string[] = [];
function cat(nama: string, ok: boolean, detail = "") {
  hasil.push(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? `  (${detail})` : ""}`);
}

// Select shadcn menyimpan sendiri saat item dipilih: trigger dibuka, item diklik — tidak ada tombol simpan.
async function pilihStatus(trigger: { first(): { click(): Promise<void> } }, label: string) {
  await trigger.first().click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

const browser = await chromium.launch({ channel: "chrome", headless: false });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(60000);

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const petugas = await prisma.users.findFirst({ where: { email: "petugas.aset@magelang.go.id" } });
const suratUji = await prisma.surat_masuk.findFirst({ where: { nomor_agenda: "UJ/Rapat-dari-surat" } });
if (suratUji) {
  const rapatUji = await prisma.jadwal_rapat.findMany({ where: { surat_id: suratUji.id }, select: { id: true } });
  const idRapat = rapatUji.map((r) => r.id);
  if (idRapat.length > 0) {
    await prisma.peserta_rapat.deleteMany({ where: { rapat_id: { in: idRapat } } });
    await prisma.riwayat_jadwal_rapat.deleteMany({ where: { rapat_id: { in: idRapat } } });
  }
  await prisma.jadwal_rapat.deleteMany({ where: { surat_id: suratUji.id } });
  await prisma.surat_masuk.delete({ where: { id: suratUji.id } });
}
await prisma.audit_logs.deleteMany({ where: { description: { startsWith: "Agenda Uji agenda dari surat" } } });
const surat = await prisma.surat_masuk.create({
  data: {
    nomor_agenda: "UJ/Rapat-dari-surat",
    tanggal_terima: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`),
    pengirim: "Uji rapat dari surat",
    perihal: "Uji surat yang kemudian menjadi undangan rapat",
    status_undangan_rapat: "belum",
    created_by: petugas?.id ?? null,
  },
  select: { id: true },
});
await prisma.$disconnect();

const galatConsole: string[] = [];
page.on("console", (m) => {
  // Halaman masuk belum punya sesi, jadi langganan pembaruan dijawab 401 — itu bukan galat aplikasi.
  if (m.type() === "error" && page.url().includes("/login") && m.text().includes("401")) return;
  if (m.type() === "error") galatConsole.push(`${m.text()} @ ${m.location().file}:${m.location().line} saat ${page.url()}`);
});
page.on("pageerror", (e) => galatConsole.push(`${String(e)} @ ${page.url()}`));

async function login(email: string, password: string) {
  await ctx.clearCookies();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await selesaikanTurnstile(page);
await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL("**/dashboard");
}

async function tungguTeks(teks: string | RegExp, kapan = 25000) {
  return page.getByText(teks).filter({ visible: true }).first().waitFor({ timeout: kapan }).then(() => true).catch(() => false);
}

async function tungguToast(teks: string | RegExp, timeout = 40000) {
  const batas = Date.now() + timeout;
  while (Date.now() < batas) {
    if ((await page.locator('[data-slot="toast"]').filter({ hasText: teks }).count()) > 0) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

async function keDetail() {
  await page.goto(`${BASE}/surat/${surat.id}?semua=1`);
  await page.waitForSelector("#bagian-identitas");
  await page.waitForTimeout(400);
}

await login("petugas.aset@magelang.go.id", "BCed08Gkc34dF1RM");
await keDetail();

// surat yang belum terkait rapat: bagian Rapat tidak tampil, tidak di navigasi bagian
cat("bagian rapat tidak tampil saat surat belum terkait rapat", (await page.locator("#bagian-rapat").count()) === 0);
cat("navigasi bagian tidak menyebut Rapat", (await page.locator("nav[aria-label='Bagian surat ini'] a", { hasText: "Agenda" }).count()) === 0);

// ditandai sebagai undangan rapat -> bagian Rapat muncul beserta formulir agendanya
await pilihStatus(page.locator("#status_undangan_rapat").first(), "Ada agenda");
cat("toast status undangan", await tungguToast(/Kaitan agenda surat diperbarui/));
cat("bagian rapat muncul setelah ditandai undangan", await tungguTeks(/Surat ini ditetapkan memiliki agenda/, 30000));
cat("formulir agenda rapat tersedia", (await page.locator(`#agenda-${surat.id}`).count()) > 0);

// waktu mulai belum diisi -> ditolak dengan pesan yang bisa dibaca
await page.fill(`#agenda-${surat.id}`, "Uji agenda dari surat");
await page.getByRole("button", { name: "Simpan agenda" }).click();
cat("waktu mulai kosong ditolak", await tungguToast(/Waktu mulai wajib diisi/, 20000));
cat("agenda belum tersimpan saat ditolak", (await page.locator("#bagian-rapat").first().innerText()).includes("belum dicatat"));

// waktu selesai sebelum waktu mulai -> ditolak
const mulai = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16);
const kemarin = new Date(Date.now() - 86400000).toISOString().slice(0, 16);
await page.fill(`#mulai-${surat.id}`, mulai);
await page.fill(`#selesai-${surat.id}`, kemarin);
await page.getByRole("button", { name: "Simpan agenda" }).click();
cat("waktu selesai sebelum mulai ditolak", await tungguToast(/Waktu selesai harus setelah waktu mulai/, 20000));

// agenda tersimpan: baris agenda muncul di surat dan di kalender
await page.fill(`#selesai-${surat.id}`, "");
await page.fill(`#tempat-${surat.id}`, "Ruang Rapat A");
await page.getByRole("button", { name: "Simpan agenda" }).click();
cat("toast agenda dicatat", await tungguToast(/Uji agenda dari surat dicatat dan masuk ke kalender/, 30000));
cat("baris agenda tampil di surat", await tungguTeks(/Uji agenda dari surat/, 30000));
cat("tempat agenda ikut terbaca", await tungguTeks(/di Ruang Rapat A/, 20000));

const bulan = `${mulai.slice(0, 4)}-${mulai.slice(5, 7)}`;
await page.goto(`${BASE}/rapat?bulan=${bulan}&tanggal=${mulai.slice(0, 10)}`);
await page.waitForTimeout(800);
cat("agenda tampil di kalender tanggalnya", (await page.locator("main").innerText()).includes("Uji agenda dari surat"));

// agenda dihapus dari surat -> bagian Rapat tetap ada karena surat masih berstatus undangan
await page.goto(`${BASE}/surat/${surat.id}?semua=1`);
await page.waitForSelector("#bagian-rapat");
await page.getByRole("button", { name: "Hapus agenda ini" }).first().click();
await page.getByRole("button", { name: "Hapus agenda" }).first().click();
cat("toast agenda dihapus", await tungguToast(/Agenda Uji agenda dari surat dihapus/, 30000));
cat("formulir agenda muncul lagi setelah agendanya dihapus", await tungguTeks(/Surat ini ditetapkan memiliki agenda/, 30000));

// status diubah menjadi bukan rapat -> bagian Rapat hilang kembali
await pilihStatus(page.locator("#status_undangan_rapat").first(), "Tidak ada agenda");
cat("toast status menjadi tidak", await tungguToast(/Kaitan agenda surat diperbarui/));
// Penyegar datang lewat jalur pemberitahuan, jadi kelambatannya tergantung remote database — dipoll, bukan menunggu tetap.
let rapatLenyad = false;
const batasRapat = Date.now() + 20000;
while (Date.now() < batasRapat) {
  if ((await page.locator("#bagian-rapat").count()) === 0) {
    rapatLenyad = true;
    break;
  }
  await page.waitForTimeout(250);
}
cat("bagian rapat hilang saat surat bukan rapat", rapatLenyad, `baris ${await page.locator("#bagian-rapat").count()}`);

cat("konsol bersih dari galat", galatConsole.length === 0, galatConsole.slice(0, 3).join(" | "));

await browser.close();
const gagal = hasil.filter((h) => h.startsWith("FAIL")).length;
console.log(hasil.join("\n"));
console.log(`\n${hasil.length - gagal} PASS, ${gagal} FAIL`);
if (gagal > 0) process.exitCode = 1;
