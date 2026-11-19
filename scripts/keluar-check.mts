import { selesaikanTurnstile } from "./turnstile.mts";
/**
 * Pemeriksa bagian surat keluar: daftar, form baru, nomor otomatis KL-xxx, alur status maju
 * (mundur ditolak database), lampiran, koreksi identitas, arsip/pulih, hapus permanen,
 * dashboard, rekap, ekspor Excel, dan bersihnya konsol.
 * Jalankan: npm run test:keluar (butuh server dev di http://localhost:3000 dan migrasi 004 sudah jalan)
 */
import { chromium } from "playwright";
import { existsSync, readdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const hasil: string[] = [];
function cat(nama: string, ok: boolean, detail = "") {
  hasil.push(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? `  (${detail})` : ""}`);
}

// Select shadcn menyimpan sendiri saat item dipilih: trigger dibuka, item diklik — tidak ada tombol simpan.
async function pilihStatus(trigger: { click(): Promise<void> }, label: string) {
  await trigger.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

const browser = await chromium.launch({ channel: "chrome", headless: false });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(60000);

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
// Hanya isian uji yang dibuang; surat keluar asli dibiarkan. Nomor "UJ/..." adalah data uji uji-klik dan uji-layout.
await prisma.lampiran_keluar.deleteMany({ where: { nama_asli: { startsWith: "uji-" } } });
await prisma.surat_keluar.deleteMany({ where: { OR: [{ perihal: { startsWith: "Uji " } }, { nomor_surat: { startsWith: "UJ/" } }] } });
await prisma.audit_logs.deleteMany({ where: { description: { startsWith: "Surat keluar KL-" } } });
await prisma.jenis_surat.deleteMany({ where: { nama: "Uji klasifikasi keluar" } });
await prisma.master_penerima.deleteMany({ where: { nama: { startsWith: "Uji tujuan " } } });
await prisma.$disconnect();

let tahap = "awal";
const galatConsole: string[] = [];
page.on("console", (m) => {
  // Halaman masuk belum punya sesi, jadi langganan pembaruan dijawab 401 — itu bukan galat aplikasi.
  if (m.type() === "error" && page.url().includes("/login") && m.text().includes("401")) return;
  if (m.type() === "error") galatConsole.push(`${m.text()} @ ${m.location().file}:${m.location().line} saat ${page.url()}`);
});
page.on("pageerror", (e) => galatConsole.push(`${String(e)} saat ${tahap} @ ${page.url()}`));

async function tungguTeks(teks: string | RegExp, kapan = 15000) {
  await page.getByText(teks).filter({ visible: true }).first().waitFor({ timeout: kapan });
}

async function tungguUrl(pola: RegExp, timeout = 150000) {
  const batas = Date.now() + timeout;
  while (Date.now() < batas) {
    if (pola.test(page.url())) return;
    await page.waitForTimeout(150);
  }
  throw new Error(`URL tidak cocok ${pola}; url=${page.url()}`);
}

async function tungguToast(teks: string | RegExp, timeout = 40000) {
  const batas = Date.now() + timeout;
  while (Date.now() < batas) {
    const n = await page.locator('[data-slot="toast"]').filter({ hasText: teks }).count();
    if (n > 0) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

async function toastGalat(teks: string | RegExp) {
  const chip = await page.locator('[data-slot="toast"]').filter({ hasText: teks }).first().getAttribute("data-status");
  return chip === "galat" || chip === "error" || chip === "destructive";
}

async function login(email: string, password: string) {
  await ctx.clearCookies();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await selesaikanTurnstile(page);
await page.getByRole("button", { name: "Masuk" }).click();
  await tungguTeks("Surat masuk, disposisi, dan agenda sampai hari ini.");
}

await login("petugas.aset@magelang.go.id", "BCed08Gkc34dF1RM");
cat("login petugas", page.url().endsWith("/dashboard"), page.url());

// --- navigasi sidebar ---
tahap = "navigasi";
// Sidebar desktop sudah terbuka; trigger hanya menutupnya, jadi link dicek langsung.
const tautanKeluar = page.getByRole("link", { name: /Surat Keluar/ }).first();
cat("sidebar punya entri Surat Keluar", (await tautanKeluar.count()) > 0);
await tautanKeluar.click();
await tungguUrl(/\/keluar$/);
await page.waitForSelector("#q");
cat("daftar surat keluar terbuka", page.url().endsWith("/keluar"), page.url());

// --- buat surat keluar ---
tahap = "buat surat";
await page.goto(`${BASE}/keluar/baru`);
await page.waitForSelector("#tanggal_surat");
const hari = new Date().toISOString().slice(0, 10);
await page.fill("#tanggal_surat", hari);
await page.selectOption("#tujuan", { index: 1 });
await page.fill("#perihal", "Uji jawaban undangan inventaris barang milik daerah");
await page.fill("#isi_ringkas", "Jawaban atas undangan rapat koordinasi inventaris.");
await page.getByRole("button", { name: "Simpan surat keluar" }).click();
await tungguUrl(/\/keluar\/[0-9a-f-]+\?ok=1/);
await tungguTeks("Surat keluar tersimpan dengan nomor surat otomatis");
cat("surat keluar tersimpan dengan nomor otomatis", /KL-\d{3}\/\d{4}/.test(await page.locator("#bagian-identitas").first().innerText()), await page.locator("#bagian-identitas").first().innerText());
cat("status awal draf", (await page.locator('[data-slot="badge"]').filter({ hasText: "Draf" }).count()) > 0);
const suratUrl = page.url();
const suratId = suratUrl.match(/\/keluar\/([0-9a-f-]+)/)![1];
const detail = suratUrl.replace(/\?ok=1.*/, "");
const kemarin = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

// Mengubah waktu kirim lewat panel koreksi: nilai string datetime-local, "" berarti dikosongkan.
async function ubahWaktuKirim(nilai: string) {
  await page.goto(`${detail}?keluar=ubah`);
  await page.waitForSelector("#edit_waktu_kirim");
  await page.fill("#edit_waktu_kirim", nilai);
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
}

// --- waktu kirim ditulis manual ---
tahap = "waktu kirim";
await ubahWaktuKirim(`${hari}T09:30`);
cat("toast waktu kirim manual", await tungguToast(/Identitas surat keluar diperbarui/));
await tungguUrl(new RegExp(`/keluar/${suratId}$`), 60000);
await tungguTeks(/Dikirim pada/, 30000);
cat("waktu kirim manual tampil di detail", (await page.locator("#bagian-identitas").first().innerText()).includes("09.30"));
cat("waktu manual di draf dinyatakan belum ditandai", (await page.locator("#bagian-identitas").first().innerText()).includes("belum ditandai dikirim"));

await ubahWaktuKirim(`${kemarin}T09:30`);
cat("waktu kirim sebelum tanggal surat ditolak", await page.getByText("Waktu kirim harus setelah tanggal surat.").first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false));
await page.goto(detail);
await tungguTeks(/Dikirim pada/);
cat("waktu kirim tidak berubah setelah penolakan", (await page.locator("#bagian-identitas").first().innerText()).includes("09.30"));

await ubahWaktuKirim("");
cat("toast waktu kirim dikosongkan", await tungguToast(/Identitas surat keluar diperbarui/));
await tungguUrl(new RegExp(`/keluar/${suratId}$`), 60000);
cat("detail kembali menyatakan belum dikirim", await tungguTeks(/Belum dikirim/, 30000).then(() => true).catch(() => false));

// --- status maju: draf -> dikirim -> selesai ---
tahap = "status maju";
// Bawaan detail membaca satu bagian per layar, jadi bagian status diminta lewat semua bagian.
await page.goto(`${detail}?semua=1`);
await pilihStatus(page.locator("#status_surat"), "Dikirim");
cat("toast status terkirim", await tungguToast(/Status surat keluar|dikirim/));
await page.reload();
await tungguTeks("Identitas surat keluar");
cat("badge berubah jadi Dikirim", (await page.locator('[data-slot="badge"]').filter({ hasText: "Dikirim" }).count()) > 0);
cat("waktu kirim tercatat otomatis", (await page.locator("#bagian-identitas").first().innerText()).includes("Dikirim pada") && !(await page.locator("#bagian-identitas").first().innerText()).includes("Belum dikirim"));

// Surat yang sudah dikirim tidak boleh kehilangan waktu kirimnya.
await ubahWaktuKirim("");
cat("mengosongkan waktu kirim setelah dikirim ditolak", await page.getByText("Waktu kirim tidak bisa dikosongkan").first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false));
await page.goto(detail);
await tungguTeks(/Dikirim pada/);
cat("waktu kirim tetap tersimpan setelah penolakan", !(await page.locator("#bagian-identitas").first().innerText()).includes("Belum dikirim"));

await page.goto(`${detail}?semua=1`);
await pilihStatus(page.locator("#status_surat"), "Selesai");
await tungguToast(/Status surat keluar/);
await page.reload();
await tungguTeks("Identitas surat keluar");
cat("status selesai diterima", (await page.locator('[data-slot="badge"]').filter({ hasText: "Selesai" }).count()) > 0);

// --- database menolak mundur ---
tahap = "mundur";
await page.goto(`${detail}?semua=1`);
await pilihStatus(page.locator("#status_surat"), "Draf");
cat("mundur ditolak dengan pesan ramah", await tungguToast(/gagal diubah|masih memiliki|tidak bisa kembali/));

// --- lampiran ---
tahap = "lampiran";
await page.goto(`${detail}?semua=1`);
const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF", "utf8");
await page.setInputFiles("#file", { name: "uji-surat-keluar.pdf", mimeType: "application/pdf", buffer: pdf });
await page.getByRole("button", { name: "Unggah lampiran" }).first().click();
cat("toast lampiran masuk", await tungguToast(/Lampiran tersimpan/));
// payload di-refresh setelah toast; di dev bisa beberapa detik, jadi barisnya di-poll
cat("baris lampiran terlihat", await page.locator("a", { hasText: "uji-surat-keluar.pdf" }).first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false));

const lampiran = await prisma.lampiran_keluar.findFirst({ where: { nama_asli: "uji-surat-keluar.pdf" } });
cat("lampiran masuk ke lampiran_keluar", !!lampiran);
const unduh = await ctx.request.get(`${BASE}/lampiran/${lampiran!.id}`);
cat("lampiran diunduh berlogin dengan mime asli", unduh.ok() && (unduh.headers()["content-type"] ?? "").includes("application/pdf"), `status ${unduh.status()}`);
const tanpaSesi = await browser.newContext();
const tanpaRespon = await tanpaSesi.request.get(`${BASE}/lampiran/${lampiran!.id}`);
cat("lampiran tidak bisa diunduh tanpa login", tanpaRespon.url().endsWith("/login"), `akhir ${tanpaRespon.url()}`);
await tanpaSesi.close();

await page.getByRole("button", { name: "Hapus", exact: true }).first().click();
await page.getByRole("button", { name: "Hapus lampiran" }).first().click();
cat("lampiran dihapus", await tungguToast(/Lampiran dihapus/));
const barisLampiran = page.locator("a", { hasText: "uji-surat-keluar.pdf" }).first();
const batasLenyad = Date.now() + 20000;
let lenyad = false;
while (Date.now() < batasLenyad) {
  if ((await barisLampiran.count()) === 0) {
    lenyad = true;
    break;
  }
  await page.waitForTimeout(250);
}
cat("lampiran hilang dari daftar", lenyad);

// --- koreksi identitas ---
tahap = "koreksi";
await page.goto(`${suratUrl.replace(/\?ok=1.*/, "")}?keluar=ubah`);
await page.waitForSelector("#edit_perihal");
await page.fill("#edit_perihal", "Uji jawaban undangan inventaris yang sudah dikoreksi");
await page.getByRole("button", { name: "Simpan perubahan" }).click();
cat("toast koreksi identitas", await tungguToast(/Identitas surat keluar diperbarui/));
await tungguUrl(new RegExp(`/keluar/${suratId}$`), 60000);
await tungguTeks(/Uji jawaban undangan inventaris yang sudah dikoreksi/, 30000);
cat("perihal baru tampil setelah refresh", (await page.locator("#bagian-identitas").first().innerText()).includes("yang sudah dikoreksi"));

// --- arsip dan pulih ---
tahap = "arsip";
await page.goto(`${detail}?semua=1`);
await page.getByRole("button", { name: "Arsipkan surat" }).first().click();
cat("toast arsip", await waitToastArsip());
await page.reload();
await tungguTeks("Identitas surat keluar");
cat("badge arsip tampil", (await page.locator('[data-slot="badge"]').filter({ hasText: "Arsip" }).count()) > 0);
cat("pengelolaan arsip menutup tombol ubah", (await page.getByRole("button", { name: "Ubah identitas surat" }).count()) === 0);
cat("arsip menawarkan keluar dari arsip", (await page.getByRole("button", { name: "Keluarkan dari arsip" }).count()) > 0);

await page.goto(`${detail}?semua=1`);
await page.getByRole("button", { name: "Keluarkan dari arsip" }).first().click();
cat("toast pulih dari arsip", await tungguToast(/dikeluarkan dari arsip|status .* kembali/));
await page.reload();
await tungguTeks("Identitas surat keluar");
cat("status kembali ke sebelum arsip", (await page.locator('[data-slot="badge"]').filter({ hasText: "Selesai" }).count()) > 0);

// --- daftar surat keluar: pencarian dan filter ---
tahap = "daftar";
await page.goto(`${BASE}/keluar?q=koreksi`);
await page.waitForSelector("#q");
cat("pencarian surat keluar menemukan surat", (await page.getByRole("link", { hasText: "Uji jawaban undangan inventaris yang sudah dikoreksi" }).count()) > 0);
await page.goto(`${BASE}/keluar?status=draf&q=yang%20sudah%20dikoreksi`);
await page.waitForSelector("#q");
// Surat ini sudah selesai, jadi filter draf harus menyatakan tidak ada yang cocok, bukan diam-diam menampilkan surat.
// Pencarian dibatasi pada perihal surat uji supaya data lain di daftar tidak mengganggu pemeriksaan ini.
cat("filter status draf tidak memunculkan surat selesai", await tungguTeks(/Tidak ada surat keluar yang cocok/, 20000).then(() => true).catch(() => false));

// --- modal tambah surat keluar ---
tahap = "modal";
await page.goto(`${BASE}/keluar`);
await page.waitForSelector("#q");
await page.getByRole("link", { name: "Tambah Surat Keluar" }).first().click();
await page.waitForSelector('[data-slot="dialog-content"]');
cat(
  "tambah surat keluar dibuka sebagai modal di atas daftar",
  page.url().includes("/keluar/baru") && (await page.locator("#q").isVisible()) && (await page.locator('[data-slot="dialog-content"]').isVisible()),
  page.url(),
);
await page.fill("#tanggal_surat", hari);
await page.selectOption("#tujuan", { index: 1 });
await page.fill("#perihal", "Uji modal jawaban koordinasi aset");
await page.fill("#isi_ringkas", "Jawaban dibuat dari dalam modal.");
await page.getByRole("button", { name: "Simpan surat keluar" }).click();
await tungguUrl(/\/keluar\/[0-9a-f-]+\?ok=1/);
await page.waitForTimeout(1500);
cat("dialog hilang setelah surat keluar tersimpan", (await page.locator('[data-slot="dialog-content"]').count()) === 0);
await tungguTeks("Surat keluar tersimpan dengan nomor surat otomatis");
cat("nomor otomatis dibuat dari modal", /KL-\d{3}\/\d{4}/.test(await page.locator("#bagian-identitas").first().innerText()));
await page.goto(`${BASE}/keluar/baru`);
await page.waitForSelector("#tanggal_surat");
cat("alamat /keluar/baru tetap halaman penuh tanpa dialog", (await page.locator('[data-slot="dialog-content"]').count()) === 0);

// --- dashboard & rekap ---
tahap = "dashboard";
await page.goto(`${BASE}/dashboard`);
await tungguTeks("Surat masuk dan surat keluar per bulan");
cat("dashboard punya kartu surat keluar belum dikirim", (await page.getByText("Surat keluar belum dikirim").count()) > 0);
cat("dashboard punya daftar surat keluar terbaru", (await page.getByText("Surat keluar terbaru").count()) > 0);
await page.goto(`${BASE}/rekap`);
// Surat masuk dan surat keluar di rekap berdiri sebagai grafik masing-masing, bukan dua seri dalam satu grafik.
await tungguTeks("Surat masuk per bulan");
await tungguTeks("Surat keluar per bulan");
cat("rekap punya metrik surat keluar", (await page.getByText("Surat keluar").count()) > 0);
cat("tabel rekap punya kolom surat keluar", (await page.getByRole("columnheader", { name: "Surat keluar" }).count()) > 0);
const ekspor = await ctx.request.get(`${BASE}/rekap/ekspor?tahun=${new Date().getFullYear()}`);
cat("ekspor Excel jalan", ekspor.ok(), `status ${ekspor.status()}`);

// --- hapus permanen ---
tahap = "hapus";
await page.goto(`${suratUrl.replace(/\?ok=1.*/, "")}?semua=1`);
await tungguTeks("Pengelolaan surat keluar ini");
await page.getByRole("button", { name: "Hapus surat" }).first().click();
await page.getByRole("button", { name: "Hapus permanen" }).first().click();
// Arah setelah hapus adalah daftar surat keluar — detail suratnya sendiri juga dimulai dengan /keluar/, jadi dicek persis.
const batas = Date.now() + 60000;
while (Date.now() < batas && page.url() !== `${BASE}/keluar`) await page.waitForTimeout(200);
cat("hapus surat mengarah ke daftar surat keluar", page.url() === `${BASE}/keluar`, page.url());
const sisa = await prisma.surat_keluar.findFirst({ where: { id: suratId } });
cat("surat hilang dari database", sisa === null);
await prisma.audit_logs.deleteMany({ where: { entity_id: suratId } });
await prisma.$disconnect();

// --- cetak: kop hanya muncul di media print ---
await ctx.clearCookies();
cat("console bersih dari galat", galatConsole.length === 0, galatConsole.slice(0, 3).join(" | "));
const lulus = hasil.filter((h) => h.startsWith("PASS")).length;
const gagal = hasil.filter((h) => h.startsWith("FAIL"));
console.log(hasil.join("\n"));
console.log(`\n${lulus} PASS, ${gagal.length} FAIL`);
if (gagal.length) console.log(gagal.join("\n"));
await browser.close();

// Berkas yang sudah tidak punya catatan lampiran dibuang (lampiran uji dihapus lewat UI, jadi berkasnya yatim).
if (existsSync("uploads")) {
  const fs = await import("node:fs/promises");
  const tercatat = new Set(
    [
      ...(await prisma.lampiran_surat.findMany({ select: { path_file: true } })),
      ...(await prisma.lampiran_keluar.findMany({ select: { path_file: true } })),
    ].map((l) => l.path_file),
  );
  for (const f of readdirSync("uploads")) {
    if (!tercatat.has(f)) await fs.rm(`uploads/${f}`, { force: true });
  }
}
await prisma.$disconnect();

async function waitToastArsip() {
  return tungguToast(/diarsipkan|arsip/);
}
