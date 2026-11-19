import { selesaikanTurnstile } from "./turnstile.mts";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { kunciMonitorAktif } from "./kunci-monitor-aktif.mts";
import "dotenv/config";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.UJI_EMAIL ?? "petugas.aset@magelang.go.id";
const PASSWORD = process.env.UJI_PASSWORD ?? "BCed08Gkc34dF1RM";
const hasil: string[] = [];
const cek = (nama: string, ok: boolean) => hasil.push(`${ok ? "PASS" : "FAIL"} ${nama}`);

const prisma = new PrismaClient();
const kunci = await kunciMonitorAktif(prisma);
const tanggalJakarta = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const kemarin = tanggalJakarta(new Date(Date.now() - 86_400_000));
const hariIni = tanggalJakarta(new Date());
/** Waktu dua menit ke depan dalam WIB; cukup untuk agenda yang belum tiba tanpa melewati tengah malam. */
const duaMenitDepan = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
  .formatToParts(new Date(Date.now() + 120_000));
const ambil = (jenis: string) => duaMenitDepan.find((p) => p.type === jenis)?.value ?? "";
const nanti = `${ambil("year")}-${ambil("month")}-${ambil("day")}T${ambil("hour")}:${ambil("minute")}:00+07:00`;

/** Waktu Jakarta dari sebuah momen; agenda uji memakai jam relatif ke sekarang supaya tes jalan kapan pun. */
const waktuJakarta = (d: Date) => {
  const bagian = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(d);
  const ambil = (jenis: string) => bagian.find((i) => i.type === jenis)?.value ?? "";
  return `${ambil("year")}-${ambil("month")}-${ambil("day")}T${ambil("hour")}:${ambil("minute")}:00+07:00`;
};
const awalHariIni = new Date(`${hariIni}T00:30:00+07:00`);
const sekarang = new Date();
const jamLewat = waktuJakarta(Math.max(sekarang.getTime() - 45 * 60_000, awalHariIni.getTime()));
const jamLewatBaru = waktuJakarta(Math.max(sekarang.getTime() - 10 * 60_000, awalHariIni.getTime()));
const jamTiba = waktuJakarta(Math.max(sekarang.getTime() - 20 * 60_000, awalHariIni.getTime()));

const petugas = await prisma.users.findFirst({ where: { email: EMAIL }, select: { id: true } });
const dibuat: string[] = [];
async function buat(agenda: string, mulai: string, selesai: string | null, status: string) {
  const r = await prisma.jadwal_rapat.create({
    data: {
      agenda_rapat: agenda,
      tanggal_mulai: new Date(mulai),
      tanggal_selesai: selesai ? new Date(selesai) : null,
      tempat: "Ruang Rapat A",
      penyelenggara: "BPKAD",
      status_rapat: status,
      terbit: true,
      catatan: "UJI SELESAI OTOMATIS",
      created_by: petugas?.id ?? null,
    },
  });
  dibuat.push(r.id);
  return r;
}

const besok = tanggalJakarta(new Date(Date.now() + 86_400_000));
// 1. kemarin tanpa waktu selesai  2. kemarin dengan selesai jam 10:00  3. hari ini sampai jam yang sudah lewat
// 4. hari ini tanpa waktu selesai (mulai nanti)  5. hari ini mulai jam yang sudah tiba  6. besok (belum waktunya)
const tanpaSelesaiKemarin = await buat("Uji otomatis tanpa selesai", `${kemarin}T09:00:00+07:00`, null, "terjadwal");
const selesaiKemarin = await buat("Uji otomatis selesai kemarin", `${kemarin}T09:00:00+07:00`, `${kemarin}T10:00:00+07:00`, "berlangsung");
const lewatHariIni = await buat("Uji otomatis jam lewat", jamLewat, jamLewatBaru, "terjadwal");
const belumSelesaiHariIni = await buat("Uji belum lewat tanpa selesai", nanti, null, "terjadwal");
const sedangHariIni = await buat("Uji berlangsung otomatis", jamTiba, null, "terjadwal");
const belumTiba = await buat("Uji belum waktunya", `${besok}T09:00:00+07:00`, null, "terjadwal");

const browser = await chromium.launch({ channel: "chrome", headless: false });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const galat: string[] = [];
let sudahMasuk = false;
page.on("console", (m) => { if (m.type() === "error" && sudahMasuk) galat.push(m.text()); });
page.on("response", (r) => { if (r.status() >= 400 && sudahMasuk && !r.url().includes("/api/pembaruan")) galat.push(`${r.status()} ${r.url()}`); });

await page.goto(`${BASE}/login`);
await page.waitForTimeout(2500);
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await selesaikanTurnstile(page);
await page.getByRole("button", { name: "Masuk" }).click();
await page.waitForURL(`${BASE}/dashboard`, { timeout: 30_000 });
sudahMasuk = true;
await page.waitForTimeout(1500);

const status = async (id: string) => (await prisma.jadwal_rapat.findUnique({ where: { id }, select: { status_rapat: true } }))?.status_rapat;
cek("tanpa waktu selesai: status jadi selesai setelah berganti hari", (await status(tanpaSelesaiKemarin.id)) === "selesai");
cek("dengan waktu selesai: status jadi selesai saat jam selesai lewat", (await status(selesaiKemarin.id)) === "selesai");
cek("dengan waktu selesai pada hari ini: status jadi selesai setelah jamnya lewat", (await status(lewatHariIni.id)) === "selesai");
cek("hari ini tanpa waktu selesai: belum diubah karena hari belum berganti", (await status(belumSelesaiHariIni.id)) === "terjadwal");
cek("waktu mulai tiba tanpa waktu selesai: status jadi berlangsung", (await status(sedangHariIni.id)) === "berlangsung");
cek("agenda yang belum waktunya: tidak diubah", (await status(belumTiba.id)) === "terjadwal");

const jejak = await prisma.audit_logs.findFirst({ where: { entity_type: "jadwal_rapat", entity_id: tanpaSelesaiKemarin.id, description: { contains: "selesai otomatis" } }, select: { description: true } });
cek("perubahan otomatis dicatat di jejak perubahan data", !!jejak);
const jejakRun = await prisma.audit_logs.findFirst({ where: { entity_type: "jadwal_rapat", entity_id: sedangHariIni.id, description: { contains: "berlangsung otomatis" } }, select: { description: true } });
cek("perubahan ke berlangsung dicatat di jejak", !!jejakRun);
await page.goto(`${BASE}/pengaturan/jejak`);
await page.waitForTimeout(1500);
cek("jejak otomatis terbaca di halaman History", (await page.locator("body").textContent() ?? "").includes("selesai otomatis"));

// Pilihan status di kalender: "berlangsung" dan "sudah dilaksanakan" tidak pernah jadi pilihan manual.
async function opsiStatusUji(): Promise<{ nilai: string; opsi: string[] }[]> {
  const pemicu = page.locator('[data-slot="select-trigger"][aria-label^="Status agenda"]');
  const baris: { nilai: string; opsi: string[] }[] = [];
  const jumlah = await pemicu.count();
  for (let i = 0; i < jumlah; i++) {
    const t = pemicu.nth(i);
    const nilai = (await t.textContent() ?? "").trim();
    await t.click();
    await page.waitForTimeout(300);
    const opsi = (await page.locator('[data-slot="select-item"]').allTextContents()).map((x) => x.trim());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    baris.push({ nilai, opsi });
  }
  return baris;
}

const unik = (a: string[]) => a.filter((v, i) => a.indexOf(v) === i);

await page.goto(`${BASE}/rapat?bulan=${hariIni.slice(0, 7)}&tanggal=${hariIni}`);
await page.waitForTimeout(1500);
const barisHariIni = await opsiStatusUji();
const opsiHariIni = unik(barisHariIni.flatMap((b) => b.opsi));
cek(
  "status otomatis hanya muncul sebagai status yang sedang tercatat",
  barisHariIni.every((b) => !b.opsi.includes("Berlangsung") || b.nilai === "Berlangsung"),
);
cek("jadwal ulang dan batal tetap ditawarkan", opsiHariIni.includes("Dijadwalkan ulang") && opsiHariIni.includes("Dibatalkan"));

await page.goto(`${BASE}/rapat?bulan=${kemarin.slice(0, 7)}&tanggal=${kemarin}`);
await page.waitForTimeout(1500);
const opsiLewat = unik((await opsiStatusUji()).flatMap((b) => b.opsi));
cek("agenda yang lewat: tidak menawarkan berlangsung atau terjadwal", !opsiLewat.includes("Berlangsung") && !opsiLewat.includes("Terjadwal"));
cek("agenda yang lewat: sudah dilaksanakan masih bisa dipilih manual", opsiLewat.includes("Sudah dilaksanakan"));
cek("agenda yang lewat: masih bisa dijadwalkan ulang dan dibatalkan", opsiLewat.includes("Dijadwalkan ulang") && opsiLewat.includes("Dibatalkan"));

await page.goto(`${BASE}/rapat?bulan=${besok.slice(0, 7)}&tanggal=${besok}`);
await page.waitForTimeout(1500);
const opsiDepan = unik((await opsiStatusUji()).flatMap((b) => b.opsi));
cek("agenda yang belum waktunya: menawarkan terjadwal dan sudah dilaksanakan, tidak menawarkan berlangsung", opsiDepan.includes("Terjadwal") && opsiDepan.includes("Sudah dilaksanakan") && !opsiDepan.includes("Berlangsung"));
// Token API untuk uji penolakan status dari aplikasi Android.
const masuk = await fetch(`${BASE}/api/masuk`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
const sesi = await masuk.json();
cek("token API bisa dibuat", !!sesi.token);
const ubahLewat = await fetch(`${BASE}/api/agenda/${tanpaSelesaiKemarin.id}`, {
  method: "PATCH",
  headers: { authorization: `Bearer ${sesi.token}`, "content-type": "application/json" },
  body: JSON.stringify({ status_rapat: "berlangsung" }),
});
cek("API menolak status berlangsung untuk agenda yang sudah lewat", ubahLewat.status === 400);
cek("galat API menjelaskan status otomatis", (await ubahLewat.json()).pesan?.includes("berubah sendiri") ?? false);
const ubahSelesai = await fetch(`${BASE}/api/agenda/${belumTiba.id}`, {
  method: "PATCH",
  headers: { authorization: `Bearer ${sesi.token}`, "content-type": "application/json" },
  body: JSON.stringify({ status_rapat: "selesai" }),
});
cek("API menerima status selesai yang dipilih manual", ubahSelesai.status === 200);
cek("status selesai tersimpan dari API", (await status(belumTiba.id)) === "selesai");
const ubahOk = await fetch(`${BASE}/api/agenda/${belumTiba.id}`, {
  method: "PATCH",
  headers: { authorization: `Bearer ${sesi.token}`, "content-type": "application/json" },
  body: JSON.stringify({ status_rapat: "dibatalkan" }),
});
cek("API menerima status yang masuk akal", ubahOk.status === 200);

cek("tidak ada galat console", galat.length === 0);
if (galat.length) console.log("galat:", galat.join(" | "));

await browser.close();
for (const id of dibuat) {
  await prisma.riwayat_jadwal_rapat.deleteMany({ where: { rapat_id: id } });
  await prisma.audit_logs.deleteMany({ where: { entity_type: "jadwal_rapat", entity_id: id } });
  await prisma.jadwal_rapat.delete({ where: { id } });
}
await prisma.$disconnect();

console.log(hasil.join("\n"));
const gagal = hasil.filter((h) => h.startsWith("FAIL")).length;
console.log(`${hasil.length} pemeriksaan, ${gagal} gagal`);
if (gagal > 0) process.exit(1);
