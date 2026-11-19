import { selesaikanTurnstile } from "./turnstile.mts";
// Monitor layar penuh: kunci akses, agenda yang dipublish, perpindahan layar, dan bahwa agenda yang
// disembunyikan dari monitor benar-benar tidak tampil. Jalan sendiri; tidak butuh login di layar monitor.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { kunciMonitorAktif } from "./kunci-monitor-aktif.mts";
import "dotenv/config";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.LOGIN_EMAIL ?? "petugas.aset@magelang.go.id";
const PASSWORD = process.env.LOGIN_PASSWORD ?? "BCed08Gkc34dF1RM";
const TUNGGU = 12_000;

const prisma = new PrismaClient();
const KUNCI = await kunciMonitorAktif(prisma);
let lulus = 0;
let gagal = 0;
const consoleGalat: string[] = [];

function cek(nama: string, kondisi: boolean, detail = "") {
  if (kondisi) {
    lulus++;
    console.log(`PASS  ${nama}`);
  } else {
    gagal++;
    console.log(`FAIL  ${nama}${detail ? ` — ${detail}` : ""}`);
  }
}

async function teks(page: import("playwright").Page, selector: string) {
  return (await page.locator(selector).first().textContent().catch(() => ""))?.trim() ?? "";
}

async function tampil(page: import("playwright").Page, teks: string, dalam = TUNGGU) {
  try {
    await page.locator(`text=${teks}`).first().waitFor({ timeout: dalam });
    return true;
  } catch {
    return false;
  }
}

async function adaElement(page: import("playwright").Page, selector: string, dalam = TUNGGU) {
  try {
    await page.locator(selector).first().waitFor({ timeout: dalam });
    return true;
  } catch {
    return false;
  }
}

async function klik(page: import("playwright").Page, nama: string) {
  await page.locator(`button:has-text("${nama}"), a:has-text("${nama}")`).first().click();
}

// Layar monitor di 1920×1080: teks yang terbaca dari jarak ~3 meter, tanpa elemen yang terpotong.
async function cekTV(page: import("playwright").Page, nama: string) {
  const ukuran = await page.evaluate(() => ({
    lebar: document.documentElement.scrollWidth,
    tinggi: document.documentElement.scrollHeight,
    viewport: { w: innerWidth, h: innerHeight },
    judul: getComputedStyle(document.querySelector("main h2") ?? document.body).fontSize,
    angka: getComputedStyle(document.querySelector(".num") ?? document.body).fontSize,
  }));
  cek(`${nama}: tidak ada gulung horizontal di 1920×1080`, ukuran.lebar <= 1920, `lebar ${ukuran.lebar}`);
  cek(`${nama}: tidak ada gulung vertikal di layar TV`, ukuran.tinggi <= ukuran.viewport.h, `tinggi ${ukuran.tinggi} dari ${ukuran.viewport.h}`);
  cek(`${nama}: judul panel minimal 20px`, Number(ukuran.judul.replace("px", "")) >= 20, `judul ${ukuran.judul}`);
  cek(`${nama}: angka/jam minimal 28px`, Number(ukuran.angka.replace("px", "")) >= 28, `angka ${ukuran.angka}`);
}

async function utama() {
  if (!KUNCI) {
    console.log("SKIP  MONITOR_TOKEN tidak dipasang — uji monitor tidak jalan");
    return;
  }

  // Hapus agenda di kalender perlu konfirmasi lewat AlertDialog.
async function hapusKalender(page: import("playwright").Page, target: { click(): Promise<void> }) {
  await target.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Hapus agenda", exact: true }).click();
}

const browser = await chromium.launch({ channel: "chrome", headless: false });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("console", (m) => {
    // Halaman masuk dan layar tanpa kunci memang belum punya sesi, jadi langganan pembaruan dijawab 401
    // — itu bukan galat aplikasi.
    if (m.type() === "error" && m.text().includes("401") && (page.url().includes("/login") || page.url().includes("/monitor"))) return;
    if (m.type() === "error") consoleGalat.push(`${page.url()} : ${m.text()}`);
  });
  page.on("pageerror", (e) => consoleGalat.push(`${page.url()} : ${e.message}`));

  // Kunci akses: tanpa kunci tidak ada data yang tampil; kunci salah juga ditolak.
  await page.goto(`${BASE}/monitor`);
  await page.waitForTimeout(1500);
  cek("monitor tanpa kunci tidak menampilkan angka", !(await adaElement(page, ".num", 2000)));
  await page.goto(`${BASE}/monitor?t=kunci-salah-sekali`);
  await page.waitForTimeout(1500);
  cek("monitor dengan kunci salah ditolak", await tampil(page, "Kunci monitor tidak cocok"));

  // Buat agenda hari ini lewat dialog agenda mandiri supaya monitor punya isi.
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(2500);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await selesaikanTurnstile(page);
await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(`${BASE}/dashboard`, { timeout: TUNGGU });
  await page.waitForTimeout(1500);

  const namaAgenda = `Uji monitor ${Date.now()}`;
  const mulai = new Date(Date.now() + 60 * 60 * 1000);
  const jamMulai = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(mulai);
  const tanggalMulai = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(mulai);

  // Dialog agenda mandiri ada di halaman kalender rapat.
  await page.goto(`${BASE}/rapat?bulan=${tanggalMulai.slice(0, 7)}&tanggal=${tanggalMulai}`);
  await page.waitForTimeout(2500);
  await klik(page, "Buat agenda sendiri");
  await page.waitForTimeout(1200);
  await page.fill("#baru_agenda", namaAgenda);
  await page.fill("#baru_mulai", `${tanggalMulai}T${jamMulai}`);
  await page.fill("#baru_tempat", "Ruang Rapat Aset");
  await page.fill("#baru_penyelenggara", "Bidang Aset");
  await page.getByRole("button", { name: "Buat agenda" }).click();
  await page.waitForTimeout(3000);

  const rapat = await prisma.jadwal_rapat.findFirst({ where: { agenda_rapat: namaAgenda } });
  cek("agenda uji tersimpan", !!rapat);

  // Monitor: agenda hari ini tampil dengan jam dan tempat.
  await page.goto(`${BASE}/monitor?t=${KUNCI}`);
  await page.waitForTimeout(2500);
  cek("monitor menampilkan agenda yang dipublish", await tampil(page, namaAgenda));
  cek("monitor menampilkan jam agenda", await adaElement(page, `text=${jamMulai}`));
  cek("monitor menampilkan tempat", await tampil(page, "Ruang Rapat Aset"));
  cek("monitor menampilkan statistik bulan berjalan", await adaElement(page, "text=Surat masuk bulan ini"));
  await cekTV(page, "layar agenda");

  // Layar bisa dijeda dan dipilih manual — pengunjung yang sedang membaca tidak kehilangan halamannya.
  const statusLayar = page.locator("footer p.num").first();
  await page.getByRole("button", { name: "Jeda pergantian layar" }).click();
  await page.waitForTimeout(1200);
  cek("tombol jeda menghentikan pergantian", (await statusLayar.textContent())?.includes("dijeda"));
  const teksJeda = await statusLayar.textContent();
  await page.waitForTimeout(5000);
  cek("layar yang dijeda tidak berpindah", (await statusLayar.textContent()) === teksJeda);
  await page.getByRole("button", { name: "Lanjutkan pergantian layar" }).click();
  await page.waitForTimeout(1200);
  cek("tombol lanjut melanjutkan pergantian", !(await statusLayar.textContent())?.includes("dijeda"));

  // Setiap layar bisa dipilih lewat tombol di footer.
  await page.getByRole("button", { name: "Tampilkan Statistik" }).click();
  await page.waitForTimeout(900);
  cek("tombol footer membuka layar statistik", (await page.locator('section[aria-hidden="false"]').first().textContent())?.includes("Surat masuk bulan ini"));
  await page.getByRole("button", { name: "Tampilkan Grafik" }).click();
  await page.waitForTimeout(1500);
  cek("layar grafik menampilkan panel grafik", await tampil(page, "Surat masuk per bulan"));
  cek("layar grafik menampilkan komposisi kategori surat", await tampil(page, "Komposisi kategori surat"));
  await cekTV(page, "layar grafik");

  // Keyboard: anak panah berganti layar, Spasi menjeda.
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(900);
  cek("panah kiri kembali ke layar statistik", (await page.locator('section[aria-hidden="false"]').first().textContent())?.includes("Surat masuk bulan ini"));
  await page.keyboard.press("Space");
  await page.waitForTimeout(900);
  cek("spasi menjeda layar", (await statusLayar.textContent())?.includes("dijeda"));
  await page.keyboard.press("Space");
  await page.waitForTimeout(900);

  // Layar berganti sendiri: agenda -> statistik. Setelah 20 detik dari layar agenda harus pindah.
  await page.getByRole("button", { name: "Tampilkan Agenda" }).click();
  await page.waitForTimeout(21_000);
  cek("layar berganti sendiri ke statistik setelah 20 detik", (await page.locator('section[aria-hidden="false"]').first().textContent())?.includes("Surat masuk bulan ini"));
  await cekTV(page, "layar statistik");

  // Agenda yang disembunyikan dari monitor tidak lagi tampil di layar.
  await page.goto(`${BASE}/rapat?bulan=${tanggalMulai.slice(0, 7)}&tanggal=${tanggalMulai}`);
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: `Sembunyikan agenda ${namaAgenda} dari layar monitor` }).click();
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/monitor?t=${KUNCI}`);
  await page.waitForTimeout(2500);
  cek("agenda yang disembunyikan hilang dari monitor", !(await tampil(page, namaAgenda, 3000)));

  // Bersihkan agenda uji.
  await page.goto(`${BASE}/rapat?bulan=${tanggalMulai.slice(0, 7)}&tanggal=${tanggalMulai}`);
  await page.waitForTimeout(2500);
  await hapusKalender(page, page.getByRole("button", { name: `Hapus agenda ${namaAgenda}` }));
  await page.waitForTimeout(3000);
  const sisa = await prisma.jadwal_rapat.findFirst({ where: { agenda_rapat: namaAgenda } });
  cek("agenda uji dihapus", !sisa);

  // Balas kunci monitor lewat Pengaturan: kunci baru berlaku, kunci lama ditolak seketika.
  const kunciLama = KUNCI;
  const dbSebelum = await prisma.monitor_token.findFirst({ where: { aktif: true }, select: { token: true } });
  const riwayatSebelum = await prisma.monitor_token.count({ where: { aktif: false } });
  await page.goto(`${BASE}/pengaturan/monitor`);
  await page.waitForTimeout(2000);
  cek("pengaturan menampilkan alamat layar dengan kunci aktif", await adaElement(page, `input[value="${kunciLama}"]`, 2000));
  await klik(page, "Balas kunci monitor");
  await page.waitForTimeout(600);
  await page.getByRole("alertdialog").getByRole("button", { name: "Buat kunci baru" }).click();
  await page.waitForTimeout(3000);
  const baru = await prisma.monitor_token.findFirst({ where: { aktif: true }, select: { token: true } });
  cek("kunci baru berbeda dari kunci lama", !!baru && baru.token !== kunciLama);
  cek("hanya satu kunci yang aktif", (await prisma.monitor_token.count({ where: { aktif: true } })) === 1);
  const riwayatBaru = await prisma.monitor_token.count({ where: { aktif: false } });
  cek(
    "kunci lama disimpan sebagai riwayat",
    dbSebelum ? riwayatBaru === riwayatSebelum + 1 : riwayatBaru === riwayatSebelum,
    dbSebelum ? `${riwayatSebelum} -> ${riwayatBaru}` : "kunci sebelumnya masih dari .env",
  );
  await page.goto(`${BASE}/pengaturan/monitor`);
  await page.waitForTimeout(2000);
  cek("pengaturan menampilkan kunci baru", baru ? await adaElement(page, `input[value="${baru.token}"]`, 2000) : false);
  await page.goto(`${BASE}/monitor?t=${kunciLama}`);
  await page.waitForTimeout(1800);
  cek("monitor dengan kunci lama ditolak", await tampil(page, "Kunci monitor tidak cocok"));
  await page.goto(`${BASE}/monitor?t=${baru?.token ?? ""}`);
  await page.waitForTimeout(1800);
  cek("monitor dengan kunci baru terbuka", await adaElement(page, "text=Surat masuk bulan ini", 3000));

  await browser.close();
}

utama()
  .catch((e) => {
    gagal++;
    console.log(`FAIL  ${e instanceof Error ? e.stack : String(e)}`);
  })
  .finally(async () => {
    cek("tidak ada galat console", consoleGalat.length === 0, consoleGalat.join("\n"));
    console.log(`\n${lulus} PASS / ${gagal} FAIL / ${consoleGalat.length} galat console`);
    await prisma.$disconnect();
    process.exit(gagal > 0 ? 1 : 0);
  });
