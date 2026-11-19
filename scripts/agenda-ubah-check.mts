import { selesaikanTurnstile } from "./turnstile.mts";
/**
 * Pemeriksa ubah agenda mandiri di kalender: agenda tanpa surat punya tombol "Ubah agenda", dialognya
 * terisi nilai yang ada, simpan mengubah judul/waktu/tempat/catatan di database tanpa hapus-then-input,
 * agenda dari surat tidak punya tombol ubah di kalender, akun lain tidak bisa mengubah agenda milik orang
 * lain, dan di HP barisnya tetap muat tanpa gulir mendatar.
 * Jalankan: npm run test:agenda-ubah (butuh server dev di http://localhost:3000)
 */
import { chromium } from "playwright";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.UJI_EMAIL ?? "petugas.aset@magelang.go.id";
const PASSWORD = process.env.UJI_PASSWORD ?? "BCed08Gkc34dF1RM";
const EMAIL_PIMPINAN = process.env.UJI_EMAIL_PIMPINAN ?? "pimpinan@magelang.go.id";
const PASSWORD_PIMPINAN = process.env.UJI_PASSWORD_PIMPINAN ?? "mMs3HSiLBJPOdR5X";

const hasil: string[] = [];
const cek = (nama: string, ok: boolean, detail = "") => {
  hasil.push(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? `  (${detail})` : ""}`);
  console.log(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? `  (${detail})` : ""}`);
};

const prisma = new PrismaClient();
const petugas = await prisma.users.findFirst({ where: { email: EMAIL }, select: { id: true, name: true } });
/** Waktu dalam Asia/Jakarta tanpa offset, untuk isian datetime-local dan untuk membuat baris uji. */
function jamJakarta(d: Date): string {
  const bagian = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const ambil = (jenis: string) => bagian.find((p) => p.type === jenis)?.value ?? "";
  return `${ambil("year")}-${ambil("month")}-${ambil("day")}T${ambil("hour")}:${ambil("minute")}`;
}
// Waktu uji ditentukan dari saat sekarang, bukan dari jam laptop yang bisa berbeda dari jam server.
// Hari yang dibuka kemudian adalah hari agenda itu menurut database.
const mulaiUjiInstan = Date.now() + 2 * 3_600_000;
const selesaiUjiInstan = Date.now() + 3 * 3_600_000;

// Sisa uji dari jalanan sebelumnya dibersihkan dulu supaya daftar agenda uji tidak menumpuk.
await prisma.jadwal_rapat.deleteMany({ where: { agenda_rapat: { startsWith: "Uji ubah kalender" } } });
await prisma.master_pegawai.deleteMany({ where: { nama: { startsWith: "Uji peserta agenda" } } });

// Akun uji untuk dipilih sebagai peserta: peserta hanya bisa dari akun aplikasi yang aktif.
await prisma.users.deleteMany({ where: { email: { startsWith: "uji.peserta.agenda" } } });
const peranUji = await prisma.roles.findFirst({ select: { id: true } });
const pegawaiUji = await prisma.users.create({
  data: { email: `uji.peserta.agenda.satu.${Date.now()}@magelang.go.id`, name: "Uji peserta agenda satu", password_hash: await bcrypt.hash("sandiuji", 10), role_id: peranUji!.id, is_active: true },
});
const pegawaiUji2 = await prisma.users.create({
  data: { email: `uji.peserta.agenda.dua.${Date.now()}@magelang.go.id`, name: "Uji peserta agenda dua", password_hash: await bcrypt.hash("sandiuji", 10), role_id: peranUji!.id, is_active: true },
});

// Agenda uji baru, milik petugas, pada hari agenda itu sendiri.
const uji = await prisma.jadwal_rapat.create({
  data: {
    agenda_rapat: "Uji ubah kalender",
    tanggal_mulai: new Date(mulaiUjiInstan),
    tanggal_selesai: new Date(selesaiUjiInstan),
    tempat: "Ruang Rapat A",
    penyelenggara: "BPKAD",
    catatan: "bawa daftar inventaris C1",
    status_rapat: "terjadwal",
    terbit: true,
    created_by: petugas?.id ?? null,
  },
});

const mulaiUji = jamJakarta(uji.tanggal_mulai);
const selesaiUji = jamJakarta(uji.tanggal_selesai ?? uji.tanggal_mulai);
const hariIni = mulaiUji.slice(0, 10);
const bulanIni = hariIni.slice(0, 7);

const browser = await chromium.launch({ channel: "chrome", headless: false });
const galatConsole: string[] = [];
let masuk = false;

async function halaman(viewport: { width: number; height: number }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  page.on("console", (m) => {
    if (m.type() === "error" && masuk) galatConsole.push(m.text());
  });
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(2000);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await selesaikanTurnstile(page);
await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 30_000 });
  masuk = true;
  return page;
}

const page = await halaman({ width: 1280, height: 900 });
await page.goto(`${BASE}/rapat?bulan=${bulanIni}&tanggal=${hariIni}`);
await page.waitForTimeout(2000);

const adaBaris = await page.getByText(uji.agenda_rapat).count();
cek("agenda uji tampil di detail tanggal", adaBaris > 0, `count=${adaBaris}`);

const tombolUbah = page.getByRole("button", { name: `Ubah agenda ${uji.agenda_rapat}`, exact: true });
cek("agenda mandiri punya tombol Ubah agenda", await tombolUbah.count() === 1);

await tombolUbah.click();
await page.waitForTimeout(600);
cek("dialog ubah menyebut agenda yang diubah", await page.getByRole("dialog").getByText(`Ubah agenda ${uji.agenda_rapat}`).count() === 1);
cek("dialog ubah tidak memakai judul buat agenda", await page.getByRole("dialog").getByText("Buat agenda sendiri").count() === 0);
cek("isian terisi judul yang ada", await page.locator("#ubah-" + uji.id + "_agenda").inputValue() === "Uji ubah kalender");
cek("isian terisi waktu mulai yang ada", await page.locator("#ubah-" + uji.id + "_mulai").inputValue() === mulaiUji);
cek("isian terisi waktu selesai yang ada", await page.locator("#ubah-" + uji.id + "_selesai").inputValue() === selesaiUji);
cek("isian terisi tempat yang ada", await page.locator("#ubah-" + uji.id + "_tempat").inputValue() === "Ruang Rapat A");
cek("isian terisi catatan yang ada", await page.locator("#ubah-" + uji.id + "_catatan").inputValue() === "bawa daftar inventaris C1");
cek("tombol simpan bernama Simpan perubahan", await page.getByRole("button", { name: "Simpan perubahan" }).count() === 1);

// Waktu baru ditulis sebagai tanggal hari ini menjelang malam, bukan Date.now() + n jam: kalau uji
// jalan lewat tengah malam, sekarang + 5 jam jatuh ke besok dan barisnya hilang dari halaman hari ini.
const baruMulai = `${hariIni}T23:00`;
const baruSelesai = `${hariIni}T23:30`;
await page.locator("#ubah-" + uji.id + "_agenda").fill("Uji ubah kalender diperbarui");
await page.locator("#ubah-" + uji.id + "_mulai").fill(baruMulai);
await page.locator("#ubah-" + uji.id + "_selesai").fill(baruSelesai);
await page.locator("#ubah-" + uji.id + "_tempat").fill("Ruang Rapat B");
await page.locator("#ubah-" + uji.id + "_penyelenggara").fill("Bagian Perlengkapan");
await page.locator("#ubah-" + uji.id + "_catatan").fill(" bawa data serah terima ");
await page.getByRole("button", { name: "Simpan perubahan" }).click();
await page.waitForURL(/\/rapat\?/, { timeout: 30_000 });
await page.waitForTimeout(2500);
cek("kalender menampilkan pesan perubahan tersimpan", await page.getByText("Agenda Uji ubah kalender diperbarui diperbarui.").count() === 1);

const setelah = await prisma.jadwal_rapat.findUnique({ where: { id: uji.id } });
cek("judul agenda berubah di database", setelah?.agenda_rapat === "Uji ubah kalender diperbarui");
cek("waktu mulai berubah di database", setelah?.tanggal_mulai.toISOString() === new Date(`${baruMulai}:00+07:00`).toISOString());
cek("waktu selesai berubah di database", setelah?.tanggal_selesai?.toISOString() === new Date(`${baruSelesai}:00+07:00`).toISOString());
cek("tempat berubah di database", setelah?.tempat === "Ruang Rapat B");
cek("penyelenggara berubah di database", setelah?.penyelenggara === "Bagian Perlengkapan");
cek("catatan berubah di database", setelah?.catatan === "bawa data serah terima");
cek("status agenda tidak berubah karena ubah detail", setelah?.status_rapat === "terjadwal");

const jejak = await prisma.audit_logs.findFirst({ where: { entity_type: "jadwal_rapat", entity_id: uji.id, description: { contains: "menjadi Uji ubah kalender diperbarui" } }, select: { description: true } });
cek("ubah agenda dicatat di jejak perubahan data", !!jejak);

// Agenda dari surat tidak diubah di kalender — tetap di halaman suratnya.
const agendaSurat = await prisma.jadwal_rapat.findFirst({ where: { surat_id: { not: null } }, select: { id: true, agenda_rapat: true } });
if (agendaSurat) {
  const hariSurat = await prisma.jadwal_rapat.findUnique({ where: { id: agendaSurat.id }, select: { tanggal_mulai: true } });
  const tanggalSurat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(hariSurat!.tanggal_mulai);
  await page.goto(`${BASE}/rapat?bulan=${tanggalSurat.slice(0, 7)}&tanggal=${tanggalSurat}`);
  await page.waitForTimeout(2000);
  cek("agenda dari surat tidak punya tombol ubah di kalender", await page.getByRole("button", { name: `Ubah agenda ${agendaSurat.agenda_rapat}`, exact: true }).count() === 0);
}

// Validasi: waktu selesai sebelum waktu mulai ditolak, agenda tidak berubah.
await page.goto(`${BASE}/rapat?bulan=${bulanIni}&tanggal=${hariIni}`);
await page.waitForTimeout(2000);
await page.getByRole("button", { name: "Ubah agenda Uji ubah kalender diperbarui", exact: true }).click();
await page.waitForTimeout(600);
await page.locator("#ubah-" + uji.id + "_selesai").fill(`${hariIni}T22:00`);
await page.getByRole("button", { name: "Simpan perubahan" }).click();
await page.waitForURL(/agenda=galat/, { timeout: 30_000 });
await page.waitForTimeout(2000);
cek("waktu selesai sebelum waktu mulai ditolak", await page.getByText(/Waktu selesai tidak boleh mendahului/).count() === 1);
cek("agenda tidak berubah saat ditolak", (await prisma.jadwal_rapat.findUnique({ where: { id: uji.id }, select: { tanggal_selesai: true } }))?.tanggal_selesai?.toISOString() === new Date(`${baruSelesai}:00+07:00`).toISOString());

// Akun lain (pimpinan) tidak mendapat tombol ubah pada agenda milik petugas.
const ctxPimpinan = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pagePimpinan = await ctxPimpinan.newPage();
pagePimpinan.setDefaultTimeout(60_000);
await pagePimpinan.goto(`${BASE}/login`);
await pagePimpinan.waitForTimeout(2000);
await pagePimpinan.fill("#email", EMAIL_PIMPINAN);
await pagePimpinan.fill("#password", PASSWORD_PIMPINAN);
await selesaikanTurnstile(pagePimpinan);
await pagePimpinan.getByRole("button", { name: "Masuk" }).click();
await pagePimpinan.waitForURL(`${BASE}/dashboard`, { timeout: 30_000 });
await pagePimpinan.goto(`${BASE}/rapat?bulan=${bulanIni}&tanggal=${hariIni}`);
await pagePimpinan.waitForTimeout(2000);
cek("akun lain tidak melihat tombol ubah agenda milik orang lain", await pagePimpinan.getByRole("button", { name: /^Ubah agenda/ }).count() === 0);

// Peserta saat membuat agenda sendiri: pembuatnya otomatis ikut, nama lain dipilih dari daftar pegawai.
await page.goto(`${BASE}/rapat?bulan=${bulanIni}&tanggal=${hariIni}`);
await page.waitForTimeout(2000);
await page.getByRole("button", { name: "Ubah agenda Uji ubah kalender diperbarui", exact: true }).click();
await page.waitForTimeout(600);
cek("dialog ubah punya isian peserta", await page.locator(`#ubah-${uji.id}_peserta`).count() === 1);
await page.locator(`#ubah-${uji.id}_peserta`).click();
await page.waitForTimeout(400);
await page.keyboard.type(pegawaiUji.name);
await page.waitForTimeout(600);
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Simpan perubahan" }).click();
await page.waitForURL(/\/rapat\?/, { timeout: 30_000 });
await page.waitForTimeout(2500);
let pesertaUbah = await prisma.peserta_rapat.findMany({ where: { rapat_id: uji.id }, select: { nama_peserta: true } });
cek("peserta baru ditambahkan dari dialog ubah", pesertaUbah.some((p) => p.nama_peserta === pegawaiUji.name));
cek("peserta yang sudah ada tidak hilang saat ubah", pesertaUbah.length === 1);

// Membuat agenda sendiri lewat dialog: pembuatnya otomatis tercatat, satu nama lain dipilih.
await page.getByRole("button", { name: "Buat agenda sendiri" }).first().click();
await page.waitForTimeout(600);
cek("dialog buat punya isian peserta", await page.locator("#baru_peserta").count() === 1);
cek("dialog menyebut pembuat otomatis jadi peserta", await page.getByRole("dialog").getByText(`Kamu (${petugas?.name ?? ""}) otomatis tercatat sebagai peserta`).count() === 1);
await page.locator("#baru_agenda").fill("Uji ubah kalender peserta");
await page.locator("#baru_mulai").fill(mulaiUji);
await page.locator("#baru_selesai").fill(selesaiUji);
await page.locator("#baru_peserta").click();
await page.waitForTimeout(400);
await page.keyboard.type(pegawaiUji2.name);
await page.waitForTimeout(600);
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Buat agenda" }).click();
await page.waitForURL(/agenda=ok/, { timeout: 30_000 });
await page.waitForTimeout(2500);
const agendaPeserta = await prisma.jadwal_rapat.findFirst({ where: { agenda_rapat: "Uji ubah kalender peserta" }, select: { id: true, tanggal_mulai: true } });
cek("agenda dengan peserta tersimpan", !!agendaPeserta);
const pesertaBuat = await prisma.peserta_rapat.findMany({ where: { rapat_id: agendaPeserta?.id ?? "" }, select: { nama_peserta: true, instansi_bidang: true } });
cek("pembuat agenda otomatis tercatat sebagai peserta", pesertaBuat.some((p) => p.nama_peserta === petugas?.name));
cek("pejabat yang dipilih ikut tercatat", pesertaBuat.some((p) => p.nama_peserta === pegawaiUji2.name));
cek("instansi peserta agenda sendiri terisi otomatis", pesertaBuat.every((p) => p.instansi_bidang === "BPKAD - Bidang Aset"));
// Halaman yang dibuka adalah hari agenda peserta itu menurut database, bukan hari yang dihitung dari jam laptop.
if (agendaPeserta) {
  const hariPeserta = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(agendaPeserta.tanggal_mulai);
  await page.goto(`${BASE}/rapat?bulan=${hariPeserta.slice(0, 7)}&tanggal=${hariPeserta}`);
  await page.waitForTimeout(1500);
}

const ujiSekarang = await prisma.jadwal_rapat.findMany({ where: { agenda_rapat: { startsWith: "Uji ubah kalender" } }, select: { agenda_rapat: true, tanggal_mulai: true } });
console.log("DB uji:", ujiSekarang.map((u) => `${u.agenda_rapat} ${u.tanggal_mulai.toISOString()}`).join(" ; "));
let barisPeserta = 0;
const batasPeserta = Date.now() + 20_000;
while (Date.now() < batasPeserta) {
  barisPeserta = await page.getByText(`diikuti ${petugas?.name}, ${pegawaiUji2.name}`).count();
  if (barisPeserta > 0) break;
  await page.waitForTimeout(400);
}
cek(
  "kalender menampilkan peserta agenda baru",
  barisPeserta > 0,
  `count=${barisPeserta} url=${page.url()} diikuti=${await page.getByText("diikuti").count()} isi=${(await page.locator('[aria-labelledby="judul-hari"]').innerText()).slice(0, 260).replace(/\n/g, " | ")}`,
);

// HP: baris tetap muat, tombol ubah jadi ikon dengan target sentuh >= 44px.
const ctxHp = await browser.newContext({ viewport: { width: 375, height: 800 } });
const pageHp = await ctxHp.newPage();
pageHp.setDefaultTimeout(60_000);
await pageHp.goto(`${BASE}/login`);
await pageHp.waitForTimeout(2000);
await pageHp.fill("#email", EMAIL);
await pageHp.fill("#password", PASSWORD);
await selesaikanTurnstile(pageHp);
await pageHp.getByRole("button", { name: "Masuk" }).click();
await pageHp.waitForURL(`${BASE}/dashboard`, { timeout: 30_000 });
await pageHp.goto(`${BASE}/rapat?bulan=${bulanIni}&tanggal=${hariIni}`);
await pageHp.waitForTimeout(2500);
const tombolHp = pageHp.getByRole("button", { name: `Ubah agenda Uji ubah kalender diperbarui`, exact: true });
cek("HP: tombol ubah hanya ikon dengan target sentuh penuh", await tombolHp.count() === 1 && (await tombolHp.innerText()).trim() === "", (await tombolHp.innerText()).trim());
const ukuranHp = await tombolHp.evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { w: r.width, h: r.height };
});
cek("HP: target sentuh tombol ubah >= 44px", ukuranHp.w >= 44 && ukuranHp.h >= 44, `${ukuranHp.w}x${ukuranHp.h}`);
// Setelah simpan status dihapus, pilihan status itu sendiri yang jadi kontrol di HP — tingginya
// harus 44px supaya masih bisa disentuh.
const ukuranStatus = await pageHp.locator('[data-slot="select-trigger"][data-aksi="status"]').first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { w: r.width, h: r.height };
});
cek("HP: target sentuh pilihan status >= 44px", ukuranStatus.w >= 44 && ukuranStatus.h >= 44, `${ukuranStatus.w}x${ukuranStatus.h}`);
const gulirHp = await pageHp.evaluate(() => ({
  dokumen: document.documentElement.scrollWidth,
  jendela: window.innerWidth,
}));
cek("HP: kalender tidak gulir mendatar", gulirHp.dokumen <= gulirHp.jendela + 1, `${gulirHp.dokumen} vs ${gulirHp.jendela}`);

cek("tidak ada galat console", galatConsole.length === 0, galatConsole.slice(0, 3).join(" | "));

await prisma.jadwal_rapat.deleteMany({ where: { agenda_rapat: { startsWith: "Uji ubah kalender" } } });
await prisma.master_pegawai.deleteMany({ where: { nama: { startsWith: "Uji peserta agenda" } } });
await prisma.users.deleteMany({ where: { email: { startsWith: "uji.peserta.agenda" } } });
await browser.close();

const gagal = hasil.filter((h) => h.startsWith("FAIL")).length;
console.log(`\n${hasil.length} pemeriksaan, ${gagal} gagal`);
process.exit(gagal > 0 ? 1 : 0);
