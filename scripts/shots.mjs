import { chromium } from "playwright";
import { createHmac } from "node:crypto";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const OUT = ".shots";
fs.mkdirSync(OUT, { recursive: true });

const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();

// --- seed data review (marker "REVIEW", dibersihkan di akhir) ---
const tag = "REVIEW-UI";
const petugas = await p.users.findFirst({
  where: { email: "petugas.aset@magelang.go.id" },
  include: { roles: { select: { name: true } } },
});
if (!petugas) throw new Error("tidak ada user petugas");

const jenis = await p.jenis_surat.findMany({ where: { aktif: true }, select: { nama: true, id: true } });
const tahun = 2026;
const bulanSeed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const dibuat = [];
for (let i = 0; i < bulanSeed.length; i++) {
  const bulan = bulanSeed[i];
  const j = jenis[i % jenis.length];
  const surat = await p.surat_masuk.create({
    data: {
      nomor_agenda: `${tag}-${i}/${tahun}`,
      tanggal_terima: new Date(`${tahun}-${String(bulan).padStart(2, "0")}-14T00:00:00Z`),
      pengirim: "Badan Pengelolaan Keuangan dan Aset Daerah",
      nomor_surat: `${400 + i}/ASET/${tahun}`,
      tanggal_surat: new Date(`${tahun}-${String(bulan).padStart(2, "0")}-10T00:00:00Z`),
      perihal: `Review UI ${j.nama} bulan ke-${bulan}`,
      isi_ringkas: "Contoh data untuk meninjau tampilan. Bukan surat sebenarnya.",
      jenis_surat_id: j.id,
      status_undangan_rapat: i % 3 === 0 ? "ya" : "tidak",
      status_surat: i % 4 === 3 ? "belum_disposisi" : "selesai",
      created_by: petugas.id,
    },
  });
  dibuat.push(surat.id);
  if (i % 4 !== 3) {
    await p.disposisi.create({
      data: {
        surat_id: surat.id,
        tanggal_disposisi: new Date(`${tahun}-${String(bulan).padStart(2, "0")}-16T00:00:00Z`),
        pemberi_disposisi: "Kepala Bidang Aset",
        penerima_disposisi: "Petugas barang milik daerah",
        isi_disposisi: "Telah ditindaklanjuti pada berkas review.",
        status_tindak_lanjut: i % 2 === 0 ? "selesai" : "proses",
        created_by: petugas.id,
      },
    });
  }
}

// surat detail dengan rapat + peserta + riwayat jadwal: pakai surat beragenda rapat yang ada,
// peserta & riwayat ditambahkan lalu dihapus terpisah supaya surat asli tidak berubah.
const rapat = await p.jadwal_rapat.findFirst({ where: { status_rapat: { not: "dibatalkan" } } });
const suratReal = rapat ? await p.surat_masuk.findUnique({ where: { id: rapat.surat_id } }) : await p.surat_masuk.findFirst();
const pesertaDibuat = [];
let riwayatDibuat = null;
if (rapat) {
  for (const [nama, instansi, ket] of [
    ["Budi Wijaya", "Bagian Administrasi Pembangunan", "mewakili kepala perangkat daerah"],
    ["Sri Handayani", "Bidang Aset", null],
    ["Romas Donianto", "Sekretariat Daerah", "mewakili asisten ekonomi dan pembangunan"],
  ]) {
    pesertaDibuat.push(await p.peserta_rapat.create({ data: { rapat_id: rapat.id, nama_peserta: nama, instansi_bidang: instansi, keterangan: ket } }));
  }
  riwayatDibuat = await p.riwayat_jadwal_rapat.create({
    data: {
      rapat_id: rapat.id,
      tanggal_mulai_lama: new Date(Date.now() - 3 * 86400000),
      tanggal_mulai_baru: new Date(Date.now() + 2 * 86400000),
      alasan_perubahan: "Pemda mengubah jadwal rapat",
      changed_by: petugas.id,
    },
  });
}

// rapat kedua: dibatalkan, supaya status berbeda terlihat di halaman rapat & rekap
const suratRapat2 = dibuat[3];
const rapat2 = await p.jadwal_rapat.create({
  data: {
    surat_id: suratRapat2,
    agenda_rapat: "Review UI — rapat koordinasi pembatalan",
    penyelenggara: "Bidang Aset",
    tanggal_mulai: new Date(Date.now() + 5 * 86400000),
    tanggal_selesai: new Date(Date.now() + 5 * 86400000 + 5400000),
    tempat: "Ruang rapat BPKAD lantai 2",
    status_rapat: "dibatalkan",
    created_by: petugas.id,
  },
});
const pesertaRapat2 = await p.peserta_rapat.create({
  data: { rapat_id: rapat2.id, nama_peserta: "Ani Prasetyo", instansi_bidang: "Bagian Hukum" },
});

// --- sesi login manual ---
const secret = fs.readFileSync(".env", "utf8").match(/SESSION_SECRET=(.+)/)[1].trim().replace(/^"|"$/g, "");
const token = `${Buffer.from(JSON.stringify({ uid: petugas.id, role: petugas.roles.name, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.${createHmac("sha256", secret).update(Buffer.from(JSON.stringify({ uid: petugas.id, role: petugas.roles.name, exp: Math.floor(Date.now() / 1000) + 3640 })).toString("base64url")).digest().toString("base64url")}`;
const bodyB64 = Buffer.from(JSON.stringify({ uid: petugas.id, role: petugas.roles.name, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
const cookie = `${bodyB64}.${createHmac("sha256", secret).update(bodyB64).digest().toString("base64url")}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies([{ name: "aset_session", value: cookie, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
page.setDefaultTimeout(60000);

const rute = [
  ["dashboard", "/dashboard"],
  ["surat", "/surat"],
  ["surat-detail", `/surat/${suratReal?.id ?? "tanpa-id"}`],
  ["disposisi", "/disposisi"],
  ["rapat", "/rapat"],
  ["rekap", `/rekap?tahun=${tahun}`],
  ["pengaturan", "/pengaturan"],
];

async function shot(name, path, w, h, print = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}-${w}.png`, fullPage: true });
  if (print) {
    await page.emulateMedia({ media: "print" });
    await page.screenshot({ path: `${OUT}/${name}-print.png`, fullPage: true });
    await page.emulateMedia({ media: null });
  }
  console.log(`shot ${name} @${w}`);
}

for (const [name, path] of rute) await shot(name, path, 1280, 900);
await shot("rekap", `/rekap?tahun=${tahun}`, 1280, 900, true);
for (const [name, path] of rute) await shot(name, path, 390, 844);

// Halaman login harus dirender tanpa sesi, kalau ada sesi ia di-redirect ke dashboard.
const ctxTanpaSesi = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pageLogin = await ctxTanpaSesi.newPage();
await pageLogin.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await pageLogin.screenshot({ path: `${OUT}/login-1280.png`, fullPage: true });
await pageLogin.setViewportSize({ width: 390, height: 844 });
await pageLogin.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await pageLogin.screenshot({ path: `${OUT}/login-390.png`, fullPage: true });
console.log("shot login @1280, @390 (tanpa sesi)");

await browser.close();

// --- cleanup data review ---
await p.peserta_rapat.deleteMany({ where: { id: { in: pesertaDibuat.map((x) => x.id).concat(pesertaRapat2.id) } } });
if (riwayatDibuat) await p.riwayat_jadwal_rapat.deleteMany({ where: { id: riwayatDibuat.id } });
await p.jadwal_rapat.deleteMany({ where: { id: rapat2.id } });
await p.disposisi.deleteMany({ where: { surat_id: { in: dibuat } } });
await p.surat_masuk.deleteMany({ where: { id: { in: dibuat } } });
await p.$disconnect();
console.log("cleanup selesai");
