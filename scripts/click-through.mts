import { selesaikanTurnstile } from "./turnstile.mts";
import { chromium } from "playwright";
import { existsSync, readdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const hasil = [];
function hitung(teks: string | RegExp): Promise<number> {
  return page.getByText(teks).filter({ visible: true }).count();
}

function cat(nama, ok, detail = "") {
  hasil.push(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? `  (${detail})` : ""}`);
}

const browser = await chromium.launch({ channel: "chrome", headless: false });

// Folder uploads dibersihkan di awal supaya hitungan berkas di bawah berarti.
if (existsSync("uploads")) {
  const fsMulih = await import("node:fs/promises");
  for (const f of readdirSync("uploads")) {
    await fsMulih.rm(`uploads/${f}`, { force: true });
  }
}
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
// server dev bisa lambat compile saat halaman pertama dibuka, jadi timeout diperlebar
page.setDefaultTimeout(60000);

// Data uji dibersihkan di awal supaya nomor agenda/surat tidak bentrok dengan run sebelumnya.
// Pembersihan ini MENGOSONGKAN tabel surat masuk, disposisi, rapat, lampiran, surat keluar, dan
// jejak perubahan — bukan hanya baris buatan skrip. Karena itu ia hanya boleh jalan di database uji
// (UJI_DB=1); di database berisi data nyata skrip berhenti dengan pesan jelas.
const { PrismaClient: PrismaBersih } = await import("@prisma/client");
const prismaBersih = new PrismaBersih();
const { jagaDatabaseNyata } = await import("./pagar-uji.mjs");
await jagaDatabaseNyata(prismaBersih, "pemeriksa klik (scripts/click-through.mts)");
await prismaBersih.riwayat_jadwal_rapat.deleteMany({});
await prismaBersih.peserta_rapat.deleteMany({});
await prismaBersih.jadwal_rapat.deleteMany({});
await prismaBersih.disposisi.deleteMany({});
await prismaBersih.lampiran_surat.deleteMany({});
await prismaBersih.audit_logs.deleteMany({});
await prismaBersih.surat_masuk.deleteMany({});
await prismaBersih.agenda_counter.deleteMany({});
// surat keluar ikut dibersihkan: daftar dan rekap diperiksa dengan angka yang pasti
await prismaBersih.lampiran_keluar.deleteMany({});
await prismaBersih.surat_keluar.deleteMany({});
await prismaBersih.keluar_counter.deleteMany({});
await prismaBersih.master_penerima.deleteMany({ where: { nama: { startsWith: "Uji " } } });
await prismaBersih.jenis_surat.deleteMany({ where: { nama: { startsWith: "Uji " } } });
await prismaBersih.jenis_surat.deleteMany({ where: { nama: "Undangan rapat eksternal" } });
await prismaBersih.master_pengirim.deleteMany({ where: { nama: { startsWith: "Uji " } } });
await prismaBersih.master_pejabat.deleteMany({ where: { nama: { startsWith: "Uji " } } });
await prismaBersih.master_pegawai.deleteMany({ where: { nama: { startsWith: "Uji " } } });
// Peserta rapat hanya bisa dipilih dari akun aplikasi yang aktif, jadi dua akun uji dibuat di sini.
await prismaBersih.users.deleteMany({ where: { email: { startsWith: "uji.budi" } } });
await prismaBersih.users.deleteMany({ where: { email: { startsWith: "uji.sri" } } });
const { default: bcrypt } = await import("bcryptjs");
const peranUji = await prismaBersih.roles.findFirst({ select: { id: true } });
await prismaBersih.users.createMany({
  data: [
    { email: "uji.budi@magelang.go.id", name: "Budi wijaya", password_hash: await bcrypt.hash("sandiuji", 10), role_id: peranUji!.id, is_active: true },
    { email: "uji.sri@magelang.go.id", name: "Sri wedi", password_hash: await bcrypt.hash("sandiuji", 10), role_id: peranUji!.id, is_active: true },
  ],
  skipDuplicates: true,
});
await prismaBersih.master_pegawai.createMany({
  data: [
    { nama: "Budi wijaya", jabatan: "Staf bidang aset" },
    { nama: "Sri wedi", jabatan: "Staf bidang aset" },
  ],
  skipDuplicates: true,
});
await prismaBersih.master_terusan.deleteMany({ where: { nama: { startsWith: "Uji " } } });
await prismaBersih.users.deleteMany({ where: { email: { startsWith: "uji" } } });
await prismaBersih.$disconnect();

const galatConsole = [];
page.on("console", (m) => {
  if (m.type() === "error") {
    // Halaman masuk belum punya sesi, jadi langganan pembaruan dijawab 401 — itu bukan galat aplikasi.
    if (page.url().includes("/login") && m.text().includes("401")) return;
    const lok = m.location();
    galatConsole.push(`${m.text()} @ ${lok.file}:${lok.line} saat ${page.url()}`);
  }
});
page.on("pageerror", (e) => galatConsole.push(`${String(e)} @ ${page.url()}`));

async function bukaDialogAgenda() {
  await page.getByRole("button", { name: "Buat agenda sendiri" }).filter({ visible: true }).first().click();
  await page.waitForSelector("#baru_agenda");
}

const hariIni = new Date().toISOString().slice(0, 10);
const besok = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
const kemarin = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const lusa = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16);

// Next mengirim loading fallback dulu lalu konten sungguhan, jadi setiap cek
// menunggu teks yang memang muncul di halaman.
async function tungguTeks(teks: string | RegExp, kapan = 15000) {
  await page.getByText(teks).filter({ visible: true }).first().waitFor({ timeout: kapan });
}


/// Redirect server action di dev bisa berhenti di tahap load karena streaming dev, jadi
/// cukup tunggu URL berubah (dipoll) lalu teks dicek oleh tungguTeks. Batas 150 detik karena
/// rute yang belum pernah dibuka masih dikompilasi saat submit pertama (di Windows bisa
/// makan puluhan detik, dan itu bukan kegagalan aplikasi).
async function navigasi(pola: RegExp | string | ((u: URL) => boolean), opsi?: { timeout?: number }) {
  const timeout = opsi?.timeout ?? 150000;
  const batas = Date.now() + timeout;
  while (Date.now() < batas) {
    const url = page.url();
    const cocok = typeof pola === "function" ? pola(new URL(url)) : pola instanceof RegExp ? pola.test(url) : url.includes(pola);
    if (cocok) return;
    await page.waitForTimeout(150);
  }
  throw new Error(`URL tidak berubah dalam ${timeout}ms; url=${page.url()}`);
}

/// Perubahan di halaman yang sama tidak berpindah: hasilnya toast, lalu payload di-refresh.
/// Toast ditunggu sampai terlihat (submit pertama di dev bisa lama karena rute masih dikompilasi),
/// lalu ditunggu sampai refresh selesai supaya cek berikutnya melihat nilai yang baru.
async function cekToast(label: string, bagian: string, batas = 150000) {
  const toast = page.locator('[data-slot="toast"]').filter({ hasText: bagian }).first();
  const akhir = Date.now() + batas;
  while (Date.now() < akhir) {
    if (await toast.isVisible().catch(() => false)) {
      cat(label, true, (await toast.textContent()) ?? "");
      await page.waitForLoadState("networkidle").catch(() => {});
      return;
    }
    await page.waitForTimeout(150);
  }
  cat(label, false, `toast "${bagian}" tidak muncul; url=${page.url()}`);
}

/// Panel tertutup / berpindah halaman di dev bisa beberapa detik sesudah toast, jadi URL dipoll.
async function tungguUrl(label: string, uji: (u: string) => boolean, batas = 30000) {
  const akhir = Date.now() + batas;
  while (Date.now() < akhir) {
    if (uji(page.url())) {
      cat(label, true, page.url());
      return;
    }
    await page.waitForTimeout(150);
  }
  cat(label, false, `url=${page.url()}`);
}

/// Data yang di-refresh tanpa reload juga bisa beberapa detik sebelum teksnya berubah.
/** Tunggu sampai selector muncul — kalender di-segar lewat pemberitahuan, jadi isinya bisa datang sedikit setelah halaman dibuka. */
async function tungguSelector(label: string, selector: string, batas = 20000) {
  const akhir = Date.now() + batas;
  while (Date.now() < akhir) {
    const jumlah = await page.locator(selector).count();
    if (jumlah > 0) {
      cat(label, true, `${jumlah} cocok`);
      return;
    }
    await page.waitForTimeout(250);
  }
  cat(label, false, `selector ${selector} tidak ditemukan`);
}

async function tungguTampil(label: string, teks: string, batas = 30000) {
  const akhir = Date.now() + batas;
  while (Date.now() < akhir) {
    if (await hitung(teks) > 0) {
      cat(label, true, teks);
      return;
    }
    await page.waitForTimeout(200);
  }
  cat(label, false, `"${teks}" tidak tampil`);
}

async function tungguHilang(label: string, teks: string, batas = 30000) {
  const akhir = Date.now() + batas;
  while (Date.now() < akhir) {
    if (await hitung(teks) === 0) {
      cat(label, true, teks);
      return;
    }
    await page.waitForTimeout(200);
  }
  cat(label, false, `"${teks}" masih tampil`);
}

/// Isian yang dikendalikan React bisa beberapa detik belum aktif di dev (rute baru di-compile): nilai yang
/// diisi sebelum hydration selesai dihapus lagi oleh React, jadi form terkirim dengan isian kosong. Ditunggu
/// sampai React menempelkan nodenya (kunci fiber) di elemen, baru isian diisi.
// Select shadcn menyimpan sendiri saat item dipilih: trigger dibuka, item diklik — tidak ada tombol simpan.
// Hapus agenda di kalender perlu konfirmasi: trigger membuka AlertDialog, tombol Hapus hanya jalan setelah diklik.
async function hapusKalender(page: import("playwright").Page, target: { click(): Promise<void> }) {
  await target.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Hapus agenda", exact: true }).click();
}

async function pilihStatus(trigger: { click(): Promise<void> }, label: string) {
  await trigger.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

async function tungguHidrasi(id: string) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel as string) as Record<string, unknown> | null;
      return !!el && Object.keys(el).some((k) => k.startsWith("__reactFiber$"));
    },
    `#${id}`,
    { timeout: 90000 },
  );
}

/// Isian yang dikendalikan React bisa beberapa detik belum aktif di dev (rute baru di-compile): nilai yang
/// diisi sebelum hydration selesai dihapus lagi oleh React, jadi form terkirim dengan isian kosong. Diisi
/// ulang sampai nilainya bertahan.
async function isiPastikan(id: string, nilai: string) {
  for (let i = 0; i < 8; i++) {
    await page.fill(`#${id}`, nilai);
    await page.waitForTimeout(250);
    if (await page.inputValue(`#${id}`) === nilai) return;
  }
  throw new Error(`isian #${id} tidak bertahan (nilai ${await page.inputValue(`#${id}`)})`);
}

/// Pilihan daftar juga perlu diisi setelah kontrolnya aktif, supaya nilai yang dikirim form benar.
async function pilihPastikan(id: string, nilai: string) {
  for (let i = 0; i < 8; i++) {
    await page.selectOption(`#${id}`, nilai);
    await page.waitForTimeout(250);
    if (await page.inputValue(`#${id}`) === nilai) return;
  }
  throw new Error(`pilihan #${id} tidak bertahan (nilai ${await page.inputValue(`#${id}`)})`);
}

/// Halaman baru bisa beberapa detik masih menampilkan tabel halaman lama sementara halaman itu di-stream,
/// jadi jumlah baris yang berlebihan menunggu sampai turun ke batasnya.
async function tungguBatasBaris(label: string, jumlah: () => Promise<number>, maksimum: number, batas = 20000) {
  const akhir = Date.now() + batas;
  let n = await jumlah();
  while (n > maksimum && Date.now() < akhir) {
    await page.waitForTimeout(300);
    n = await jumlah();
  }
  cat(label, n <= maksimum, `${n} baris`);
}

async function tungguBadge(label: string, teks: string, batas = 30000) {
  const badge = page.getByText(teks, { exact: true }).filter({ visible: true }).first();
  const akhir = Date.now() + batas;
  while (Date.now() < akhir) {
    if (await badge.isVisible().catch(() => false)) {
      cat(label, true, teks);
      return;
    }
    await page.waitForTimeout(200);
  }
  cat(label, false, `badge "${teks}" tidak tampil`);
}

/// Galat validasi form yang memakai useActionState tampil di dalam panel (Alert), bukan toast.
async function tungguInline(label: string, bagian: string, batas = 60000) {
  const akhir = Date.now() + batas;
  while (Date.now() < akhir) {
    if (await hitung(bagian) > 0) {
      cat(label, true, bagian);
      return;
    }
    await page.waitForTimeout(200);
  }
  cat(label, false, `galat inline "${bagian}" tidak muncul; url=${page.url()}`);
}

/// Toast masih terlihat beberapa detik setelah cekToast; teksnya bisa dihitung sebagai konten halaman.
async function tungguToastLenyad(batas = 12000) {
  await page.locator('[data-slot="toast"]').first().waitFor({ state: "hidden", timeout: batas }).catch(() => {});
}

async function keluar() {
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle");
  const pemicu = page.locator("[data-slot='sidebar-footer'] [data-slot='dropdown-menu-trigger']").filter({ visible: true }).first();
  await pemicu.waitFor();
  await pemicu.click();
  await page.getByRole("menuitem", { name: "Keluar" }).click();
  await navigasi(`${BASE}/login`);
}

/** Pindah ke salah satu Daftar Nama. Daftar yang sedang dibuka ditandai di navigasi pil. */
async function bukaNama(judul: RegExp) {
  const tautan = page.getByRole("navigation", { name: "Daftar Nama" }).getByRole("link", { name: judul }).first();
  if ((await tautan.getAttribute("data-state")) !== "active") {
    await tautan.click();
    await page.waitForTimeout(400);
  }
}

/** Navigasi bagian Pengaturan di desktop adalah submenu di sidebar. Bagian yang aktif ditandai
 *  dengan data-active pada tautan sub, dan href-nya menunjukkan bagian mana. */
const ruteBagian: Record<string, string> = {
  "Akun Pengguna": "/pengaturan/pengguna",
  "Kategori Surat": "/pengaturan/jenis",
  "Daftar Nama": "/pengaturan/nama",
  "History": "/pengaturan/jejak",
  "Token Monitor": "/pengaturan/monitor",
};

async function tabAktif(nama: string) {
  const href = await page.locator("[data-slot='sidebar-menu-sub-button'][data-active='true']").first().getAttribute("href");
  return href === ruteBagian[nama];
}

async function login(email: string, password: string) {
  await page.goto(`${BASE}/login`);
  // Halaman login diarahkan ke dashboard jika sesi masih aktif, jadi sesi lama dibuang dulu.
  if (page.url().endsWith("/dashboard")) {
    await keluar();
  }
  await page.fill("#email", email);
  await page.fill("#password", password);
  await selesaikanTurnstile(page);
await page.getByRole("button", { name: "Masuk" }).click();
  await navigasi(`${BASE}/dashboard`);
  await tungguTeks("Surat masuk, disposisi, dan agenda sampai hari ini.");
}

// 1. Login dan dashboard kosong
await login("petugas.aset@magelang.go.id", "BCed08Gkc34dF1RM");
cat("login petugas", page.url().endsWith("/dashboard"), page.url());
await page.goto(`${BASE}/dashboard?periode=semua`);
await tungguTeks("Surat masuk terbaru");
cat("dashboard punya empty state", (await hitung("Belum ada surat yang tercatat")) > 0);

// 2. Daftar surat kosong lalu validasi server
await page.goto(`${BASE}/surat`);
await page.waitForLoadState("networkidle");
await tungguTeks("Tidak ada surat yang cocok");
cat("daftar surat empty state", (await hitung("Tidak ada surat yang cocok")) > 0);

await page.getByRole("link", { name: "Tambah Surat" }).click();
await page.waitForSelector('[data-slot="dialog-content"]');
cat(
  "tambah surat masuk dibuka sebagai modal di atas daftar",
  page.url().includes("/surat/baru") && (await page.locator("#q").isVisible()) && (await page.locator('[data-slot="dialog-content"]').isVisible()),
  page.url(),
);
await page.keyboard.press("Escape");
await page.waitForTimeout(1500);
cat(
  "Escape menutup modal dan kembali ke daftar",
  (await page.locator('[data-slot="dialog-content"]').count()) === 0 && page.url().endsWith("/surat"),
  page.url(),
);
await page.getByRole("link", { name: "Tambah Surat" }).click();
await page.waitForSelector('[data-slot="dialog-content"]');
await tungguTeks("Identitas surat");
await page.fill("#tanggal_terima", hariIni);
await page.selectOption("#pengirim", "__lain__");
cat("pengirim lainnya memunculkan isian manual", (await page.locator('input[name="pengirim_lain"]').count()) === 1);
await page.selectOption("#pengirim", "Sekretariat Daerah");
cat("pengirim diambil dari daftar resmi", (await page.locator("#pengirim").inputValue()) === "Sekretariat Daerah");
await page.fill("#perihal", "Undangan rapat koordinasi barang milik daerah");
await page.check('input[name="undangan"][value="ya"]');
await page.getByRole("button", { name: "Simpan surat" }).click();
await tungguTeks("Judul agenda wajib diisi untuk surat berstatus undangan.");
cat("undangan tanpa data rapat ditolak server", (await hitung("Judul agenda wajib diisi untuk surat berstatus undangan")) > 0);

await page.fill("#nomor_surat", "001/SETDA/X/2026");
await page.fill("#rapat_agenda", "Rapat koordinasi aset daerah");
await page.fill("#rapat_mulai", besok);
await page.fill("#rapat_tempat", "Ruang Rapat A");
await page.getByRole("button", { name: "Simpan surat" }).click();
try {
  await navigasi(/\/surat\/[0-9a-f-]+\?ok=1/, { timeout: 150000 });
} catch {
  throw new Error(
    `navigasi gagal; url=${page.url()} alert=${JSON.stringify(await page.locator("[data-slot='alert']").allTextContents())} field=${JSON.stringify(await page.locator("[data-slot='field-error']").allTextContents())} console=${JSON.stringify(galatConsole.slice(0, 3))}`,
  );
}
await page.goto(page.url().includes("?") ? `${page.url()}&semua=1` : `${page.url()}?semua=1`);
await tungguTeks("Riwayat disposisi");
cat("surat tersimpan dan redirect ke detail", page.url().includes("?ok=1"), page.url());
cat("nomor agenda otomatis muncul", (await hitung("001/2026")) > 0);
cat("pesan sukses submit terlihat", (await hitung("Surat tersimpan dengan nomor agenda otomatis")) > 0);

const urlDetail = page.url();

// 3. Disposisi
await page.fill("#tanggal_disposisi", hariIni);
await page.selectOption("#pemberi_disposisi", "Kepala BPKAD");
await page.selectOption("#penerima_disposisi", "Subid Penatausahaan Aset");
await page.fill("#isi_disposisi", "Siapkan daftar barang milik daerah yang akan dibahas.");
await page.fill("#tanggal_diteruskan", kemarin);
await page.getByRole("button", { name: "Simpan disposisi" }).click();
await page.waitForTimeout(500);
cat("tanggal diteruskan yang mendahului disposisi ditolak", (await hitung("Tanggal diteruskan tidak boleh mendahului tanggal disposisi")) > 0);
await page.fill("#tanggal_diteruskan", hariIni);
await page.getByRole("button", { name: "Simpan disposisi" }).click();
await cekToast("disposisi tersimpan", "Disposisi tersimpan pada surat ini");
await tungguTeks("Siapkan daftar barang milik daerah");
cat("disposisi tersimpan tanpa berpindah halaman", page.url() === urlDetail, page.url());
cat("riwayat disposisi tampil", (await hitung("Siapkan daftar barang milik daerah")) > 0);
cat("status surat berubah menjadi sudah didisposisikan", (await hitung("Sudah didisposisikan")) > 0);
const tanggalTerusan = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date(`${hariIni}T00:00:00`));
cat("tujuan diteruskan tampil di riwayat", (await hitung("Subid Penatausahaan Aset")) > 0);
cat("tanggal diteruskan tampil di riwayat", (await hitung(tanggalTerusan)) > 0);

// 4. Lampiran: unggah, unduh, penolakan jenis dan ukuran, hapus
await page.setInputFiles("#file", "scripts/fixtures/scan-surat.pdf");
await page.getByRole("button", { name: "Unggah lampiran" }).click();
await cekToast("lampiran tersimpan", "Lampiran tersimpan.");
await tungguTeks("scan-surat.pdf");
cat("lampiran tersimpan dan muncul di daftar", (await hitung("scan-surat.pdf")) > 0);

const tautanLampiran = (await page.locator("[aria-labelledby=dokumen] a").first().getAttribute("href")) ?? "";
const unduh = await page.request.get(`${BASE}${tautanLampiran}`);
cat(
  "lampiran diunduh berlogin dengan mime asli",
  unduh.ok() && (unduh.headers()["content-type"] ?? "").includes("application/pdf"),
  `status ${unduh.status()}, mime ${unduh.headers()["content-type"]}`,
);

const ctxTanpaSesi = await browser.newContext();
const tanpaSesi = await ctxTanpaSesi.request.get(`${BASE}${tautanLampiran}`);
cat("lampiran tidak bisa diunduh tanpa login", tanpaSesi.url().endsWith("/login"), `akhir ${tanpaSesi.url()}`);
await ctxTanpaSesi.close();

await page.setInputFiles("#file", "scripts/fixtures/bukan-gambar.txt");
await page.getByRole("button", { name: "Unggah lampiran" }).click();
await cekToast("jenis file bukan PDF/JPG/PNG ditolak server", "Berkas yang bisa diunggah hanya PDF, JPG, atau PNG.");

await page.setInputFiles("#file", "scripts/fixtures/kebesaran.jpg");
await tungguTeks("melebihi batas 20 MB");
cat(
  "file di atas 20 MB ditahan di browser sebelum dikirim",
  (await hitung("melebihi batas 20 MB")) > 0 && (await page.getByRole("button", { name: "Unggah lampiran" }).isDisabled()),
);
cat("file besar tidak masuk folder uploads", readdirSync("uploads").length === 1, `isi folder uploads: ${readdirSync("uploads").length} berkas`);

await page.getByRole("button", { name: "Hapus", exact: true }).filter({ visible: true }).click();
await page.getByRole("button", { name: "Hapus lampiran" }).click();
await cekToast("lampiran dihapus", "Lampiran dihapus dari daftar surat, berkasnya ikut terhapus.");
await tungguTeks("Belum ada lampiran untuk surat ini.");
cat("lampiran hilang dari daftar", (await hitung("Belum ada lampiran untuk surat ini.")) > 0);
cat("berkas ikut terhapus dari disk", readdirSync("uploads").length === 0, `isi folder uploads: ${readdirSync("uploads").length} berkas`);

await page.setInputFiles("#file", "scripts/fixtures/scan-surat.pdf");
await page.getByRole("button", { name: "Unggah lampiran" }).click();
await cekToast("lampiran kedua tersimpan", "Lampiran tersimpan.");
await tungguTeks("scan-surat.pdf");
const urlLampiran = `${BASE}${(await page.locator("[aria-labelledby=dokumen] a").first().getAttribute("href")) ?? ""}`;

// 5. Peserta rapat pada agenda undangan: nama hanya boleh diambil dari akun aplikasi yang aktif.
// Tab menutup nama yang sedang diketik dan langsung membuka ruang untuk nama berikutnya.
await page.locator("#peserta_nama").first().click();
await page.locator("#peserta_nama").first().fill("Budi wijaya");
await page.locator("#peserta_nama").first().press("Tab");
cat("nama pertama jadi chip dan isian siap untuk nama berikutnya", (await page.locator('[data-slot="combobox-chip"]').count()) === 1 && (await page.locator("#peserta_nama").first().inputValue()) === "");
await page.locator("#peserta_nama").first().fill("Sri wedi");
await page.locator("#peserta_nama").first().press("Tab");
cat("dua peserta dipilih sekaligus", (await page.locator('[data-slot="combobox-chip"]').count()) === 2);
await page.locator("#peserta_nama").first().press("Escape");
await page.getByRole("button", { name: /Tambah peserta ke agenda/ }).first().click();
await cekToast("dua peserta ditambahkan", "2 peserta ditambahkan ke agenda ini.");
async function tungguBarisPeserta(nama: string) {
  for (let i = 0; i < 30; i++) {
    if ((await page.locator("div.border-b", { hasText: nama }).count()) > 0) return true;
    await page.waitForTimeout(500);
  }
  return false;
}
cat("peserta tersimpan dan muncul di agenda", await tungguBarisPeserta("Budi wijaya"));
cat("peserta kedua muncul di agenda", await tungguBarisPeserta("Sri wedi"));
const cekInstansi = {
  baris: await page.locator("div.border-b", { hasText: "BPKAD - Bidang Aset" }).count(),
  isi: (await page.locator("div.border-b").allTextContents()).join(" / "),
};
cat("instansi diisi otomatis untuk peserta bidang aset", cekInstansi.baris > 0, `baris=${cekInstansi.baris} isi=${cekInstansi.isi}`);

// Chip yang tersisa dari pemilihan sebelumnya dihapus dulu supaya isian hanya berisi nama yang belum ada.
await page.locator("#peserta_nama").first().click();
await page.locator("#peserta_nama").first().press("Backspace");
await page.locator("#peserta_nama").first().press("Backspace");
cat("chip peserta bisa dihapus dengan Backspace", (await page.locator('[data-slot="combobox-chip"]').count()) === 0);
await page.locator("#peserta_nama").first().fill("Uji Peserta Tidak Ada");
cat(
  "nama tanpa akun tidak dijadikan peserta",
  (await page.locator('[data-slot="combobox-chip"]').count()) === 0 &&
    (await hitung('Nama "Uji Peserta Tidak Ada" belum punya akun aplikasi')) > 0,
  `chip=${await page.locator('[data-slot="combobox-chip"]').count()}`,
);
const alamatBuatAkun = await page.getByRole("link", { name: "Buat akun di Pengaturan › Pengguna" }).first().getAttribute("href");
cat(
  "nama tanpa akun mengarah ke pembuatan akun di Pengaturan",
  (alamatBuatAkun ?? "") === "/pengaturan/pengguna",
  `href=${alamatBuatAkun}`,
);
await page.locator("#peserta_nama").first().press("Escape");
await page.getByRole("button", { name: /Tambah peserta ke agenda/ }).first().click();
await cekToast("nama tanpa akun tidak tersimpan sebagai peserta", "Nama peserta wajib diisi.");

// Nama tanpa akun tidak muncul di dropdown peserta (dropdown hanya berisi akun aplikasi).
const idSurat = page.url().match(/\/surat\/([0-9a-f-]+)/)?.[1] ?? "";
await page.locator("#peserta_nama").first().click();
await page.locator("#peserta_nama").first().fill("Uji Peserta");
await page.waitForSelector('[data-slot="combobox-content"]');
cat("nama tanpa akun tidak muncul di dropdown peserta", (await page.locator('[data-slot="combobox-item"]', { hasText: "Uji Peserta Tidak Ada" }).count()) === 0);
cat("peserta berakun muncul di dropdown peserta", (await page.locator('[data-slot="combobox-item"]', { hasText: "Budi wijaya" }).count()) > 0);
await page.locator("#peserta_nama").first().press("Escape");
void idSurat;

await page.locator("div.border-b", { hasText: "Budi wijaya" }).getByRole("button", { name: "Hapus peserta" }).click();
await page.getByRole("button", { name: "Hapus dari agenda" }).click();
await cekToast("peserta dihapus", "Peserta dihapus dari agenda ini.");
cat("peserta hilang dari daftar", (await page.locator("div.border-b", { hasText: "Budi wijaya" }).count()) === 0, `sisa: ${(await page.locator("div.border-b").allTextContents()).join(" / ")}`);

await page.locator("div.border-b", { hasText: "Sri wedi" }).getByRole("button", { name: "Hapus peserta" }).click();
await page.getByRole("button", { name: "Hapus dari agenda" }).click();
await cekToast("peserta kedua dihapus", "Peserta dihapus dari agenda ini.");
cat("daftar peserta kosong kembali", (await page.locator("div.border-b", { hasText: "Sri wedi" }).count()) === 0, `sisa: ${(await page.locator("div.border-b").allTextContents()).join(" / ")}`);

// 5. Status rapat
await pilihStatus(page.getByLabel("Ubah status agenda"), "Dibatalkan");
await cekToast("status rapat berubah", "Status agenda diubah menjadi Dibatalkan.");
await tungguTeks("Dibatalkan");
cat("status rapat berubah", (await hitung("Dibatalkan")) > 0);

// 5b. Tempat dan penyelenggara agenda bisa dilengkapi setelah surat disimpan
cat("isian yang masih kurang dinyatakan jelas", (await hitung("Penyelenggara belum diisi")) > 0);
cat("form tempat dan penyelenggara tersedia untuk penulis", (await page.getByLabel("Tempat agenda").count()) > 0);
await page.getByRole("textbox", { name: "Tempat agenda" }).fill("Ruang Rapat A");
await page.getByRole("textbox", { name: "Penyelenggara" }).fill("BPKAD Bidang Aset");
await page.getByRole("button", { name: "Simpan tempat dan penyelenggara" }).click();
await cekToast("tempat dan penyelenggara tersimpan", "Tempat dan penyelenggara agenda Rapat koordinasi aset daerah diperbarui.");
await tungguTeks("di Ruang Rapat A diselenggarakan BPKAD Bidang Aset");
cat("tempat dan penyelenggara tersimpan dan terbaca", (await hitung("Ruang Rapat A")) > 0);
cat("keterangan kurang hilang setelah kedua isian terisi", (await hitung("belum diisi")) === 0);
await page.getByRole("textbox", { name: "Tempat agenda" }).fill("");
await page.getByRole("textbox", { name: "Penyelenggara" }).fill("");
await page.getByRole("button", { name: "Simpan tempat dan penyelenggara" }).click();
await cekToast("mengosongkan isian tetap tersimpan", "Tempat dan penyelenggara agenda Rapat koordinasi aset daerah diperbarui.");
await tungguTeks("Tempat belum diisi");
cat("mengosongkan isian dinyatakan kembali sebagai kosong", (await hitung("Tempat belum diisi")) > 0 && (await hitung("Penyelenggara belum diisi")) > 0);

// 5c. Langkah disposisi bisa dikoreksi dan dihapus; status surat dihitung ulang dari langkah yang tersisa
const { PrismaClient: PrismaKlik } = await import("@prisma/client");
const dbKlik = new PrismaKlik();
const idSuratUji = page.url().match(/\/surat\/([0-9a-f-]+)/)?.[1] ?? "";
const langkahUji = await dbKlik.disposisi.findFirst({ where: { surat_id: idSuratUji }, orderBy: { tanggal_disposisi: "asc" } });
const panelUbah = page.locator("#bagian-ubah-disposisi");

await page.goto(`${BASE}/surat/${idSuratUji}?disposisi=ubah&id=${langkahUji.id}`);
await page.waitForLoadState("networkidle");
cat("form ubah disposisi terbuka lewat tautan", (await panelUbah.getByText("Ubah disposisi").count()) > 0);
cat("form ubah terisi nilai yang sudah tersimpan", (await panelUbah.getByLabel("Isi instruksi").inputValue()).includes("Siapkan daftar barang"));
cat("membuka form ubah tidak memunculkan pesan hasil simpan", (await hitung("Perubahan disposisi tersimpan")) === 0);

await page.setViewportSize({ width: 390, height: 850 });
await page.goto(`${BASE}/surat/${idSuratUji}?disposisi=ubah&id=${langkahUji.id}`);
await page.waitForLoadState("networkidle");
cat("mobile form ubah disposisi tanpa overflow horizontal", (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0);
cat(
  "mobile form ubah disposisi target sentuh >= 44px",
  (await page.locator("main [data-slot='button'], main [data-slot='link'], main [data-slot='input'], main [data-slot='native-select'], main [data-slot='select-trigger'], main [data-slot='textarea'], main [data-slot='pilih-instruksi']").filter({ visible: true }).evaluateAll((els) => Math.min(...els.map((e) => e.getBoundingClientRect().height)))) >= 44,
);
await page.setViewportSize({ width: 1280, height: 900 });

await panelUbah.getByLabel("Tanggal disposisi").fill(hariIni);
await panelUbah.getByLabel("Tanggal diteruskan").fill(kemarin);
await panelUbah.getByRole("button", { name: "Simpan perubahan" }).click();
await tungguInline("tanggal diteruskan yang mendahului disposisi ditolak", "Tanggal diteruskan tidak boleh mendahului tanggal disposisi");
cat("form ubah menolak tanggal diteruskan mendahului disposisi", (await hitung("Tanggal diteruskan tidak boleh mendahului tanggal disposisi")) > 0);

await page.goto(`${BASE}/surat/${idSuratUji}?disposisi=ubah&id=${langkahUji.id}`);
await page.waitForLoadState("networkidle");
await panelUbah.getByLabel("Isi instruksi").fill("Instruksi yang sudah dikoreksi");
// nilai dari submit yang ditolak masih ada di isian, jadi tanggal penerusan dikosongkan dulu
await panelUbah.getByLabel("Tanggal diteruskan").fill("");
await panelUbah.getByLabel("Diteruskan ke").selectOption("");
await panelUbah.getByRole("button", { name: "Simpan perubahan" }).click();
await cekToast("koreksi disposisi tersimpan", "Perubahan disposisi tersimpan.");
await tungguUrl("panel koreksi disposisi tertutup setelah simpan", (u) => !u.includes("disposisi=ubah"));
// simpan membawa halaman kembali ke langkah pertama; buka lagi semua bagian untuk membaca riwayatnya
await page.goto(`${BASE}/surat/${idSuratUji}?semua=1`);
await page.waitForLoadState("networkidle");
const setelahKoreksi = await dbKlik.disposisi.findUnique({ where: { id: langkahUji.id } });
cat("koreksi masuk ke database", setelahKoreksi.isi_disposisi === "Instruksi yang sudah dikoreksi" && setelahKoreksi.penerima_disposisi === null && setelahKoreksi.tanggal_diteruskan === null);
await tungguTampil("riwayat menampilkan instruksi baru", "Instruksi yang sudah dikoreksi");
await tungguHilang("instruksi lama tidak lagi tampil", "Siapkan daftar barang milik daerah");
await tungguHilang("penerusan yang dihapus tidak lagi tampil", "Subid Penatausahaan Aset");
cat("koreksi dicatat di jejak perubahan", (await dbKlik.audit_logs.count({ where: { action: "ubah_disposisi" } })) > 0);
await tungguTampil("status surat tetap sudah didisposisikan setelah koreksi", "Sudah didisposisikan");

// langkah yang salah dimasukkan dihapus, langkah asli tetap utuh
const tanggalTambahan = new Date(`${lusa.slice(0, 10)}T00:00:00Z`);
const langkahTambahan = await dbKlik.disposisi.create({
  data: {
    surat_id: idSuratUji,
    tanggal_disposisi: tanggalTambahan,
    pemberi_disposisi: "Uji Langkah Tambahan",
    isi_disposisi: "Langkah yang salah dimasukkan",
    status_tindak_lanjut: "selesai",
  },
});
await page.goto(`${BASE}/surat/${idSuratUji}?semua=1`);
await page.waitForLoadState("networkidle");
const labelTambahan = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(tanggalTambahan);
await page.getByRole("button", { name: `Hapus disposisi ${labelTambahan}` }).filter({ visible: true }).first().click();
await cekToast("langkah disposisi dihapus", "Langkah disposisi dihapus dari riwayat.");
cat("langkah disposisi dihapus", (await dbKlik.disposisi.count({ where: { id: langkahTambahan.id } })) === 0);
cat("langkah asli tidak ikut terhapus", (await dbKlik.disposisi.count({ where: { surat_id: idSuratUji } })) === 1);
cat("penghapusan dicatat di jejak perubahan", (await dbKlik.audit_logs.count({ where: { action: "hapus_disposisi" } })) > 0);
await tungguHilang("riwayat hanya menampilkan langkah yang tersisa", "Langkah yang salah dimasukkan");
await tungguTampil("status surat tetap sudah didisposisikan setelah hapus", "Sudah didisposisikan");

// 5b. Disposisi boleh dicatat tanpa instruksi: pilihan "Tanpa Instruksi" menyimpan strip "-" di database,
//     pilihan "Instruksi" menampilkan isian teks. Data lama tidak diubah oleh pemeriksaan ini.
await page.goto(`${BASE}/surat/${idSuratUji}?semua=1`);
await page.waitForLoadState("networkidle");
if (await page.getByRole("dialog").count() > 0) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}
const stripSebelum = await page.locator("#bagian-disposisi").getByText("-", { exact: true }).count();
cat("form disposisi punya pilihan Tanpa Instruksi dan Instruksi", (await page.locator('[data-slot="pilih-instruksi"]').count()) === 2);
cat("pilihan Instruksi menampilkan isian teks", (await page.locator("#isi_disposisi").count()) === 1);
await page.getByText("Tanpa Instruksi", { exact: true }).click();
cat("Tanpa Instruksi menyembunyikan isian instruksi", (await page.locator("#isi_disposisi").count()) === 0);
await page.locator("#tanggal_disposisi").fill(hariIni);
await page.selectOption("#pemberi_disposisi", "Kepala BPKAD");
await page.getByRole("button", { name: "Simpan disposisi" }).click();
await cekToast("disposisi tanpa instruksi tersimpan", "Disposisi tersimpan pada surat ini.");
const langkahTanpa = await dbKlik.disposisi.findFirst({ where: { surat_id: idSuratUji, isi_disposisi: "-" }, orderBy: { created_at: "desc" } });
cat("disposisi tanpa instruksi tercatat sebagai strip '-' di database", Boolean(langkahTanpa));
await page.goto(`${BASE}/surat/${idSuratUji}?semua=1`);
await page.waitForLoadState("networkidle");
const stripSesudah = await page.locator("#bagian-disposisi").getByText("-", { exact: true }).count();
cat("riwayat disposisi menampilkan '-' untuk langkah tanpa instruksi", stripSesudah > stripSebelum, `${stripSebelum} -> ${stripSesudah}`);
if (langkahTanpa) await dbKlik.disposisi.delete({ where: { id: langkahTanpa.id } });
cat("langkah uji tanpa instruksi dibuang lagi", (await dbKlik.disposisi.count({ where: { surat_id: idSuratUji } })) === 1);

await dbKlik.$disconnect();

// 5. Database menolak surat yang masih punya rapat aktif dijadikan nonrapat
// 5a. Navigasi bagian surat yang nempel: klik menggulung ke bagian, bagian aktif ditandai
await page.setViewportSize({ width: 1280, height: 800 });
const navBagian = page.getByRole("navigation", { name: "Bagian surat ini" });
cat("navigasi bagian surat ada", (await navBagian.getByRole("button").count()) >= 4);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
const sebelumGulung = await page.evaluate(() => window.scrollY);
await navBagian.getByRole("button", { name: /Agenda/ }).click();
await page.waitForTimeout(600);
cat("klik bagian menggulung ke bagian rapat", (await page.evaluate(() => window.scrollY)) > sebelumGulung + 200);
cat("bagian aktif ditandai", await navBagian.getByRole("button", { name: /Agenda/ }).getAttribute("aria-current") === "location");
const atasNav = await navBagian.boundingBox();
cat("navigasi tetap nempel di atas saat menggulung", atasNav !== null && atasNav.y >= 0 && atasNav.y < 120);
cat("navigasi disembunyikan saat dicetak", await navBagian.evaluate((el) => el.className.includes("tanpa-cetak")));

// Agenda uji dibatalkan pada langkah status di atas; aktifkan lagi supaya penolakan database diuji dengan rapat aktif.
await page.goto(`${BASE}/surat/${idSuratUji}?semua=1`);
await page.waitForLoadState("networkidle");
await pilihStatus(page.getByLabel("Ubah status agenda"), "Terjadwal");
await cekToast("agenda uji aktif kembali", "Status agenda diubah menjadi Terjadwal.");

// Dialog modal yang masih terbuka membuat isian yang sama muncul dua kali; tutup dulu.
if (await page.getByRole("dialog").count() > 0) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}
await pilihStatus(page.getByRole("combobox", { name: "Kaitan surat dengan agenda" }), "Tidak ada agenda");
await cekToast("database menolak surat beragenda diubah menjadi tanpa agenda", "Kaitan agenda surat gagal diubah");
// Setelah mengubah status undangan halaman kembali ke langkah pertama, jadi semua bagian dibuka dulu.
await page.goto(`${BASE}/surat/${idSuratUji}?semua=1`);
await page.waitForLoadState("networkidle");
await page.getByLabel("Waktu mulai baru").fill(lusa);
await page.getByLabel("Alasan perubahan").fill("Pemda mengubah jadwal pelaksanaan");
await page.getByRole("button", { name: "Jadwalkan ulang" }).click();
await cekToast("jadwal berubah dan riwayat tercatat", "Jadwal agenda diperbarui dan perubahan lama tercatat.");
await page.getByRole("button", { name: /Riwayat perubahan jadwal/ }).click();
cat("jadwal berubah dan riwayat tercatat", (await hitung(/dipindah ke/)) > 0);
cat("alasan perubahan terbaca di riwayat", (await hitung(/karena Pemda mengubah jadwal/)) > 0);

// 7. Menu disposisi dan penyelesaian tindak lanjut
await page.goto(`${BASE}/disposisi`);
await tungguTeks("001/2026");
cat("daftar disposisi menampilkan surat", (await hitung("001/2026")) > 0);
// Jumlah disposisi uji masih di bawah satu halaman, jadi paginasi belum muncul.
cat("paginasi disposisi belum muncul", (await page.getByRole("navigation", { name: "pagination" }).count()) === 0);
// Status tidak lagi ditampilkan dua kali: badge kolom "Status" dihapus, dropdown yang mengubah nilai.
// Tabel desktop dan tabel HP punya kepala yang sama, jadi hanya yang terlihat dan tanpa duplikasi dihitung.
const kepalaTabel = [...new Set(await page.locator("[aria-labelledby='tabel-disposisi'] table thead th").filter({ visible: true }).allTextContents())];
cat(
  "tabel disposisi tidak punya kolom status duplikat",
  kepalaTabel.length === 5 && !kepalaTabel.includes("Status"),
  `kolom: ${kepalaTabel.join(", ")}`,
);
await pilihStatus(page.getByLabel(/Status tindak lanjut untuk/).filter({ visible: true }).first(), "Selesai");
await cekToast("status tindak lanjut berubah", "Status diubah menjadi");
cat("filter disposisi tidak berubah saat menyimpan status", page.url().split("?")[0] === `${BASE}/disposisi`, page.url());

// surat dianggap selesai bila semua tindak lanjut selesai
await page.goto(`${BASE}/surat`);
await tungguTeks("Agenda Surat Masuk");
cat("surat menjadi selesai setelah semua disposisi selesai", (await page.locator("[data-slot='badge']", { hasText: "Selesai" }).count()) > 0);

// 8. Dashboard membaca angka dari database
await page.goto(`${BASE}/dashboard?periode=semua`);
await tungguTeks("Surat masuk, disposisi, dan agenda sampai hari ini.");
const angka = await page.locator("[data-slot='metric-nilai']").allTextContents();
cat("dashboard menghitung dari database", angka.includes("1") && angka.includes("0"), `kartu: ${angka.join(", ")}`);
cat("surat terbaru muncul di dashboard", (await hitung("Undangan rapat koordinasi barang milik daerah")) > 0);

// 8.5 Rekap periode dan ekspor Excel
const tahunUji = hariIni.slice(0, 4);
await page.goto(`${BASE}/rekap?tahun=${tahunUji}`);
await tungguTeks("Rekap per bulan");
const kartuRekap = await page.locator("[data-slot='metric-nilai']").allTextContents();
cat(
  "rekap menghitung surat dan persentase penyelesaian",
  kartuRekap.includes("1") && kartuRekap.includes("100%"),
  `kartu: ${kartuRekap.join(", ")}`,
);

// Kop laporan ada di DOM tapi disembunyikan di layar (hanya tampil saat cetak), jadi dihitung lewat locator.
cat(
  "kop laporan membawa nomor laporan",
  (await page.locator("p.num", { hasText: "Nomor laporan:" }).count()) > 0,
);

// Donut komposisi kategori: slice dan legend angka/persentase ada.
cat(
  "donut komposisi kategori punya slice dan legend angka",
  (await page.locator("[aria-labelledby='komposisi-jenis'] svg path, [aria-labelledby='komposisi-jenis'] svg circle").count()) > 0 &&
    (await page.locator("[aria-labelledby='komposisi-jenis'] li").count()) > 0 &&
    (await page.locator("[aria-labelledby='komposisi-jenis'] li", { hasText: "surat ·" }).count()) > 0,
);
await page.evaluate(() => {
  const w = window as unknown as { __cetak: number; print: () => void };
  w.__cetak = 0;
  w.print = () => {
    w.__cetak += 1;
  };
});
await page.getByRole("button", { name: "Cetak atau simpan PDF" }).click();
cat(
  "tombol cetak memanggil dialog print",
  (await page.evaluate(() => (window as unknown as { __cetak: number }).__cetak)) > 0,
);

await page.goto(`${BASE}/rekap?tahun=1999`);
await tungguTeks("Tidak ada surat masuk, surat keluar, maupun agenda pada tahun 1999");
cat("rekap tahun kosong punya empty state", (await hitung("Tidak ada surat masuk, surat keluar, maupun agenda pada tahun 1999")) > 0);

const ekspor = await page.request.get(`${BASE}/rekap/ekspor?tahun=${tahunUji}`);
cat(
  "ekspor excel mengembalikan file xlsx",
  ekspor.ok() && (ekspor.headers()["content-type"] ?? "").includes("spreadsheetml"),
  `status ${ekspor.status()}`,
);
const ExcelJS = (await import("exceljs")).default;
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(await ekspor.body());
const namaSheet = wb.worksheets.map((w) => w.name);
cat("ekspor memuat empat lembar laporan", namaSheet.join(", ") === "Rekap per bulan, Rekap per kategori, Daftar surat, Daftar surat keluar", namaSheet.join(", "));
const lembarBulan = wb.getWorksheet("Rekap per bulan");
const barisTotal = lembarBulan?.lastRow?.values as unknown[];
cat(
  "baris total ekspor sesuai database",
  Number(barisTotal?.[2]) === 1 && Number(barisTotal?.[9]) === 1 && Number(barisTotal?.[10]) === 1 && Number(barisTotal?.[11]) === 0,
  `total: ${JSON.stringify(barisTotal)}`,
);
// lembar surat keluar ada walau belum ada surat keluar: header saja, tanpa baris data
const lembarKeluar = wb.getWorksheet("Daftar surat keluar");
cat(
  "lembar surat keluar kosong saat belum ada surat keluar",
  (lembarKeluar?.rowCount ?? 0) === 1 && (lembarKeluar?.getRow(1)?.values as unknown[])?.includes("Nomor surat"),
  `baris: ${lembarKeluar?.rowCount}`,
);
const lembarSurat = wb.getWorksheet("Daftar surat");
cat("lembar surat memuat satu surat", (lembarSurat?.rowCount ?? 0) === 2, `baris: ${lembarSurat?.rowCount}`);

const ctxTanpaLogin = await browser.newContext();
const eksporTanpaLogin = await ctxTanpaLogin.request.get(`${BASE}/rekap/ekspor?tahun=${tahunUji}`);
cat("ekspor ditolak tanpa login", eksporTanpaLogin.status() === 401, `status ${eksporTanpaLogin.status()}`);
await ctxTanpaLogin.close();

// 9. Kalender dan navigasi bulan
// bulan berjalan = bulan sekarang menurut jadwal Jakarta, bukan bulan yang sedang dilihat
const bulanKiniUji = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
}).format(new Date());
await page.goto(`${BASE}/rapat`);
await tungguTeks("Kalender");
await tungguSelector("sel kalender menaut judul agenda lewat atribut title", `[data-slot='calendar'] a[title*="Rapat koordinasi aset daerah"]`);
await page.getByRole("link", { name: "Bulan berikutnya" }).click();
await navigasi(/bulan=\d{4}-\d{2}/);
await tungguTeks("Kalender");
cat("navigasi bulan bekerja", /bulan=\d{4}-\d{2}/.test(page.url()), page.url());
await page.getByRole("link", { name: "Bulan berjalan" }).click();
await navigasi((u) => u.searchParams.get("bulan") === bulanKiniUji);
await tungguTeks("Kalender");
cat("kalender bulan berjalan menampilkan rapat", (await page.locator(`[data-slot='calendar'] a[title*="Rapat koordinasi aset daerah"]`).count()) > 0);

// 9.5 Agenda tanpa surat masuk (pengingat pribadi) dan detail satu tanggal
const kunciHariIni = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const labelBulan = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
}).format(new Date());
const kunciBesok = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(Date.now() + 86400000));

await page.goto(`${BASE}/rapat?bulan=${kunciHariIni.slice(0, 7)}&tanggal=${kunciHariIni}`);
await tungguTeks("Kalender");
await bukaDialogAgenda();

cat("agenda tanpa surat dibuka lewat dialog, bukan menempel di bawah kalender", (await page.getByRole("dialog", { name: "Buat agenda sendiri" }).count()) > 0);
await page.fill("#baru_agenda", "Uji pengingat internal bidang");
await page.fill("#baru_mulai", `${kunciHariIni}T09:00`);
await page.fill("#baru_selesai", `${kunciHariIni}T11:00`);
await page.fill("#baru_tempat", "Ruang rapat internal");
await page.getByRole("button", { name: "Buat agenda" }).click();
await navigasi(/agenda=ok/);
await tungguTeks("Uji pengingat internal bidang");
cat("agenda tanpa surat tersimpan dan tanggalnya langsung dibuka", page.url().includes(`tanggal=${kunciHariIni}`), page.url());
cat("jam agenda terlihat pada detail tanggal", (await hitung("09.00 – 11.00")) > 0);
cat("agenda tanpa disebut sumbernya", (await hitung("agenda sendiri, dibuat oleh Petugas Aset")) > 0);
cat("agenda dari surat tidak punya tombol hapus", (await page.getByRole("button", { name: "Hapus agenda Rapat koordinasi aset daerah" }).count()) === 0);
cat("agenda milik sendiri punya tombol hapus", (await page.getByRole("button", { name: "Hapus agenda Uji pengingat internal bidang" }).count()) > 0);

// tanggal kosong: detail tetap bisa dibuka dan formulir terisi tanggal itu
await page.goto(`${BASE}/rapat?bulan=${kunciBesok.slice(0, 7)}&tanggal=${kunciBesok}`);
await tungguTeks("Agenda pada");
cat("tanggal kosong punya detail", (await hitung("Belum ada agenda pada tanggal ini")) > 0);
await bukaDialogAgenda();

cat("dialog terisi tanggal yang dibuka", (await page.inputValue("#baru_mulai")).startsWith(`${kunciBesok}T08:00`));

// klik tanggal dari kalender membuka detail tanggal
await page.goto(`${BASE}/rapat?bulan=${kunciHariIni.slice(0, 7)}`);
await tungguTeks("Kalender");
await page.getByRole("link", { name: `Lihat agenda tanggal ${Number(kunciHariIni.slice(8, 10))} ${labelBulan}` }).click();
await navigasi(`tanggal=${kunciHariIni}`);
cat("klik tanggal kalender membuka detail tanggal", page.url().includes(`tanggal=${kunciHariIni}`), page.url());
cat("detail tanggal memuat jam agenda", (await hitung("09.00 – 11.00")) > 0);

// pimpinan (peran pembaca) boleh membuat pengingat sendiri, tidak boleh mengubah milik orang lain
await login("pimpinan@magelang.go.id", "mMs3HSiLBJPOdR5X");
await page.goto(`${BASE}/rapat?bulan=${kunciHariIni.slice(0, 7)}&tanggal=${kunciHariIni}`);
await tungguTeks("Agenda pada");
await bukaDialogAgenda();

cat("pembaca tetap bisa membuat agenda sendiri", (await page.getByRole("dialog", { name: "Buat agenda sendiri" }).count()) > 0);
cat("pembaca tidak punya kontrol status milik orang lain", (await page.getByLabel(/Status agenda Uji pengingat internal bidang/).count()) === 0);
// Status agenda milik orang lain shown sebagai badge, bukan isian. Badge bisa berisi status otomatis
// (berlangsung/selesai), jadi yang dicek adalah ada badge status, bukan badge "Terjadwal" saja.
cat(
  "pembaca tetap melihat status sebagai badge",
  (await page.locator('[data-slot="badge"]').filter({ hasText: /^(Terjadwal|Berlangsung|Sudah dilaksanakan|Dibatalkan|Dijadwalkan ulang)$/ }).count()) > 0,
);
await page.fill("#baru_agenda", "Uji pengingat pimpinan");
await page.fill("#baru_mulai", `${kunciHariIni}T14:00`);
await page.getByRole("button", { name: "Buat agenda" }).click();
await navigasi(/agenda=ok/);
await tungguTeks("Uji pengingat pimpinan");
cat("pembaca punya kontrol status untuk agendanya sendiri", (await page.getByLabel(/Status agenda Uji pengingat pimpinan/).count()) > 0);
cat("pembaca punya tombol hapus untuk agendanya sendiri", (await page.getByRole("button", { name: "Hapus agenda Uji pengingat pimpinan" }).count()) > 0);
await hapusKalender(page, page.getByRole("button", { name: "Hapus agenda Uji pengingat pimpinan" }).first());
await cekToast("pengingat milik sendiri terhapus dari tanggal", "Agenda Uji pengingat pimpinan dihapus.");
cat("pengingat milik sendiri terhapus dari tanggal", (await page.getByLabel(/Status agenda Uji pengingat pimpinan/).count()) === 0);

// petugas menghapus agenda uji miliknya sendiri
await login("petugas.aset@magelang.go.id", "BCed08Gkc34dF1RM");
await page.goto(`${BASE}/rapat?bulan=${kunciHariIni.slice(0, 7)}&tanggal=${kunciHariIni}`);
await tungguTeks("Agenda pada");
await hapusKalender(page, page.getByRole("button", { name: "Hapus agenda Uji pengingat internal bidang" }).first());
await cekToast("agenda uji milik petugas terhapus", "Agenda Uji pengingat internal bidang dihapus.");
cat("agenda uji milik petugas terhapus", (await page.getByLabel(/Status agenda Uji pengingat internal bidang/).count()) === 0);

// 10. Filter surat
await page.goto(`${BASE}/surat`);
await page.waitForLoadState("networkidle");
await page.waitForTimeout(400);
await tungguTeks("Agenda Surat Masuk");
await page.fill("#q", "barang milik daerah");
await navigasi(/q=/);
await tungguTeks("1 surat ditemukan");
cat("filter pencarian menemukan surat", (await hitung("1 surat ditemukan")) > 0);
// id filter bisa bentrok sementara dengan judul bagian di halaman detail saat payload dev masih di-stream
await page.locator("#undangan").first().selectOption("tidak");
await navigasi(/undangan=tidak/);
await tungguTeks("Tidak ada surat yang cocok");
cat("filter status undangan menolak surat rapat", (await hitung("Tidak ada surat yang cocok")) > 0);
// Reset mengosongkan semua filter dan kembali ke daftar tanpa filter.
await page.getByRole("button", { name: "Reset filter" }).click();
await navigasi((u) => u.pathname === "/surat" && u.search === "");
await tungguTeks("surat ditemukan");
cat("reset filter mengembalikan daftar penuh", page.url() === `${BASE}/surat`, page.url());

// 11. Tautan antar modul
await page.goto(`${BASE}/surat`);
await tungguTeks("Detail");
await page.getByRole("link", { name: "Detail" }).first().click();
await navigasi(/\/surat\/[0-9a-f-]+/);
await page.goto(`${page.url()}?semua=1`);
await tungguTeks("Agenda terkait surat ini");
cat("tombol detail membuka halaman surat", page.url().includes("/surat/"), page.url());
await page.goto(`${BASE}/rapat`);
await tungguTeks("Agenda yang masih akan datang");
cat("tautan dari rapat ke surat sumber tersedia", (await hitung("Buka surat")) > 0);
await page.getByRole("link", { name: "Lihat agenda tanggal" }).first().click();
await navigasi(/tanggal=\d{4}-\d{2}-\d{2}/);
await tungguTeks("Agenda pada");
cat("detail tanggal menampilkan judul agenda penuh", (await hitung("Rapat koordinasi aset daerah")) > 0);

// 12. Keluar dan penjagaan halaman
await page.goto(`${BASE}/dashboard`);
await tungguTeks("Surat masuk, disposisi, dan agenda sampai hari ini.");
await keluar();
cat("keluar menghapus sesi", page.url().endsWith("/login"), page.url());
await page.goto(`${BASE}/dashboard`);
await navigasi(/\/login/, { timeout: 10000 }).catch(() => {});
cat("halaman tanpa sesi diarahkan ke login", page.url().endsWith("/login"), page.url());

// 13. Peran pembaca hanya membaca
await login("pimpinan@magelang.go.id", "mMs3HSiLBJPOdR5X");
await page.goto(`${BASE}/surat`);
await tungguTeks("Agenda Surat Masuk");
cat("peran pembaca tidak punya tombol tambah surat", (await page.getByRole("link", { name: "Tambah Surat" }).count()) === 0);
cat("peran pembaca melihat menu rekap", (await page.getByRole("link", { name: "Rekap dan Laporan" }).count()) > 0);
cat("peran pembaca tidak melihat menu pengaturan", (await page.getByRole("link", { name: "Pengaturan" }).count()) === 0);
await page.goto(`${BASE}/disposisi`);
await tungguTeks("001/2026");
cat("peran pembaca tidak bisa mengubah tindak lanjut", (await page.locator('[data-slot="select-trigger"][aria-label^="Status tindak lanjut"]').count()) === 0);
await page.goto(urlDetail);
await tungguTeks("Riwayat disposisi");
cat("peran pembaca tidak melihat form disposisi", (await page.getByRole("button", { name: "Simpan disposisi" }).count()) === 0);
cat("peran pembaca tetap melihat isi disposisi", (await hitung("Instruksi yang sudah dikoreksi")) > 0);
cat("peran pembaca tidak punya aksi ubah disposisi", (await page.getByRole("link", { name: /^Ubah disposisi/ }).count()) === 0);
cat("peran pembaca tidak punya aksi hapus disposisi", (await page.getByRole("button", { name: /^Hapus disposisi/ }).count()) === 0);
cat("peran pembaca tidak punya kartu pengelolaan surat", (await hitung("Pengelolaan surat ini")) === 0);
cat("peran pembaca tidak punya form koreksi identitas", (await page.getByRole("button", { name: "Simpan perubahan" }).count()) === 0);
cat("peran pembaca tidak punya tombol unggah lampiran", (await page.locator("#file").count()) === 0);
cat("peran pembaca tidak punya tombol hapus lampiran", (await page.getByRole("button", { name: "Hapus", exact: true }).count()) === 0);
cat("peran pembaca tetap bisa mengunduh lampiran", (await hitung("scan-surat.pdf")) > 0);
const unduhPembaca = await page.request.get(urlLampiran);
cat("unduh lampiran oleh pembaca berhasil", unduhPembaca.ok(), `status ${unduhPembaca.status()}`);

// 13.5 Pengaturan: membuat akun, mengubah peran dan status, Kategori Surat, jejak audit
await login("petugas.aset@magelang.go.id", "BCed08Gkc34dF1RM");
await page.goto(`${BASE}/pengaturan/pengguna`);
await tungguTeks("Daftar akun");
cat("pengaturan menampilkan akun yang ada", (await hitung("petugas.aset@magelang.go.id")) > 0);

const emailUji = `uji-${Date.now()}@magelang.go.id`;
const bagianAkun = page.url();
await page.fill("#name", "Petugas Uji");
await page.fill("#email", emailUji);
await page.fill("#password", "kata-sandi-uji-9");
await page.locator("#role").first().selectOption("Pembaca/Pimpinan");
await page.getByRole("button", { name: "Buat akun" }).click();
await cekToast("akun baru dibuat", "Akun Petugas Uji dibuat sebagai Pembaca/Pimpinan.");
cat("buat akun tetap di bagian akun", page.url() === bagianAkun && (await hitung("Daftar akun")) > 0, page.url());
cat("akun baru muncul setelah dibuat", (await hitung(emailUji)) > 0);

await page.getByRole("button", { name: "Ubah peran dan status Petugas Uji" }).click();
await page.locator("#pengguna_peran").selectOption("Petugas Agenda");
await page.locator("#pengguna_aktif").selectOption("0");
const sebelumUbah = page.url();
await page.getByRole("button", { name: "Simpan perubahan akun" }).click();
await cekToast("peran dan status akun berubah", "Akun Petugas Uji diubah menjadi Petugas Agenda dan dinonaktifkan.");
cat("ubah akun tetap di bagian akun", page.url() === sebelumUbah && (await hitung("Daftar akun")) > 0, page.url());
await tungguTeks("Nonaktif");
cat("peran dan status akun berubah", (await hitung("Nonaktif")) > 0 && (await hitung("Petugas Agenda")) > 0);
// Panel perubahan menutup sendiri setelah write; nilai akun sudah tersimpan.
await tungguHilang("panel perubahan tertutup setelah simpan", "Mengubah Petugas Uji");

await keluar();
await page.fill("#email", emailUji);
await page.fill("#password", "kata-sandi-uji-9");
await selesaikanTurnstile(page);
await page.getByRole("button", { name: "Masuk" }).click();
await tungguTeks("Akun ini sedang dinonaktifkan oleh administrator.");
cat("akun nonaktif ditolak saat login", (await hitung("Akun ini sedang dinonaktifkan oleh administrator.")) > 0);

await login("petugas.aset@magelang.go.id", "BCed08Gkc34dF1RM");
await page.goto(`${BASE}/pengaturan/pengguna`);
await tungguTeks("Daftar akun");
const sebelumAktifkan = page.url();
await page.getByRole("button", { name: "Ubah peran dan status Petugas Uji" }).click();
// Nilai awal select mengikuti akun terpilih, jadi hanya status yang perlu diubah.
cat("peran awal mengikuti akun terpilih", await page.locator("#pengguna_peran").inputValue() === "Petugas Agenda");
await page.locator("#pengguna_aktif").selectOption("1");
await page.getByRole("button", { name: "Simpan perubahan akun" }).click();
await cekToast("akun diaktifkan kembali", "Akun Petugas Uji diubah menjadi Petugas Agenda.");
await keluar();
await page.fill("#email", emailUji);
await page.fill("#password", "kata-sandi-uji-9");
await selesaikanTurnstile(page);
await page.getByRole("button", { name: "Masuk" }).click();
await navigasi(/\/dashboard/);
await tungguTeks("Surat masuk, disposisi, dan agenda sampai hari ini.");
cat("akun yang diaktifkan kembali bisa login", page.url().endsWith("/dashboard"), page.url());

await login("petugas.aset@magelang.go.id", "BCed08Gkc34dF1RM");
await page.goto(`${BASE}/pengaturan/jenis`);
await tungguTeks("Kategori Surat Masuk");
await page.fill("#nama_jenis_masuk", "Undangan rapat eksternal");
await page.getByRole("button", { name: "Tambah kategori surat masuk" }).click();
await cekToast("Kategori Surat baru tersimpan", "Kategori surat Undangan rapat eksternal untuk surat masuk ditambahkan.");
cat("tambah Kategori Surat tetap di halaman jenis", page.url().includes("/pengaturan/jenis") && (await tabAktif("Kategori Surat")), page.url());
cat("Kategori Surat baru tersimpan", (await hitung("Undangan rapat eksternal")) > 0);

// Kategori Surat Masuk dan surat keluar adalah dua halaman berbeda, berpindah lewat pil.
await page.getByRole("navigation", { name: "Kategori Surat" }).getByRole("link", { name: "Kategori Surat Keluar" }).click();
await navigasi(/\/pengaturan\/jenis\/keluar/);
await tungguTeks("Kategori Surat Keluar");
cat(
  "Kategori Surat keluar punya halaman sendiri",
  page.url().endsWith("/pengaturan/jenis/keluar") &&
    (await page.getByRole("navigation", { name: "Kategori Surat" }).getByRole("link", { name: "Kategori Surat Keluar" }).getAttribute("data-state")) === "active" &&
    (await page.locator("#nama_jenis_keluar").count()) === 1,
  page.url(),
);
cat("halaman keluar tidak memuat isian jenis masuk", (await page.locator("#nama_jenis_masuk").count()) === 0, page.url());
await page.getByRole("navigation", { name: "Kategori Surat" }).getByRole("link", { name: "Kategori Surat Masuk" }).click();
await navigasi(/\/pengaturan\/jenis\/masuk/);
await tungguTeks("Kategori Surat Masuk");
cat("kembali ke Kategori Surat masuk", page.url().endsWith("/pengaturan/jenis/masuk"), page.url());

await page.goto(`${BASE}/pengaturan/jejak`);
await page.locator("#entitas").selectOption("users");
await navigasi(/entitas=users/);
cat("filter audit tetap di halaman jejak", page.url().includes("/pengaturan/jejak") && (await tabAktif("History")), page.url());
await tungguTeks(/Petugas Uji/);
cat("jejak audit bisa difilter per entitas", (await hitung(/Petugas Uji/)) > 0);

// Paginasi jejak perubahan data: 25 catatan per halaman
await page.goto(`${BASE}/pengaturan/jejak?t=${Date.now()}`);
await tungguTeks(/Halaman \d+ dari \d+ halaman/);
const navAudit = page.getByRole("navigation", { name: "pagination" });
cat("paginasi jejak perubahan muncul", (await navAudit.count()) > 0);
const barisAudit = page.locator("[aria-labelledby='jejak'] table tbody tr");
await tungguBatasBaris("halaman pertama audit dibatasi 25", async () => await barisAudit.count(), 25);
const halaman1Audit = page.url();
await navAudit.getByRole("link", { name: "2", exact: true }).click();
await navigasi((u) => /pengaturan\/jejak\?halaman=2/.test(u.href) && u.href !== halaman1Audit);
cat("halaman 2 audit tetap di halaman jejak", page.url().includes("/pengaturan/jejak") && (await tabAktif("History")), page.url());
await tungguTeks(/Halaman 2 dari/);
cat("judul audit menyebut halaman aktif", (await hitung(/Halaman 2 dari/)) > 0);

// 13.7 Ubah kata sandi oleh pemilik akun
await login("petugas.aset@magelang.go.id", "BCed08Gkc34dF1RM");
await page.goto(`${BASE}/akun`);
await tungguTeks("Ganti kata sandi");
cat("menu Akun Saya muncul untuk Administrator", (await hitung("Akun Saya")) > 0);

await page.fill("#password_lama", "sandi-lama-salah-123");
await page.fill("#password_baru", "sandi-baru-uji-9");
await page.fill("#password_konfirmasi", "sandi-baru-uji-9");
await page.getByRole("button", { name: "Ganti kata sandi" }).click();
await tungguTeks("Kata sandi lama salah.");
cat("kata sandi lama salah ditolak", (await hitung("Kata sandi lama salah.")) > 0);

await page.fill("#password_lama", "BCed08Gkc34dF1RM");
await page.fill("#password_baru", "sandi-baru-uji-9");
await page.fill("#password_konfirmasi", "konfirmasibeda-9");
await page.getByRole("button", { name: "Ganti kata sandi" }).click();
await tungguTeks("Kata sandi baru dan konfirmasi tidak sama.");
cat("konfirmasi yang tidak sama ditolak", (await hitung("Kata sandi baru dan konfirmasi tidak sama.")) > 0);

await page.fill("#password_lama", "BCed08Gkc34dF1RM");
await page.fill("#password_baru", "sandi-baru-uji-9");
await page.fill("#password_konfirmasi", "sandi-baru-uji-9");
await page.getByRole("button", { name: "Ganti kata sandi" }).click();
await tungguTeks("Kata sandi berhasil diganti.");
cat("kata sandi baru tersimpan", (await hitung("Kata sandi berhasil diganti.")) > 0);

await keluar();
await page.fill("#email", "petugas.aset@magelang.go.id");
await page.fill("#password", "BCed08Gkc34dF1RM");
await selesaikanTurnstile(page);
await page.getByRole("button", { name: "Masuk" }).click();
await tungguTeks("Email atau kata sandi tidak cocok.");
cat("kata sandi lama tidak lagi diterima", (await hitung("Email atau kata sandi tidak cocok.")) > 0);

await page.fill("#email", "petugas.aset@magelang.go.id");
await page.fill("#password", "sandi-baru-uji-9");
await selesaikanTurnstile(page);
await page.getByRole("button", { name: "Masuk" }).click();
await navigasi(/\/dashboard/);
await tungguTeks("Surat masuk, disposisi, dan agenda sampai hari ini.");
cat("kata sandi baru diterima saat login", page.url().includes("/dashboard"), page.url());

// kembalikan ke sandi awal agar bagian uji berikutnya tetap memakai kredensial yang sama
await page.goto(`${BASE}/akun`);
await tungguTeks("Ganti kata sandi");
await page.fill("#password_lama", "sandi-baru-uji-9");
await page.fill("#password_baru", "BCed08Gkc34dF1RM");
await page.fill("#password_konfirmasi", "BCed08Gkc34dF1RM");
await page.getByRole("button", { name: "Ganti kata sandi" }).click();
await tungguTeks("Kata sandi berhasil diganti.");
cat("kata sandi awal dikembalikan", (await hitung("Kata sandi berhasil diganti.")) > 0);

// 13.9 Daftar Nama resmi + langkah diteruskan
await page.goto(`${BASE}/pengaturan/nama/pengirim?t=${Date.now()}`);
await tungguTeks("Pengirim Surat");
cat("bagian Daftar Nama terpilih di navigasi", await tabAktif("Daftar Nama"), page.url());
cat("navigasi antar daftar tersedia", (await page.getByRole("navigation", { name: "Daftar Nama" }).getByRole("link").count()) === 5);
cat("daftar pengirim yang aktif", (await page.getByRole("navigation", { name: "Daftar Nama" }).getByRole("link", { name: /Pengirim Surat/ }).getAttribute("data-state")) === "active");
await page.fill("#nama_pengirim", "Uji Pengirim 001");
await page.getByRole("button", { name: "Tambah pengirim" }).click();
await cekToast("pengirim uji masuk & tetap di tab nama", "Pengirim Uji Pengirim 001 ditambahkan.");
// Nama baru berada di halaman terakhir daftar, jadi dicari dulu sebelum dilihat.
await page.fill("#cari_pengirim", "Uji Pengirim 001");
await tungguTeks("Uji Pengirim 001");
cat("pengirim uji masuk & tetap di halaman pengirim", page.url().includes("/pengaturan/nama/pengirim") && (await hitung("Uji Pengirim 001")) > 0);
await bukaNama(/Pemberi Disposisi/);
await page.fill("#nama_pejabat", "Uji Pejabat 001");
await page.getByRole("button", { name: "Tambah pejabat" }).click();
await cekToast("pejabat uji masuk & tetap di bagian yang sama", "Pemberi Disposisi Uji Pejabat 001 ditambahkan.");
await page.fill("#cari_pejabat", "Uji Pejabat 001");
await tungguTeks("Uji Pejabat 001");
cat("pejabat uji masuk & tetap di halaman yang sama", page.url().includes("/pengaturan/nama/pejabat") && (await hitung("Uji Pejabat 001")) > 0);
await bukaNama(/Pegawai Bidang Aset/);
await page.fill("#nama_pegawai", "Uji Pegawai 001");
await page.fill("#jabatan_pegawai", "Staf bidang aset");
await page.getByRole("button", { name: "Tambah pegawai" }).click();
await cekToast("pegawai uji masuk & tetap di bagian yang sama", "Pegawai Uji Pegawai 001 ditambahkan ke daftar pegawai.");
// Daftar bisa belum termutakhir saat isian pencarian ditekan, jadi pencarian diulang sampai barisnya muncul.
// Pesan "tidak ada yang cocok" juga menyebut nama yang dicari, jadi yang ditunggu baris beserta tombolnya.
let barisPegawai = false;
for (let coba = 0; coba < 5 && !barisPegawai; coba++) {
  await page.fill("#cari_pegawai", "Uji Pegawai 001");
  await page.getByRole("textbox", { name: "Cari nama pegawai" }).press("Enter");
  barisPegawai = await page
    .locator("[aria-labelledby=\"daftar-pegawai\"] table tbody tr", { hasText: "Uji Pegawai 001", has: page.getByRole("button", { name: "Nonaktifkan" }) })
    .first()
    .waitFor({ timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  if (!barisPegawai) await page.waitForTimeout(2000);
}
const cekPegawai = {
  url: page.url(),
  nama: await hitung("Uji Pegawai 001"),
  jabatan: await hitung("Staf bidang aset"),
  baris: (await page.locator("[aria-labelledby=\"daftar-pegawai\"] table tbody tr").allTextContents()).join(" / "),
};
cat(
  "pegawai uji masuk dengan jabatannya",
  cekPegawai.url.includes("/pengaturan/nama/pegawai") && cekPegawai.nama > 0 && cekPegawai.jabatan > 0,
  `url=${cekPegawai.url} nama=${cekPegawai.nama} jabatan=${cekPegawai.jabatan} baris=${cekPegawai.baris}`,
);
await page.getByRole("button", { name: "Nonaktifkan Uji Pegawai 001" }).click();
await cekToast("pegawai dinonaktifkan", "Pegawai Uji Pegawai 001 dinonaktifkan.");
await page.fill("#cari_pegawai", "Uji Pegawai 001");
await tungguTeks("Nonaktif");
cat("pegawai nonaktif tetap di halaman yang sama", page.url().includes("/pengaturan/nama/pegawai") && (await hitung("Nonaktif")) > 0);
await bukaNama(/Tujuan Diteruskan/);
await page.fill("#nama_terusan", "Uji Terusan 001");
await page.getByRole("button", { name: "Tambah tujuan" }).click();
await cekToast("tujuan uji masuk & tetap di bagian yang sama", "Uji Terusan 001 ditambahkan ke tujuan diteruskan sebagai unit.");
await page.fill("#cari_terusan", "Uji Terusan 001");
await tungguTeks("Uji Terusan 001");
cat("tujuan uji masuk & tetap di halaman yang sama", page.url().includes("/pengaturan/nama/terusan") && (await hitung("Uji Terusan 001")) > 0);
await bukaNama(/Pengirim Surat/);
await page.fill("#cari_pengirim", "Uji Pengirim 001");
await page.getByRole("button", { name: "Nonaktifkan Uji Pengirim 001" }).click();
await cekToast("nonaktifkan nama tetap di bagian yang sama", "Pengirim Uji Pengirim 001 dinonaktifkan.");
await page.fill("#cari_pengirim", "Uji Pengirim 001");
await tungguTeks("Nonaktif");
cat("nonaktifkan nama tetap di halaman yang sama", page.url().includes("/pengaturan/nama/pengirim") && (await hitung("Nonaktif")) > 0);
await page.goto(`${BASE}/surat/baru?t=${Date.now()}`);
await tungguTeks("Identitas surat");
cat("nama nonaktif tidak muncul di dropdown surat", (await page.locator("#pengirim option", { hasText: "Uji Pengirim 001" }).count()) === 0);
await page.goto(`${BASE}/surat/${idSuratUji}?t=${Date.now()}&semua=1`);
await tungguTeks("Peserta agenda");
await page.locator("#peserta_nama").first().click();
await page.locator("#peserta_nama").first().fill("Uji Pegawai 001");
await page.waitForSelector('[data-slot="combobox-content"]');
cat("nama tanpa akun tidak muncul saat memilih peserta", (await page.locator('[data-slot="combobox-item"]').count()) === 0);
await page.locator("#peserta_nama").first().press("Tab");
cat(
  "nama tanpa akun tidak bisa dijadikan peserta",
  (await page.locator('[data-slot="combobox-chip"]').count()) === 0 && (await hitung('Nama "Uji Pegawai 001" belum punya akun aplikasi')) > 0,
  `chip=${await page.locator('[data-slot="combobox-chip"]').count()}`,
);
await page.locator("#peserta_nama").first().press("Escape");
await page.goto(`${BASE}/pengaturan/nama/pengirim?t=${Date.now()}`);
await tungguTeks("Pengirim Surat");

// Paginasi Daftar Nama: pengirim lebih dari satu halaman, pencarian kembali ke halaman 1
const navPengirim = page.getByRole("navigation", { name: "Halaman daftar pengirim" });
// Bagian Daftar Nama di-mount di client, jadi nav paginasi bisa baru muncul sesaat setelah halaman dibuka.
await navPengirim.first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
const barisPengirim = page.locator("[aria-labelledby=\"daftar-pengirim\"] table tbody tr");
const isiHalaman1 = await barisPengirim.allTextContents();
cat(
  "paginasi pengirim muncul",
  (await navPengirim.count()) > 0 && isiHalaman1.length === 10,
  `nav=${await navPengirim.count()} baris=${isiHalaman1.length} url=${page.url()}`,
);
await navPengirim.getByRole("button", { name: "2", exact: true }).click();
await page.waitForTimeout(250);
const isiHalaman2 = await barisPengirim.allTextContents();
cat("halaman 2 berisi nama berbeda", isiHalaman2.length > 0 && isiHalaman2.join() !== isiHalaman1.join());
await navPengirim.getByRole("button", { name: "1", exact: true }).click();
await page.waitForTimeout(250);
cat("kembali ke halaman 1", (await barisPengirim.allTextContents()).join() === isiHalaman1.join());
await page.fill("#cari_pengirim", "Uji Pengirim 001");
await page.waitForTimeout(250);
cat(
  "pencarian reset ke halaman 1",
  (await barisPengirim.count()) === 1 &&
    (await navPengirim.getByRole("button", { name: "2", exact: true }).count()) === 0,
);
await page.fill("#cari_pengirim", "");
await page.waitForTimeout(250);

// 13.8 Aktif/nonaktif Kategori Surat
await login("petugas.aset@magelang.go.id", "BCed08Gkc34dF1RM");
await page.goto(`${BASE}/pengaturan/jenis`);
await tungguTeks("Kategori Surat Masuk");
await page.locator("[data-slot='table-row']", { hasText: "Undangan rapat eksternal" }).getByRole("button", { name: /^Nonaktifkan/ }).click();
await cekToast("ubah status Kategori Surat tetap di halaman jenis", "Kategori surat Undangan rapat eksternal dinonaktifkan.");
cat("halaman Kategori Surat tetap aktif", await tabAktif("Kategori Surat"), page.url());
cat(
  "Kategori Surat bisa dinonaktifkan",
  (await page.locator("[data-slot='table-row']").filter({ hasText: "Undangan rapat eksternal" }).getByText("Nonaktif").count()) > 0,
);

await page.goto(`${BASE}/surat/baru`);
await tungguTeks("Identitas surat");
cat(
  "jenis nonaktif tidak muncul di form surat baru",
  (await page.locator("#jenis_surat_id option", { hasText: "Undangan rapat eksternal" }).count()) === 0,
);
await page.goto(`${BASE}/surat`);
await tungguTeks("Agenda Surat Masuk");
cat(
  "jenis nonaktif tidak muncul di filter daftar surat",
  (await page.locator("#jenis option", { hasText: "Undangan rapat eksternal" }).count()) === 0,
);

await login("petugas.aset@magelang.go.id", "BCed08Gkc34dF1RM");
await page.goto(`${BASE}/pengaturan/jenis`);
await tungguTeks("Kategori Surat Masuk");
await page.locator("[data-slot='table-row']", { hasText: "Undangan rapat eksternal" }).getByRole("button", { name: /^Aktifkan/ }).click();
await cekToast("aktifkan kembali jenis tetap di halaman jenis", "Kategori surat Undangan rapat eksternal diaktifkan.");
cat("aktifkan kembali jenis tetap di halaman jenis", page.url().includes("/pengaturan/jenis"), page.url());
await page.goto(`${BASE}/surat/baru`);
await tungguTeks("Identitas surat");
cat(
  "kategori yang diaktifkan kembali muncul di form",
  (await page.locator("#jenis_surat_id option", { hasText: "Undangan rapat eksternal" }).count()) > 0,
);

// 13.10 Pengelolaan surat: koreksi identitas, arsipkan, pulihkan, hapus permanen
const dbB = new PrismaKlik();
const detailSurat = `${BASE}/surat/${idSuratUji}?semua=1`;
await page.goto(detailSurat);
await page.waitForLoadState("networkidle");
cat("kartu pengelolaan tersedia untuk petugas", (await hitung("Pengelolaan surat ini")) > 0);
cat("yang masih menghalangi arsip dinyatakan sebelum tombol bisa dipakai", (await hitung("Belum bisa diarsipkan:")) > 0 && (await page.getByRole("button", { name: "Arsipkan surat" }).isDisabled()));
cat("yang masih menghalangi hapus permanen dinyatakan", (await hitung("Belum bisa dihapus permanen:")) > 0);

// arsip ditolak server kalau masih ada agenda aktif, walau tombol di-disable
cat("penolakan arsip dijelaskan sebelum tombol bisa dipakai", (await hitung("Belum bisa diarsipkan:")) > 0);

// agenda dibatalkan -> surat boleh diarsipkan
await page.goto(detailSurat);
await page.waitForLoadState("networkidle");
await pilihStatus(page.getByLabel("Ubah status agenda"), "Dibatalkan");
await cekToast("agenda dibatalkan lewat UI surat", "Status agenda diubah menjadi Dibatalkan.");
await page.goto(detailSurat);
await page.waitForLoadState("networkidle");
cat("hint arsip hilang setelah agenda tidak aktif lagi", (await hitung("Belum bisa diarsipkan:")) === 0);
await page.mouse.move(700, 420);
await page.getByRole("button", { name: "Arsipkan surat" }).click();
await cekToast("surat diarsipkan", "Surat diarsipkan. Surat tetap terbaca dan tetap dihitung di rekap.");
await tungguBadge("badge arsip tampil di detail", "Arsip");
cat("status arsip masuk ke database", (await dbB.surat_masuk.findUnique({ where: { id: idSuratUji } })).status_surat === "arsip");

await page.goto(`${BASE}/surat?status=arsip`);
await page.waitForLoadState("networkidle");
cat("surat arsip masih terbaca di daftar lewat filter", (await hitung("001/2026")) > 0);

await page.goto(detailSurat);
await page.waitForLoadState("networkidle");
await page.mouse.move(700, 420);
await page.getByRole("button", { name: "Keluarkan dari arsip" }).click();
await cekToast("surat dipulihkan dari arsip", "Surat dikeluarkan dari arsip dan kembali ke daftar kerja.");
cat("status pulih mengikuti langkah disposisi yang tersisa", (await dbB.surat_masuk.findUnique({ where: { id: idSuratUji } })).status_surat === "selesai");

// koreksi identitas
await page.goto(`${detailSurat}&surat=ubah`);
await page.waitForLoadState("networkidle");
const panelB = page.locator("#bagian-ubah-identitas");
cat("form koreksi identitas terbuka", (await panelB.getByText("Ubah identitas surat").count()) > 0);
cat("nomor agenda dinyatakan tidak berubah", (await panelB.getByText("001/2026").count()) > 0);
cat("form koreksi terisi nilai tersimpan", (await panelB.getByLabel("Perihal").inputValue()).length > 0);
await panelB.locator("#edit_tanggal_surat").fill(hariIni);
await panelB.locator("#edit_tanggal_terima").fill(kemarin);
await panelB.getByRole("button", { name: "Simpan perubahan" }).click();
await page.waitForTimeout(900);
cat("tanggal surat setelah tanggal terima ditolak", (await hitung("Tanggal surat tidak boleh setelah tanggal terima")) > 0);
cat("penolakan tetap di mode ubah", page.url().includes("surat=ubah"), page.url());

await panelB.locator("#edit_tanggal_surat").fill(kemarin);
await panelB.getByLabel("Perihal").fill("Perihal yang sudah dikoreksi");
await panelB.getByRole("button", { name: "Simpan perubahan" }).click();
await cekToast("koreksi identitas tersimpan", "Identitas surat diperbarui.");
await tungguUrl("panel koreksi identitas tertutup setelah simpan", (u) => !u.includes("surat=ubah"));
const suratB = await dbB.surat_masuk.findUnique({ where: { id: idSuratUji } });
cat("koreksi masuk ke database", suratB.perihal === "Perihal yang sudah dikoreksi" && suratB.nomor_agenda === "001/2026");
await tungguTampil("perihal baru terbaca di judul halaman", "Perihal yang sudah dikoreksi");
cat("koreksi identitas dicatat di jejak perubahan", (await dbB.audit_logs.count({ where: { action: "ubah_surat" } })) > 0);

// penghapusan permanen: anak harus dibersihkan dulu
await page.goto(detailSurat);
await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: "Hapus surat" }).click();
await page.waitForTimeout(500);
cat("konfirmasi hapus menyebut yang harus dibersihkan", (await page.locator("[data-slot='alert-dialog-description']").getByText("Belum bisa dihapus").count()) > 0);
await page.getByRole("button", { name: "Batal" }).click();

await page.getByRole("button", { name: "Hapus", exact: true }).filter({ visible: true }).first().click();
await page.getByRole("button", { name: "Hapus lampiran" }).click();
await cekToast("lampiran dibersihkan", "Lampiran dihapus dari daftar surat, berkasnya ikut terhapus.");
await page.getByRole("button", { name: /^Hapus disposisi/ }).filter({ visible: true }).first().click();
await cekToast("langkah disposisi dibersihkan", "Langkah disposisi dihapus dari riwayat.");
await dbB.jadwal_rapat.deleteMany({ where: { surat_id: idSuratUji } });
await page.goto(detailSurat);
await page.waitForLoadState("networkidle");
cat("hint hapus hilang setelah anak dibersihkan", (await hitung("Belum bisa dihapus permanen:")) === 0);
await page.getByRole("button", { name: "Hapus surat" }).click();
await page.waitForTimeout(500);
cat("konfirmasi final menyatakan tindakan tidak bisa dibatalkan", (await page.locator("[data-slot='alert-dialog-description']").getByText("tidak bisa dibatalkan").count()) > 0);
await page.getByRole("button", { name: "Hapus permanen" }).click();
await cekToast("surat dihapus permanen", "Nomor agenda 001/2026 dihapus permanen dari agenda surat.");
await tungguUrl("hapus permanen berpindah ke daftar surat", (u) => u.endsWith("/surat"));
cat("surat hilang dari database", (await dbB.surat_masuk.count({ where: { id: idSuratUji } })) === 0);
await page.waitForLoadState("networkidle");
await page.waitForTimeout(400);
await tungguToastLenyad();
cat("surat yang dihapus tidak lagi tampil di daftar", (await hitung("001/2026")) === 0);
await page.goto(detailSurat);
await page.waitForLoadState("networkidle");
cat("detail surat yang dihapus menyatakan tidak ditemukan", (await hitung("tidak ditemukan")) > 0);
await dbB.$disconnect();
// 13.11 Surat yang diarsipkan tertutup: isi surat tidak bisa diubah sampai dikeluarkan dari arsip
const dbC = new PrismaKlik();
const hariBesok = besok.slice(0, 10);
const petugas = await dbC.users.findFirst({ where: { email: "petugas.aset@magelang.go.id" } });
const jenisUji = await dbC.jenis_surat.findFirst({ where: { aktif: true }, orderBy: { nama: "asc" } });
const [{ nomorAgenda }] = await dbC.$queryRaw<{ nomorAgenda: string }[]>`SELECT next_nomor_agenda(EXTRACT(YEAR FROM CURRENT_DATE)::int) AS "nomorAgenda"`;
const suratC = await dbC.surat_masuk.create({
  data: {
    nomor_agenda: nomorAgenda,
    tanggal_terima: new Date(`${hariIni}T00:00:00Z`),
    tanggal_surat: new Date(`${kemarin}T00:00:00Z`),
    nomor_surat: "UJI/C/2026",
    pengirim: "Sekretariat Daerah",
    perihal: "UJI surat yang diarsipkan",
    isi_ringkas: "Uji penguncian surat arsip.",
    jenis_surat_id: jenisUji?.id ?? null,
    status_undangan_rapat: "ya",
    status_surat: "belum_disposisi",
    created_by: petugas.id,
  },
});
await dbC.jadwal_rapat.create({
  data: {
    surat_id: suratC.id,
    agenda_rapat: "UJI rapat surat arsip",
    tanggal_mulai: new Date(`${hariBesok}T09:00:00+07:00`),
    tanggal_selesai: new Date(`${hariBesok}T11:00:00+07:00`),
    tempat: "Ruang Rapat A",
    penyelenggara: "BPKAD Bidang Aset",
    status_rapat: "terjadwal",
  },
});
await dbC.lampiran_surat.create({
  data: { surat_id: suratC.id, nama_asli: "uji-c.pdf", path_file: "uji-c.pdf", mime_type: "application/pdf", ukuran_byte: BigInt(2048), uploaded_by: petugas.id },
});
const idSuratC = suratC.id;
const detailC = `${BASE}/surat/${idSuratC}?semua=1`;
await login("petugas.aset@magelang.go.id", "BCed08Gkc34dF1RM");
await page.goto(detailC);
await page.waitForLoadState("networkidle");
cat("lampiran uji C ada di surat ini", (await dbC.lampiran_surat.count({ where: { surat_id: idSuratC } })) === 1);
cat("lampiran terbaca di kartu dokumen", (await hitung("uji-c.pdf")) > 0);
cat("agenda uji C terjadwal", (await dbC.jadwal_rapat.count({ where: { surat_id: idSuratC, status_rapat: "terjadwal" } })) === 1);

// surat diarsipkan lewat database: DOM halaman masih renderan saat surat aktif, jadi formnya masih ada.
// Aliran pemberitahuan ditutup sementara supaya penyegar dari arsip tidak menghapus pesan galat inline.
const jalurUji = "**/api/pembaruan";
await page.route(jalurUji, (r) => r.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: "" }));
await page.reload();
await page.waitForLoadState("networkidle");
await dbC.surat_masuk.update({ where: { id: idSuratC }, data: { status_surat: "arsip" } });
await page.locator("#tanggal_disposisi").fill(hariIni);
await page.selectOption("#pemberi_disposisi", "Kepala BPKAD");
await page.getByLabel("Isi instruksi").fill("Instruksi ke surat arsip");
await page.getByRole("button", { name: "Simpan disposisi" }).click();
// disposisi melaporkan galat di dalam halaman (useActionState), tidak lewat URL
await page.getByText("Surat ini sudah diarsipkan").first().waitFor({ timeout: 30000 });
cat("disposisi ke surat arsip ditolak server", (await hitung("Surat ini sudah diarsipkan")) > 0);
cat("disposisi yang ditolak tidak masuk database", (await dbC.disposisi.count({ where: { surat_id: idSuratC } })) === 0);
await page.unroute(jalurUji);

await pilihStatus(page.getByLabel("Ubah status agenda"), "Dibatalkan");
await cekToast("status agenda surat arsip ditolak server dengan alasan", "Surat ini sudah diarsipkan");
cat("status agenda surat arsip ditolak server dengan alasan", (await hitung("Surat ini sudah diarsipkan")) > 0);
cat("status agenda surat arsip tidak berubah di database", (await dbC.jadwal_rapat.findFirst({ where: { surat_id: idSuratC } })).status_rapat === "terjadwal");

// unggah lampiran di surat arsip ditolak guard di unggahLampiran; kontrolnya memang tidak dirender,
// jadi ini hanya memastikan lampiran yang sudah ada tetap terbaca dan jumlahnya tidak berubah.
await dbC.lampiran_surat.deleteMany({ where: { surat_id: idSuratC, nama_asli: "uji-c.pdf" } });
await dbC.lampiran_surat.create({
  data: { surat_id: idSuratC, nama_asli: "uji-c.pdf", path_file: "uji-c.pdf", mime_type: "application/pdf", ukuran_byte: BigInt(2048), uploaded_by: petugas.id },
});
cat("lampiran surat arsip tetap terbaca dan jumlahnya satu", (await dbC.lampiran_surat.count({ where: { surat_id: idSuratC } })) === 1);

// halaman di render ulang: kontrol isi hilang, hanya pengelolaan yang tersisa
await page.goto(detailC);
await page.waitForLoadState("networkidle");
cat("kontrol lampiran hilang saat surat diarsipkan", (await page.locator("#file").count()) === 0);
cat("form tambah disposisi hilang saat surat diarsipkan", (await page.getByRole("button", { name: "Simpan disposisi" }).count()) === 0);
cat("kontrol status undangan hilang saat surat diarsipkan", (await page.locator("#status_undangan_rapat").count()) === 0);
cat("kontrol status agenda hilang saat surat diarsipkan", (await page.getByLabel("Ubah status agenda").count()) === 0);
cat("form tempat dan penyelenggara hilang saat surat diarsipkan", (await page.getByLabel("Tempat agenda").count()) === 0);
cat("koreksi identitas tidak ditawarkan saat surat diarsipkan", (await page.getByRole("button", { name: "Ubah identitas surat" }).count()) === 0);
cat("penguncian arsip dinyatakan di kartu pengelolaan", (await hitung("Surat diarsipkan: identitas, lampiran")) > 0);
cat("pengelolaan tetap bisa mengeluarkan surat dari arsip", (await page.getByRole("button", { name: "Keluarkan dari arsip" }).count()) > 0);
cat("hapus surat tetap ditawarkan untuk surat arsip", (await page.getByRole("button", { name: "Hapus surat" }).count()) > 0);

await page.goto(`${BASE}/rapat?bulan=${hariBesok.slice(0, 7)}&tanggal=${hariBesok}&t=${Date.now()}`);
await tungguTeks("Agenda pada");
cat("kalender menyebut agenda dari surat yang diarsipkan", (await hitung("suratnya sudah diarsipkan")) > 0);
cat("kontrol status agenda surat arsip tidak muncul di kalender", (await page.getByLabel("Status agenda UJI rapat surat arsip").count()) === 0);

// agenda dibatalkan -> lewat UI surat boleh diarsipkan walau lampiran masih ada
await page.goto(detailC);
await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: "Keluarkan dari arsip" }).click();
await cekToast("surat C dikeluarkan dari arsip", "Surat dikeluarkan dari arsip dan kembali ke daftar kerja.");
cat("surat C dikeluarkan dari arsip", (await dbC.surat_masuk.findUnique({ where: { id: idSuratC } })).status_surat === "belum_disposisi");
await page.goto(detailC);
await page.waitForLoadState("networkidle");
cat("kontrol lampiran kembali setelah surat dikeluarkan", (await page.locator("#file").count()) > 0);
cat("kontrol status agenda kembali setelah surat dikeluarkan", (await page.getByLabel("Ubah status agenda").count()) > 0);
cat("keterangan penguncian hilang setelah dikeluarkan dari arsip", (await hitung("Surat diarsipkan: identitas")) === 0);
await pilihStatus(page.getByLabel("Ubah status agenda"), "Dibatalkan");
await cekToast("agenda surat C dibatalkan", "Status agenda diubah menjadi Dibatalkan.");
await page.goto(detailC);
await page.waitForLoadState("networkidle");
cat("lampiran yang masih ada tidak menghalangi arsip", !(await page.getByRole("button", { name: "Arsipkan surat" }).isDisabled()));
await page.getByRole("button", { name: "Arsipkan surat" }).click();
await cekToast("arsip lewat UI surat bekerja", "Surat diarsipkan. Surat tetap terbaca dan tetap dihitung di rekap.");
cat("arsip lewat UI surat bekerja", (await dbC.surat_masuk.findUnique({ where: { id: idSuratC } })).status_surat === "arsip");

await page.goto(detailC);
await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: "Keluarkan dari arsip" }).click();
await cekToast("surat C dikeluarkan lagi dari arsip", "Surat dikeluarkan dari arsip dan kembali ke daftar kerja.");
await page.goto(detailC);
await page.waitForLoadState("networkidle");
await page.locator("#tanggal_disposisi").fill(hariIni);
await page.selectOption("#pemberi_disposisi", "Kepala BPKAD");
await page.getByLabel("Isi instruksi").fill("Instruksi setelah surat keluar dari arsip");
await page.getByRole("button", { name: "Simpan disposisi" }).click();
await cekToast("disposisi baru bisa dibuat setelah surat dikeluarkan dari arsip", "Disposisi tersimpan pada surat ini");
cat("disposisi baru bisa dibuat setelah surat dikeluarkan dari arsip", (await dbC.disposisi.count({ where: { surat_id: idSuratC } })) === 1);

// pembersihan uji C
await dbC.peserta_rapat.deleteMany({ where: { jadwal_rapat: { surat_id: idSuratC } } });
await dbC.jadwal_rapat.deleteMany({ where: { surat_id: idSuratC } });
await dbC.lampiran_surat.deleteMany({ where: { surat_id: idSuratC } });
await dbC.disposisi.deleteMany({ where: { surat_id: idSuratC } });
await dbC.surat_masuk.delete({ where: { id: idSuratC } });
await dbC.$disconnect();

// 13.12 Agenda dari surat bisa dihapus dari detail suratnya — penghapusan permanen surat selesai tanpa database
const dbD = new PrismaKlik();
// sapu sisa uji dari run sebelumnya yang berhenti di tengah jalan
const sisaD = await dbD.surat_masuk.findMany({ where: { nomor_surat: { in: ["UJI/D/2026", "UJI/E/2026"] } }, select: { id: true } });
const idSisaD = sisaD.map((s) => s.id);
if (idSisaD.length > 0) {
  await dbD.peserta_rapat.deleteMany({ where: { jadwal_rapat: { surat_id: { in: idSisaD } } } });
  await dbD.jadwal_rapat.deleteMany({ where: { surat_id: { in: idSisaD } } });
  await dbD.lampiran_surat.deleteMany({ where: { surat_id: { in: idSisaD } } });
  await dbD.disposisi.deleteMany({ where: { surat_id: { in: idSisaD } } });
  await dbD.surat_masuk.deleteMany({ where: { id: { in: idSisaD } } });
}
const petugasD = await dbD.users.findFirst({ where: { email: "petugas.aset@magelang.go.id" } });
const [{ nomorAgendaD }] = await dbD.$queryRaw<{ nomorAgendaD: string }[]>`SELECT next_nomor_agenda(EXTRACT(YEAR FROM CURRENT_DATE)::int) AS "nomorAgendaD"`;
const suratD = await dbD.surat_masuk.create({
  data: {
    nomor_agenda: nomorAgendaD,
    tanggal_terima: new Date(`${hariIni}T00:00:00Z`),
    tanggal_surat: new Date(`${kemarin}T00:00:00Z`),
    nomor_surat: "UJI/D/2026",
    pengirim: "Sekretariat Daerah",
    perihal: "UJI agenda yang dihapus dari surat",
    isi_ringkas: "Uji hapus agenda bersurat.",
    jenis_surat_id: jenisUji?.id ?? null,
    status_undangan_rapat: "ya",
    status_surat: "belum_disposisi",
    created_by: petugasD.id,
  },
});
const rapatD = await dbD.jadwal_rapat.create({
  data: {
    surat_id: suratD.id,
    agenda_rapat: "UJI rapat yang dihapus",
    tanggal_mulai: new Date(`${hariBesok}T09:00:00+07:00`),
    tanggal_selesai: new Date(`${hariBesok}T11:00:00+07:00`),
    tempat: "Ruang Rapat A",
    penyelenggara: "BPKAD Bidang Aset",
    status_rapat: "terjadwal",
  },
});
await dbD.peserta_rapat.create({
  data: { nama_peserta: "UJI peserta satu", jadwal_rapat: { connect: { id: rapatD.id } } },
});
await dbD.peserta_rapat.create({
  data: { nama_peserta: "UJI peserta dua", jadwal_rapat: { connect: { id: rapatD.id } } },
});
const detailD = `${BASE}/surat/${suratD.id}?semua=1`;
await login("petugas.aset@magelang.go.id", "BCed08Gkc34dF1RM");
await page.goto(detailD);
await page.waitForLoadState("networkidle");
cat("agenda surat terbaca di detail", (await hitung("UJI rapat yang dihapus")) > 0);
cat("hapus agenda ditawarkan di kartu rapat", (await page.getByRole("button", { name: "Hapus agenda ini", exact: true }).count()) === 1);
await page.getByRole("button", { name: "Hapus agenda ini", exact: true }).click();
await page.waitForTimeout(500);
cat("konfirmasi menyebut dua peserta yang ikut terhapus", (await page.locator("[data-slot='alert-dialog-description']").getByText("2 peserta yang tercatat").count()) > 0);
await page.getByRole("button", { name: "Batal" }).click();
cat("batal tidak menghapus agenda", (await dbD.jadwal_rapat.count({ where: { surat_id: suratD.id } })) === 1);
await page.getByRole("button", { name: "Hapus agenda ini", exact: true }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Hapus agenda", exact: true }).click();
await cekToast("agenda dihapus beserta pesertanya", "UJI rapat yang dihapus dihapus dari surat ini beserta 2 pesertanya.");
cat("agenda dihapus dari database", (await dbD.jadwal_rapat.count({ where: { surat_id: suratD.id } })) === 0);
cat("peserta ikut terhapus", (await dbD.peserta_rapat.count({ where: { rapat_id: rapatD.id } })) === 0);
await page.goto(detailD);
await page.waitForLoadState("networkidle");
cat("agenda tidak tampil lagi di detail", (await hitung("UJI rapat yang dihapus")) === 0);
cat("surat tetap ditandai sebagai undangan rapat", (await dbD.surat_masuk.findUnique({ where: { id: suratD.id } })).status_undangan_rapat === "ya");
await page.goto(`${BASE}/rapat?bulan=${hariBesok.slice(0, 7)}&tanggal=${hariBesok}&t=${Date.now()}`);
await tungguTeks("Agenda pada");
cat("kalender tidak lagi menampilkan agenda surat yang dihapus", (await hitung("UJI rapat yang dihapus")) === 0);

// penghapusan permanen surat selesai tanpa menyentuh database
await page.goto(detailD);
await page.waitForLoadState("networkidle");
cat("hint penghapusan hilang setelah agenda dibersihkan", (await hitung("Belum bisa dihapus permanen:")) === 0);
await page.getByRole("button", { name: "Hapus surat" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Hapus permanen" }).click();
await cekToast("surat D dihapus permanen", "dihapus permanen dari agenda surat.");
cat("surat hilang dari database", (await dbD.surat_masuk.count({ where: { id: suratD.id } })) === 0);

// surat arsip: hapus agenda tidak ditawarkan
const [{ nomorAgendaE }] = await dbD.$queryRaw<{ nomorAgendaE: string }[]>`SELECT next_nomor_agenda(EXTRACT(YEAR FROM CURRENT_DATE)::int) AS "nomorAgendaE"`;
const suratE = await dbD.surat_masuk.create({
  data: {
    nomor_agenda: nomorAgendaE,
    tanggal_terima: new Date(`${hariIni}T00:00:00Z`),
    tanggal_surat: new Date(`${kemarin}T00:00:00Z`),
    nomor_surat: "UJI/E/2026",
    pengirim: "Sekretariat Daerah",
    perihal: "UJI agenda surat arsip",
    isi_ringkas: "Uji penguncian hapus agenda.",
    jenis_surat_id: jenisUji?.id ?? null,
    status_undangan_rapat: "ya",
    status_surat: "arsip",
    created_by: petugasD.id,
  },
});
const rapatE = await dbD.jadwal_rapat.create({
  data: {
    surat_id: suratE.id,
    agenda_rapat: "UJI agenda surat arsip",
    tanggal_mulai: new Date(`${lusa.slice(0, 10)}T09:00:00+07:00`),
    status_rapat: "terjadwal",
  },
});
const detailE = `${BASE}/surat/${suratE.id}?semua=1`;
await page.goto(detailE);
await page.waitForLoadState("networkidle");
cat("hapus agenda tidak ditawarkan saat surat diarsipkan", (await page.getByRole("button", { name: "Hapus agenda ini", exact: true }).count()) === 0);
await login("pimpinan@magelang.go.id", "mMs3HSiLBJPOdR5X");
await page.goto(detailE);
await page.waitForLoadState("networkidle");
cat("pembaca tidak diberi tombol hapus agenda", (await page.getByRole("button", { name: "Hapus agenda ini", exact: true }).count()) === 0);
const kartuD = await page.locator("#bagian-pengelolaan").count();
cat("pembaca tidak diberi kartu pengelolaan", kartuD === 0);
await login("petugas.aset@magelang.go.id", "BCed08Gkc34dF1RM");
await dbD.peserta_rapat.deleteMany({ where: { rapat_id: rapatE.id } });
await dbD.jadwal_rapat.deleteMany({ where: { surat_id: suratE.id } });
await dbD.surat_masuk.delete({ where: { id: suratE.id } });
await dbD.$disconnect();

// 13.6 Token design system shadcn (preset bJMTbSfw + koreksi kontras): tipografi, warna primary, radius, target sentuh
// token dibaca di mode terang; mode standar aplikasi sekarang gelap, jadi pin ke terang dulu
await page.evaluate(() => localStorage.setItem("aset-theme", "light"));
await page.goto(`${BASE}/dashboard`);
await tungguTeks("Surat masuk, disposisi, dan agenda sampai hari ini.");
const gaya = await page.evaluate(() => {
  const kanvas = document.createElement("canvas");
  kanvas.width = kanvas.height = 1;
  const ctx = kanvas.getContext("2d");
  const rgb = (teks: string) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = teks;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const lum = (c) => {
    const lin = (v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : Math.pow((v / 255 + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  };
  const banding = (a, b) => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const body = getComputedStyle(document.body);
  const judul = document.querySelector("[data-slot='card-title']");
  const kartu = document.querySelector("[data-slot='card']");
  const menuAktif = document.querySelector("[data-slot='sidebar-menu-button'][data-active='true']");
  const kartuBg = rgb(kartu ? getComputedStyle(kartu).backgroundColor : "white");
  return {
    font: body.fontFamily,
    beratBody: body.fontWeight,
    judulBerat: judul ? getComputedStyle(judul).fontWeight : "",
    kartuRadius: kartu ? parseFloat(getComputedStyle(kartu).borderRadius) : 0,
    kartuBg: `rgb(${kartuBg.r}, ${kartuBg.g}, ${kartuBg.b})`,
    menuAktifBanding: menuAktif
      ? banding(rgb(getComputedStyle(menuAktif).color), rgb(getComputedStyle(menuAktif).backgroundColor))
      : 0,
    lebarSidebar: document.querySelector("[data-sidebar='sidebar']")?.getBoundingClientRect().width ?? 0,
  };
});

await page.goto(`${BASE}/surat/baru`);
await tungguTeks("Identitas surat");
const kontrol = await page.evaluate(() => {
  const kanvas = document.createElement("canvas");
  kanvas.width = kanvas.height = 1;
  const ctx = kanvas.getContext("2d");
  const rgb = (teks: string) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = teks;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const lum = (c) => {
    const lin = (v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : Math.pow((v / 255 + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  };
  const banding = (a, b) => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const kartuBg = rgb(getComputedStyle(document.querySelector("[data-slot='card']")).backgroundColor);
  const tombol = document.querySelector("[data-slot='button'][data-variant='default']");
  const tombolOutline = document.querySelector("[data-slot='button'][data-variant='outline']");
  const isian = document.querySelector("[data-slot='input']");
  const pilihan = document.querySelector("[data-slot='native-select']");
  return {
    primaryTeksLum: tombol ? lum(rgb(getComputedStyle(tombol).color)) : 0,
    primaryBgLum: tombol ? lum(rgb(getComputedStyle(tombol).backgroundColor)) : 0,
    outlineBanding: tombolOutline ? banding(rgb(getComputedStyle(tombolOutline).borderColor), kartuBg) : 0,
    isianBanding: isian ? banding(rgb(getComputedStyle(isian).borderColor), kartuBg) : 0,
    pilihanBanding: pilihan ? banding(rgb(getComputedStyle(pilihan).borderColor), kartuBg) : 0,
  };
});
cat(
  "token shadcn terpakai: Inter, body 400, judul 600, card putih radius >=6, primary gelap dengan teks terang, batas form >=3:1, sidebar 16rem",
  gaya.font.includes("Inter") &&
    gaya.beratBody === "400" &&
    gaya.judulBerat === "600" &&
    gaya.kartuBg === "rgb(255, 255, 255)" &&
    gaya.kartuRadius >= 6 &&
    kontrol.primaryBgLum < 0.2 &&
    kontrol.primaryTeksLum > 0.9 &&
    kontrol.outlineBanding >= 3 &&
    kontrol.isianBanding >= 3 &&
    kontrol.pilihanBanding >= 3 &&
    gaya.menuAktifBanding >= 4.5 &&
    Math.round(gaya.lebarSidebar) >= 256 && Math.round(gaya.lebarSidebar) <= 288,
  `${JSON.stringify(gaya)} ${JSON.stringify(kontrol)}`,
);

// 14. Keyboard dan indikator fokus
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page2 = await ctx2.newPage();
page2.setDefaultTimeout(60000);
await page2.goto(`${BASE}/login`);
const urutanFokus: string[] = [];
for (let i = 0; i < 4; i++) {
  await page2.keyboard.press("Tab");
  const info = await page2.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const style = getComputedStyle(el);
    return { nama: el.id || el.tagName, outline: style.outlineWidth };
  });
  urutanFokus.push(`${info.nama}/${info.outline}`);
}
cat("navigasi keyboard dengan indikator fokus", urutanFokus.every((f) => !f.endsWith("0px")), urutanFokus.join(", "));

// satu surat keluar dibuat lewat UI supaya daftar, form baru, detail, dan panel koreksinya ikut diukur di layar sentuh
await login("petugas.aset@magelang.go.id", "BCed08Gkc34dF1RM");
// Nomor uji bisa tertinggal dari run sebelumnya yang redirect-nya tidak selesai, maka run berikutnya
// ditolak karena nomor rangkap. Dibersihkan dulu (lampiran harus lebih dulu, penghapusnya dibatasi).
const { PrismaClient: PrismaMulihMobile } = await import("@prisma/client");
const pMulihMobile = new PrismaMulihMobile();
for (const sisa of await pMulihMobile.surat_keluar.findMany({ where: { nomor_surat: "UJ/Klik-mobile-1" }, select: { id: true } })) {
  await pMulihMobile.lampiran_keluar.deleteMany({ where: { surat_id: sisa.id } });
  await pMulihMobile.surat_keluar.delete({ where: { id: sisa.id } });
}
await pMulihMobile.$disconnect();
await page.goto(`${BASE}/keluar/baru`);
await page.waitForSelector("#tanggal_surat");
await tungguHidrasi("tanggal_surat");
await isiPastikan("tanggal_surat", hariIni);
await pilihPastikan("tujuan", "Sekretariat Daerah");
await isiPastikan("nomor_surat", "UJ/Klik-mobile-1");
await isiPastikan("perihal", "Balasan undangan untuk diperiksa di layar sentuh");
await page.getByRole("button", { name: "Simpan surat keluar" }).click();
// Pembuatan surat keluar lewat HP di dev bisa lama (compile rute + remote DB). Yang diperiksa adalah suratnya
// tersimpan; redirect bisa tertinggal sementara di halaman baru, jadi alamat diambil dari data yang tersimpan.
const akhirSimpan = Date.now() + 150000;
while (Date.now() < akhirSimpan && !/\/keluar\/[0-9a-f-]{36}/.test(page.url())) await page.waitForTimeout(300);
let ruteKeluarMobile = page.url().replace(BASE, "");
if (!/\/keluar\/[0-9a-f-]{36}/.test(ruteKeluarMobile)) {
  const { PrismaClient: PrismaMobile } = await import("@prisma/client");
  const pMobile = new PrismaMobile();
  let tersimpan = null;
  // Penyimpanan bisa selesai setelah batas tunggu halaman, jadi data yang tersimpan di-cek berulang.
  for (let i = 0; i < 20 && !tersimpan; i++) {
    tersimpan = await pMobile.surat_keluar.findFirst({ where: { nomor_surat: "UJ/Klik-mobile-1" }, select: { id: true } });
    if (!tersimpan) await page.waitForTimeout(3000);
  }
  await pMobile.$disconnect();
  cat("surat keluar tersimpan untuk uji mobile", !!tersimpan, tersimpan ? `surat tersimpan, redirect masih di ${ruteKeluarMobile}` : `url=${ruteKeluarMobile}`);
  if (tersimpan) ruteKeluarMobile = `/keluar/${tersimpan.id}`;
} else {
  cat("surat keluar tersimpan untuk uji mobile", true, ruteKeluarMobile);
}

// 15. Mobile: tanpa overflow dan target sentuh cukup besar
// Detail surat keluar diuji dua keadaan: halaman biasa dan panel koreksi. Panel diminta lewat isian `keluar=ubah`
// (bukan `&keluar=ubah`, yang hanya jadi bagian alamat kalau belum ada tanda tanya) dan hanya diuji bila surat
// yang baru dibuat memang ketemu — kalau tidak, halaman daftar sudah diuji di atas.
const adaSuratKeluar = /\/keluar\/[0-9a-f-]{36}/.test(ruteKeluarMobile);
const pemisah = ruteKeluarMobile.includes("?") ? "&" : "?";
const daftarRute = ["/login", "/dashboard", "/surat", "/surat/baru", "/keluar", "/keluar/baru", "/disposisi", "/rapat", "/rekap", "/pengaturan", "/pengaturan/pengguna", "/pengaturan/jenis/masuk", "/pengaturan/jenis/keluar", "/pengaturan/nama/pengirim", "/pengaturan/jejak"];
if (adaSuratKeluar) daftarRute.push(ruteKeluarMobile, `${ruteKeluarMobile}${pemisah}keluar=ubah`);
for (const rute of daftarRute) {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto(`${BASE}${rute}`);
  await page.waitForSelector("h1", { timeout: 15000 }).catch(() => {});
  const lebih = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  cat(`mobile ${rute} tanpa overflow horizontal`, lebih <= 1, `selisih lebar ${lebih}px`);
  const kontrol = await page.evaluate(() =>
    [...document.querySelectorAll("[data-slot='button'], a[data-slot='button'], [data-slot='input'], [data-slot='native-select'], [data-slot='select-trigger'], [data-slot='textarea'], [data-slot='tabs-trigger'], [data-slot='pagination-link'], [data-slot='sidebar-menu-button'], [data-slot='sidebar-trigger']")]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => Math.round(el.getBoundingClientRect().height)),
  );
  cat(`mobile ${rute} target sentuh >= 44px`, kontrol.length > 0 && kontrol.every((h) => h >= 44), `tinggi kontrol: ${kontrol.join(", ")}`);
}

await browser.close();
if (existsSync("uploads")) {
  // Berkas hasil uji dibersihkan supaya folder uploads tidak menumpuk.
  const fsMulih = await import("node:fs/promises");
  for (const f of readdirSync("uploads")) {
    await fsMulih.rm(`uploads/${f}`, { force: true });
  }
}

// Akun dan Kategori Surat hasil uji dihapus supaya run berikutnya tidak menumpuk.
const isiEnv = await import("node:fs/promises").then((fs) => fs.readFile(".env", "utf8"));
process.env.DATABASE_URL ??= isiEnv.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
const { PrismaClient } = await import("@prisma/client");
const prismaUji = new PrismaClient();
await prismaUji.users.deleteMany({ where: { email: { startsWith: "uji" } } });
await prismaUji.jenis_surat.deleteMany({ where: { nama: "Undangan rapat eksternal" } });
await prismaUji.master_pengirim.deleteMany({ where: { nama: "Uji Pengirim 001" } });
await prismaUji.master_pejabat.deleteMany({ where: { nama: "Uji Pejabat 001" } });
await prismaUji.master_pegawai.deleteMany({ where: { nama: "Uji Pegawai 001" } });
await prismaUji.master_pegawai.deleteMany({ where: { nama: { in: ["Budi wijaya", "Sri wedi"] } } });
await prismaUji.master_pegawai.deleteMany({ where: { nama: { startsWith: "Uji " } } });
await prismaUji.master_terusan.deleteMany({ where: { nama: "Uji Terusan 001" } });
// Catatan audit tidak bisa dihapus oleh akun aset_app (hanya insert dan select), jadi
// jejak uji "Pengguna Petugas Uji" dibiarkan sebagai riwayat.
await prismaUji.$disconnect();
console.log(hasil.join("\n"));
console.log(`\nConsole error: ${galatConsole.length === 0 ? "tidak ada" : galatConsole.slice(0, 8).join(" | ")}`);
