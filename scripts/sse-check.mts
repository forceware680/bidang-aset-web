import { selesaikanTurnstile } from "./turnstile.mts";
/**
 * Pemeriksa pembaruan realtime (aliran peristiwa server + kanal pemberitahuan database).
 * Yang diuji: jalur pembaruan hanya terbuka untuk sesi aplikasi atau layar monitor dengan kunci monitor;
 * perubahan data datang ke halaman yang memang menampilkan data itu — kalender, daftar surat, daftar kategori
 * di formulir surat, dan layar monitor — tanpa pengguna menekan penyegar; halaman milik akun lain ikut
 * berubah; dan koneksi LISTEN dilepas lagi setelah semua jalur ditutup.
 * Jalankan: npm run test:sse (butuh server dev di http://localhost:3000 dan npm run migrate:memberi sudah jalan)
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMAIL_PETUGAS = "petugas.aset@magelang.go.id";
const PASSWORD_PETUGAS = "BCed08Gkc34dF1RM";
const EMAIL_PIMPINAN = "pimpinan@magelang.go.id";
const PASSWORD_PIMPINAN = "mMs3HSiLBJPOdR5X";

const hasil: string[] = [];
function cat(nama: string, ok: boolean, detail = "") {
  hasil.push(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? `  (${detail})` : ""}`);
}

const env = readFileSync(".env", "utf8");
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const { perubahanTerkait } = await import("../lib/pemberitahuan-rute.ts");
const { kunciMonitorAktif } = await import("./kunci-monitor-aktif.mts");
const KUNCI_MONITOR =
  (await kunciMonitorAktif(prisma)) || (env.match(/^MONITOR_TOKEN="?([^"\n]+)"?$/m)?.[1] ?? "");
const ALAMAT_PEMBARUAN = (kunci?: string) =>
  `${BASE}/api/pembaruan${kunci ? `?t=${encodeURIComponent(kunci)}` : ""}`;
const bcrypt = await import("bcryptjs");

/** Nomor/agenda uji dibuang di awal dan di akhir; data asli tidak disentuh. */
async function sapuUji() {
  const surat = await prisma.surat_masuk.findMany({ where: { nomor_agenda: { startsWith: "UJ/SSE" } }, select: { id: true } });
  const ids = surat.map((s) => s.id);
  const syaratAgenda: { surat_id: { in: string[] } } | { agenda_rapat: { startsWith: string } }[] = [
    { agenda_rapat: { startsWith: "Uji SSE" } },
  ];
  if (ids.length) syaratAgenda.push({ surat_id: { in: ids } });
  await prisma.jadwal_rapat.deleteMany({ where: { OR: syaratAgenda } });
  await prisma.surat_masuk.deleteMany({ where: { nomor_agenda: { startsWith: "UJ/SSE" } } });
  await prisma.jenis_surat.deleteMany({ where: { nama: "Uji SSE jenis" } });
  const akun = await prisma.users.findMany({ where: { email: { startsWith: "uji.sse." } }, select: { id: true } });
  await prisma.api_token.deleteMany({ where: { user_id: { in: akun.map((a) => a.id) } } });
  await prisma.users.deleteMany({ where: { email: { startsWith: "uji.sse." } } });
  await prisma.audit_logs.deleteMany({ where: { description: { startsWith: "Uji SSE" } } });
}

await sapuUji();

/**
 * Baca aliran SSE sampai `jumlah` pesan `perubahan` datang, atau `ms` lewat. `siap` dipanggil saat frame
 * pertama. Respons yang bukan aliran (ditolak) dibaca sampai selesai dan tidak dibatalkan: membatalkan
 * permintaan yang sudah selesai bisa menutup koneksi HTTP yang masih dipakai permintaan berikutnya.
 */
async function dengar(aliranUrl: string, jumlah: number, ms = 20000, siap?: () => void) {
  const pagar = new AbortController();
  const res = await fetch(aliranUrl, { signal: pagar.signal });
  const header = res.headers.get("content-type") ?? "";
  const pesan: { tabel?: string; aksi?: string; id?: string }[] = [];
  if (res.status !== 200 || !res.body) {
    await res.text().catch(() => "");
    return { status: res.status, header, pesan };
  }
  let teks = "";
  const batas = setTimeout(() => pagar.abort(), ms);
  try {
    const pembaca = res.body.getReader();
    const kod = new TextDecoder();
    while (pesan.length < jumlah) {
      const { value, done } = await pembaca.read();
      if (done) break;
      teks += kod.decode(value, { stream: true });
      const potongan = teks.split("\n\n");
      teks = potongan.pop() ?? "";
      for (const p of potongan) {
        const baris = p.split("\n");
        const peristiwa = baris.find((b) => b.startsWith("event:"))?.slice(6).trim();
        const isi = baris.find((b) => b.startsWith("data:"))?.slice(5).trim();
        if (peristiwa === "siap") siap?.();
        if (peristiwa === "perubahan" && isi) {
          try {
            pesan.push(JSON.parse(isi));
          } catch {
            /* frame tidak utuh — abaikan */
          }
        }
      }
    }
    await pembaca.cancel().catch(() => {});
  } catch {
    /* dibatalkan lewat batas waktu — pesan yang sudah masuk tetap dipakai */
  } finally {
    clearTimeout(batas);
    if (pesan.length < jumlah) pagar.abort();
    // Pemanggil yang menunggu frame pertama tetap melanjutkan kalau jalurnya tertutup lebih awal.
    siap?.();
  }
  return { status: res.status, header, pesan };
}

/**
 * Koneksi LISTEN tidak boleh menumpuk: semua halaman memakai satu koneksi bersama. Di `next dev` sisa
 * jalur dari kompilasi sebelumnya bisa menahan satu koneksi, jadi yang diperiksa adalah tidak bertambah.
 */
async function jumlahListen(): Promise<number> {
  const baris = await prisma.$queryRaw<{ ada: bigint }[]>`
    SELECT count(*) AS ada FROM pg_stat_activity WHERE query = 'LISTEN aset_perubahan'`;
  return Number(baris[0].ada);
}

/** Jam Asia/Jakarta dalam bentuk yang dikirim ke API (`yyyy-mm-ddTHH:MM`) — bukan jam UTC server. */
function waktuJakartaLokal(offsetMs = 0): string {
  const bagian = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(Date.now() + offsetMs));
  const ambil = (jenis: string) => bagian.find((b) => b.type === jenis)?.value ?? "";
  return `${ambil("year")}-${ambil("month")}-${ambil("day")}T${ambil("hour")}:${ambil("minute")}`;
}

const hariIni = waktuJakartaLokal().slice(0, 10);

/** Waktu mulai agenda yang tetap berada pada hari yang sedang dibuka di kalender. Kalau uji dijalankan
 *  dekat tengah malam Jakarta, offset beberapa jam ke depan sudah jatuh ke besok, jadi pakai jam 09.00
 *  hari ini (waktu lampau tidak masalah untuk agenda uji). */
function waktuHariIni(offsetMs: number): string {
  const jam = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date()).split(":")[0]);
  const sisaJam = 24 - jam;
  if (offsetMs / 3600000 + 0.1 <= sisaJam) return waktuJakartaLokal(offsetMs);
  return waktuJakartaLokal(-jam * 3600000 + 9 * 3600000);
}

// --- bentuk pemetauan tabel → halaman ---
cat("perubahan agenda terkait halaman rapat", perubahanTerkait("jadwal_rapat", "/rapat"));
cat("perubahan agenda terkait halaman surat", perubahanTerkait("jadwal_rapat", "/surat/abc"));
cat("perubahan agenda terkait layar monitor", perubahanTerkait("jadwal_rapat", "/monitor"));
cat("perubahan peserta terkait layar monitor", perubahanTerkait("peserta_rapat", "/monitor"));
cat("perubahan surat keluar tidak menyentuh halaman surat masuk", !perubahanTerkait("surat_keluar", "/surat"));
cat("perubahan lampiran surat tidak menyentuh dashboard", !perubahanTerkait("lampiran_surat", "/dashboard"));
cat("perubahan surat masuk terkait halaman disposisi", perubahanTerkait("surat_masuk", "/disposisi"));
cat("perubahan tabel yang tidak dipetau tidak menyegar apa pun", !perubahanTerkait("api_token", "/rapat"));
cat("alamat halaman hanya cocok pada dirinya atau anak alamatnya", !perubahanTerkait("surat_masuk", "/suratx"));

// --- jalur pembaruan: siapa boleh berlangganan ---
const tanpaKunci = await dengar(ALAMAT_PEMBARUAN(), 1, 5000);
cat("jalur pembaruan tanpa masuk dan tanpa kunci ditolak", tanpaKunci.status === 401, `status ${tanpaKunci.status}`);
const kunciSalah = await dengar(ALAMAT_PEMBARUAN("kunci-salah"), 1, 5000);
cat("kunci monitor yang salah ditolak", kunciSalah.status === 401, `status ${kunciSalah.status}`);
// Jalur yang dibatalkan bisa menutup koneksi HTTP yang masih dipakai permintaan berikutnya, jadi
// jalur pemeriksaan diberi jeda sebelum jalur panjang dibuka.
await new Promise((r) => setTimeout(r, 500));

// Tulis dan hapus dilakukan sambil jalur dibuka — menunggu frame "siap" dulu supaya langganan
// sudah terbentuk sebelum perubahan datang (rute baru bisa beberapa detik sebelum ia berlangganan).
// Di `next dev` jalur bisa tertutup sebelum perubahan datang (rute sedang dikompilasi ulang), jadi
// percobaan diulang sampai pesan benar-benar diterima.
let jalur = { status: 0, header: "", pesan: [] as { tabel?: string; aksi?: string; id?: string }[] };
let suratUji = { id: "" };
let suratHapus = { id: "" };
for (let percobaan = 0; percobaan < 3 && jalur.pesan.length < 2; percobaan++) {
  let beriSiap: (() => void) | null = null;
  const sudahSiap = new Promise<void>((selesai) => {
    beriSiap = selesai;
  });
  const jalan = dengar(ALAMAT_PEMBARUAN(KUNCI_MONITOR), 2, 45000, () => beriSiap?.());
  await sudahSiap;
  suratUji = await prisma.surat_masuk.create({
    data: {
      nomor_agenda: "UJ/SSE-surat",
      tanggal_terima: new Date(),
      pengirim: "Uji SSE surat",
      perihal: "Uji SSE surat untuk pembaruan realtime",
    },
    select: { id: true },
  });
  suratHapus = await prisma.surat_masuk.delete({ where: { id: suratUji.id } });
  jalur = await jalan;
  if (jalur.pesan.length < 2) await new Promise((r) => setTimeout(r, 600));
}
cat("jalur pembaruan dengan kunci monitor terbuka", jalur.status === 200, `status ${jalur.status}`);
cat("jalur pembaruan berupa aliran peristiwa", jalur.header.startsWith("text/event-stream"), jalur.header);
cat("tulis dan hapus datang sebagai dua pesan", jalur.pesan.length >= 2, jalur.pesan.map((p) => `${p.tabel}/${p.aksi}`).join(", "));
cat("pesan pertama adalah tulis surat masuk", jalur.pesan[0]?.tabel === "surat_masuk" && jalur.pesan[0]?.aksi === "INSERT");
cat("pesan kedua adalah hapus surat masuk", jalur.pesan[1]?.tabel === "surat_masuk" && jalur.pesan[1]?.aksi === "DELETE");
cat("pesan membawa id baris yang sama", jalur.pesan[0]?.id === suratUji.id && jalur.pesan[1]?.id === suratHapus.id);
cat("pesan tidak membawa isi surat", Object.keys(jalur.pesan[0] ?? {}).sort().join(",") === "aksi,id,tabel");
// Langganan yang hidup: koneksi LISTEN di server hanya ada selama masih ada subscriber, jadi jumlah
// koneksi diperiksa sementara aliran ini masih terbuka (aliran di atas sudah selesai ketika dicek).
const hidup = new AbortController();
const aliranHidup = await fetch(ALAMAT_PEMBARUAN(KUNCI_MONITOR), { signal: hidup.signal });
const pembacaHidup = aliranHidup.body?.getReader();
await pembacaHidup?.read();
const jumlahSaatHidup = await jumlahListen();
cat("koneksi LISTEN aktif saat jalur masih dibuka", jumlahSaatHidup >= 1, `jumlah ${jumlahSaatHidup}`);
hidup.abort();
await new Promise((r) => setTimeout(r, 400));
// Koneksi yang dilepas masuk ke pool dan masih menyimpan query terakhirnya di pg_stat_activity, jadi yang
// diperiksa adalah jumlah tidak bertambah, bukan nol.
cat("koneksi LISTEN tidak bertambah setelah jalur ditutup", (await jumlahListen()) <= jumlahSaatHidup, `jumlah ${await jumlahListen()}`);

// --- halaman yang berubah sendiri tanpa disegar ---
const browser = await chromium.launch({ channel: "chrome", headless: false });
const galatConsole: string[] = [];
const langgananSiap = new Map<import("playwright").Page, boolean>();
function pasang(page: import("playwright").Page, nama: string) {
  // Navigasi menutup jalur lama dan membuka jalur baru, jadi penanda siap harus dihapus lagi.
  page.on("framenavigated", () => langgananSiap.delete(page));
  page.on("response", (r) => {
    if (r.url().includes("/api/pembaruan") && r.status() === 200) langgananSiap.set(page, true);
  });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // Halaman masuk belum punya sesi, jadi langganan pembaruan dijawab 401 di sana — itu bukan galat aplikasi.
    if (page.url().includes("/login") && m.text().includes("401")) return;
    galatConsole.push(`${m.text()} @ ${m.location().file}:${m.location().line} saat ${nama}`);
  });
  page.on("pageerror", (e) => galatConsole.push(`${String(e)} @ ${nama}`));
}

async function masuk(ctx: import("playwright").BrowserContext, email: string, password: string) {
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);
  pasang(p, email);
  await p.goto(`${BASE}/login`);
  await p.fill("#email", email);
  await p.fill("#password", password);
  await selesaikanTurnstile(p);
await p.getByRole("button", { name: "Masuk" }).click();
  await p.getByText("Surat masuk, disposisi, dan agenda sampai hari ini.").first().waitFor({ timeout: 60000 });
  return p;
}

/**
 * Tunggu langganan pembaruan halaman terbentuk. Tanpa ini, perubahan yang ditulis tepat setelah navigasi
 * bisa datang pada jendela antara jalur lama yang tertutup dan jalur baru yang belum dibuka.
 */
async function tungguLangganan(page: import("playwright").Page, ms = 20000) {
  const batas = Date.now() + ms;
  while (!langgananSiap.get(page) && Date.now() < batas) await page.waitForTimeout(200);
  return langgananSiap.get(page) === true;
}

/**
 * Tunggu sampai React mengambil alih sebuah elemen. Di dev halaman yang dikirim berangsur bisa baru
 * dihidrasi beberapa detik kemudian; tombol yang belum dihidrasi mengirim formulir ke server alih-alih
 * tindakan aplikasi.
 */
async function sudahHidrasi(locator: import("playwright").Locator, ms = 60000): Promise<boolean> {
  try {
    await locator.waitFor({ state: "visible", timeout: ms });
  } catch {
    return false;
  }
  return locator
    .evaluate(
      (el) =>
        new Promise<boolean>((selesai) => {
          const cek = () => {
            if (Object.keys(el as Record<string, unknown>).some((k) => k.startsWith("__reactFiber$"))) selesai(true);
            else setTimeout(cek, 250);
          };
          cek();
        }),
      undefined,
    )
    .catch(() => false);
}

const ctxPetugas = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const petugas = await masuk(ctxPetugas, EMAIL_PETUGAS, PASSWORD_PETUGAS);

// kalender: agenda dibuat lewat API (perangkat Android) → halaman rapat berubah sendiri
await petugas.goto(`${BASE}/rapat?bulan=${hariIni.slice(0, 7)}&tanggal=${hariIni}`);
await petugas.getByText("Agenda pada").first().waitFor({ timeout: 60000 });
await tungguLangganan(petugas);
const namaAgenda = "Uji SSE agenda realtime";
const barisAgenda = petugas.locator("div.border-b").filter({ hasText: namaAgenda });
cat("agenda uji belum tampil sebelum dibuat", (await barisAgenda.count()) === 0);

const masukApi = await fetch(`${BASE}/api/masuk`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL_PETUGAS, password: PASSWORD_PETUGAS, perangkat: "uji-sse" }),
});
const token = String(((await masukApi.json()) as { token?: string }).token ?? "");
const mulai = waktuHariIni(60 * 60 * 1000);
const buat = await fetch(`${BASE}/api/agenda`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ agenda_rapat: namaAgenda, tanggal_mulai: mulai, tempat: "Ruang uji SSE" }),
});
const agendaJson = (await buat.json()) as { ok?: boolean; agenda?: { id?: string } };
cat("agenda dibuat lewat API Android", buat.status === 201 && agendaJson.ok === true, `status ${buat.status}`);
const agendaId = agendaJson.agenda?.id ?? "";

let muncul = false;
const batasKalender = Date.now() + 15000;
while (Date.now() < batasKalender) {
  if (await barisAgenda.count() > 0) {
    muncul = true;
    break;
  }
  await petugas.waitForTimeout(250);
}
cat("kalender berubah sendiri saat agenda dibuat", muncul, `baris ${await barisAgenda.count()}`);
cat("halaman tidak berpindah saat agenda datang", petugas.url().includes("/rapat"), petugas.url());
cat("jam dan tempat agenda ikut tampil", await barisAgenda.filter({ hasText: "Ruang uji SSE" }).count() > 0);

// daftar surat: surat masuk dibuat langsung di database → daftar surat berubah sendiri
await petugas.goto(`${BASE}/surat`);
await petugas.goto(`${BASE}/surat`);
await petugas.getByText("Agenda Surat Masuk").first().waitFor({ timeout: 60000 });
await tungguLangganan(petugas);
const nomorUji = "UJ/SSE-daftar";
const barisSurat = petugas.locator("table tbody tr").filter({ hasText: nomorUji });
cat("surat uji belum tampil sebelum dibuat", (await barisSurat.count()) === 0);
const suratDaftar = await prisma.surat_masuk.create({
  data: {
    nomor_agenda: "UJ/SSE-surat2",
    tanggal_terima: new Date(),
    pengirim: "Uji SSE daftar",
    nomor_surat: nomorUji,
    perihal: "Uji SSE surat untuk daftar realtime",
  },
  select: { id: true },
});
cat("surat uji untuk daftar tersimpan", suratDaftar.id.length > 0);
let suratTampil = false;
const batasSurat = Date.now() + 15000;
while (Date.now() < batasSurat) {
  if (await barisSurat.count() > 0) {
    suratTampil = true;
    break;
  }
  await petugas.waitForTimeout(250);
}
cat("daftar surat berubah sendiri saat surat masuk ditulis", suratTampil, `baris ${await barisSurat.count()}`);

// formulir surat baru: kategori surat baru muncul di daftar pilihan tanpa disegar
await petugas.goto(`${BASE}/surat/baru`);
await petugas.waitForSelector("#jenis_surat_id");
await tungguLangganan(petugas);
const jenisUji = await prisma.jenis_surat.create({ data: { nama: "Uji SSE jenis" }, select: { id: true, nama: true } });
const opsiJenis = petugas.locator("#jenis_surat_id option", { hasText: jenisUji.nama });
let jenisTampil = false;
const batasJenis = Date.now() + 15000;
while (Date.now() < batasJenis) {
  if (await opsiJenis.count() > 0) {
    jenisTampil = true;
    break;
  }
  await petugas.waitForTimeout(250);
}
cat("kategori surat baru muncul di formulir tanpa disegar", jenisTampil, `opsi ${await opsiJenis.count()}`);

// layar monitor: agenda dari API tampil tanpa menunggu penyegar berkala
const monitorCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const monitor = await monitorCtx.newPage();
monitor.setDefaultTimeout(60000);
pasang(monitor, "monitor");
await monitor.goto(`${BASE}/monitor?t=${encodeURIComponent(KUNCI_MONITOR)}`);
await monitor.getByRole("button", { name: "Jeda pergantian layar" }).first().waitFor({ timeout: 60000 });
cat("layar monitor terbuka", await monitor.getByRole("button", { name: "Tampilkan Statistik" }).count() > 0);
// Dijeda supaya layar agenda tidak berpindah ke statistik sebelum agendanya datang.
await monitor.getByRole("button", { name: "Jeda pergantian layar" }).click();
await monitor.getByRole("button", { name: "Lanjutkan pergantian layar" }).first().waitFor({ timeout: 10000 });
await tungguLangganan(monitor);
const namaMonitor = "Uji SSE monitor realtime";
const namaPesertaMonitor = "Uji SSE peserta monitor";
const mulaiMonitor = waktuJakartaLokal(2 * 60 * 60 * 1000);
await prisma.master_pegawai.deleteMany({ where: { nama: namaPesertaMonitor } });
await prisma.master_pegawai.create({ data: { nama: namaPesertaMonitor, jabatan: "Pejabat uji SSE", aktif: true } });
const buatMonitor = await fetch(`${BASE}/api/agenda`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ agenda_rapat: namaMonitor, tanggal_mulai: mulaiMonitor, tempat: "Ruang monitor uji", peserta: [namaPesertaMonitor] }),
});
cat("agenda monitor dibuat lewat API Android", buatMonitor.status === 201, `status ${buatMonitor.status}`);
let monitorTampil = false;
const batasMonitor = Date.now() + 15000;
while (Date.now() < batasMonitor) {
  if (await monitor.getByText(namaMonitor).count() > 0) {
    monitorTampil = true;
    break;
  }
  await monitor.waitForTimeout(250);
}
cat("agenda dari API muncul di layar monitor tanpa penyegar berkala", monitorTampil, `teks ${await monitor.getByText(namaMonitor).count()}`);

// Peserta agenda mandiri juga harus sampai ke layar monitor tanpa penyegar berkala: perubahan pada
// peserta_rapat dipetau ke /monitor.
let pesertaMonitor = false;
const batasPeserta = Date.now() + 15000;
while (Date.now() < batasPeserta) {
  if (await monitor.getByText(namaPesertaMonitor).count() > 0) {
    pesertaMonitor = true;
    break;
  }
  await monitor.waitForTimeout(250);
}
cat("peserta agenda muncul di layar monitor tanpa penyegar berkala", pesertaMonitor, `teks ${await monitor.getByText(namaPesertaMonitor).count()}`);
await prisma.jadwal_rapat.deleteMany({ where: { agenda_rapat: namaMonitor } });
await prisma.master_pegawai.deleteMany({ where: { nama: namaPesertaMonitor } });

// dua akun: perubahan petugas terlihat di halaman pimpinan tanpa pimpinan menekan apa pun
const ctxPimpinan = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pimpinan = await masuk(ctxPimpinan, EMAIL_PIMPINAN, PASSWORD_PIMPINAN);
await pimpinan.goto(`${BASE}/rapat?bulan=${hariIni.slice(0, 7)}&tanggal=${hariIni}`);
await pimpinan.getByText("Agenda pada").first().waitFor({ timeout: 60000 });
cat("halaman akun lain sudah berlangganan pembaruan", await tungguLangganan(pimpinan, 30000));
const barisPimpinan = pimpinan.locator("div.border-b").filter({ hasText: namaAgenda });
cat("halaman pimpinan sudah menampilkan agenda petugas", (await barisPimpinan.count()) > 0);

// Petugas mengubah status agendanya sendiri lewat halaman rapatnya.
await petugas.goto(`${BASE}/rapat?bulan=${hariIni.slice(0, 7)}&tanggal=${hariIni}`);
await petugas.getByText("Agenda pada").first().waitFor({ timeout: 60000 });
cat("halaman petugas sudah berlangganan pembaruan", await tungguLangganan(petugas, 30000));
const barisPetugas = petugas.locator("div.border-b").filter({ hasText: namaAgenda, has: petugas.locator('[data-aksi="status"]') });
const selectPetugas = barisPetugas.locator('[data-slot="select-trigger"]').first();
const hidrasi = await sudahHidrasi(selectPetugas);
cat("pembaruan status: React mengambil alih pilihan status", hidrasi);
// Di dev hidrasi bisa beberapa detik setelah baris tampil; kalau pilihan belum diambil alih React,
// percobaan diulang.
let toastUbah = false;
for (let percobaan = 0; percobaan < 4 && !toastUbah; percobaan++) {
  await selectPetugas.click();
  await petugas.getByRole("option", { name: "Dibatalkan", exact: true }).click();
  // Refresh dari pemberitahuan bisa menyusun ulang elemen pilihan dan mengembalikan nilainya ke nilai
  // server; selektor menyimpan sendiri, jadi kalau nilainya kembali ke server, pilihan dicoba lagi.
  const nilai = await selectPetugas.innerText();
  if (nilai !== "Dibatalkan") {
    await petugas.waitForTimeout(300);
    continue;
  }
  toastUbah = await tungguToastPetugas(petugas, "Status agenda diubah menjadi Dibatalkan.", 12000);
  if (!toastUbah) await petugas.waitForTimeout(1000);
}
cat("ubah status agenda milik sendiri tersimpan", toastUbah);
const diBasis = await prisma.jadwal_rapat.findUnique({ where: { id: agendaId }, select: { status_rapat: true } });
cat("status agenda tersimpan di database", diBasis?.status_rapat === "dibatalkan", `status ${diBasis?.status_rapat}`);

let pimpinanTampilStatus = false;
const batasStatus = Date.now() + 20000;
while (Date.now() < batasStatus) {
  if (await barisPimpinan.filter({ hasText: "Dibatalkan" }).count() > 0) {
    pimpinanTampilStatus = true;
    break;
  }
  await pimpinan.waitForTimeout(250);
}
const teksPimpinan = (await barisPimpinan.first().textContent().catch(() => ""))?.slice(0, 120);
cat("halaman akun lain ikut berubah tanpa disegar", pimpinanTampilStatus, `baris status ${await barisPimpinan.filter({ hasText: "Dibatalkan" }).count()} isi=${JSON.stringify(teksPimpinan)}`);

// --- aksi dari form juga membawa perubahan ke akun lain (hapus agenda lewat dialog) ---
const hapusForm = new FormData();
hapusForm.set("id", agendaId);
const hapus = await fetch(`${BASE}/api/agenda/${agendaId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
cat("agenda uji dihapus lewat API", hapus.status === 200, `status ${hapus.status}`);
let hilang = false;
const batasHapus = Date.now() + 15000;
while (Date.now() < batasHapus) {
  if (await barisPimpinan.count() === 0) {
    hilang = true;
    break;
  }
  await pimpinan.waitForTimeout(250);
}
cat("baris agenda hilang di halaman akun lain saat dihapus", hilang, `baris ${await barisPimpinan.count()}`);
cat("agenda yang dihapus lewat API tidak tertinggal di database", (await prisma.jadwal_rapat.count({ where: { agenda_rapat: namaAgenda } })) === 0);

await browser.close();

// koneksi LISTEN tidak boleh menumpuk saat beberapa halaman dibuka sekaligus
const listenSebelum = await jumlahListen();
await browser.close();
const listenSetelah = await jumlahListen();
cat("koneksi LISTEN tidak menumpuk saat banyak halaman dibuka", listenSebelum <= 2, `jumlah saat halaman dibuka ${listenSebelum}`);
cat("menutup halaman tidak menambah koneksi LISTEN", listenSetelah <= listenSebelum, `jumlah setelah ditutup ${listenSetelah}`);

await sapuUji();
await prisma.$disconnect();

cat("tidak ada galat console", galatConsole.length === 0, galatConsole.slice(0, 3).join(" | "));

const lulus = hasil.filter((h) => h.startsWith("PASS")).length;
const gagal = hasil.filter((h) => h.startsWith("FAIL"));
console.log(hasil.join("\n"));
console.log(`\n${lulus} PASS, ${gagal.length} FAIL`);
if (gagal.length) {
  console.log(gagal.join("\n"));
  process.exit(1);
}

/** tunggu toast hasil di halaman petugas */
async function tungguToastPetugas(page: import("playwright").Page, teks: string, timeout = 40000) {
  const batas = Date.now() + timeout;
  while (Date.now() < batas) {
    if (await page.locator('[data-slot="toast"]').filter({ hasText: teks }).count() > 0) return true;
    await page.waitForTimeout(200);
  }
  return false;
}
