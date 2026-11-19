import { selesaikanTurnstile } from "./turnstile.mts";
/** Cek dashboard: angka kartu ikut filter periode (hari/bulan/tahun/semua), dibanding dengan query database yang memakai batas sama. Jalankan: node --env-file=.env --experimental-strip-types tmp/dash-periode.mts */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = "petugas.aset@magelang.go.id";
const PASSWORD = "BCed08Gkc34dF1RM";

const prisma = new PrismaClient();
const now = new Date();
const hariMulai = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const hariAkhir = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
const bulanMulai = new Date(now.getFullYear(), now.getMonth(), 1);
const tahunMulai = new Date(now.getFullYear(), 0, 1);

async function harapan(mulai: Date | null, akhir: Date | null) {
  const rows = await prisma.$queryRaw<{ masuk: bigint; belum_disposisi: bigint; belum_selesai: bigint; keluar: bigint; draf: bigint }[]>`
    SELECT
      count(*) AS masuk,
      count(*) FILTER (WHERE jumlah_disposisi = 0) AS belum_disposisi,
      (SELECT count(*) FROM v_disposisi_aktif WHERE status_tindak_lanjut IN ('belum','proses') AND (${mulai ?? null}::date IS NULL OR tanggal_disposisi >= ${mulai ?? null}::date) AND (${akhir ?? null}::date IS NULL OR tanggal_disposisi <= ${akhir ?? null}::date)) AS belum_selesai,
      (SELECT count(*) FROM v_surat_keluar_aktif WHERE (${mulai ?? null}::date IS NULL OR tanggal_surat >= ${mulai ?? null}::date) AND (${akhir ?? null}::date IS NULL OR tanggal_surat <= ${akhir ?? null}::date)) AS keluar,
      (SELECT count(*) FROM v_surat_keluar_aktif WHERE status_surat = 'draf' AND (${mulai ?? null}::date IS NULL OR tanggal_surat >= ${mulai ?? null}::date) AND (${akhir ?? null}::date IS NULL OR tanggal_surat <= ${akhir ?? null}::date)) AS draf
    FROM v_surat_aktif
    WHERE (${mulai ?? null}::date IS NULL OR tanggal_terima >= ${mulai ?? null}::date) AND (${akhir ?? null}::date IS NULL OR tanggal_terima <= ${akhir ?? null}::date)
  `;
  const r = rows[0];
  return {
    "Surat masuk": Number(r.masuk),
    "Surat keluar": Number(r.keluar),
    "Surat keluar belum dikirim": Number(r.draf),
    "Belum didisposisikan": Number(r.belum_disposisi),
    "Disposisi belum selesai": Number(r.belum_selesai),
  };
}

const browser = await chromium.launch({ channel: "chrome", headless: false });
const page = await browser.newContext().then((c) => c.newPage());
page.setDefaultTimeout(60_000);
await page.goto(`${BASE}/login`);
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await selesaikanTurnstile(page);
await page.click("button[type=submit]");
await page.waitForURL("**/dashboard", { timeout: 30_000 });

let gagal = 0;
for (const key of ["hari", "bulan", "tahun", "semua"]) {
  await page.goto(`${BASE}/dashboard?periode=${key}`, { waitUntil: "networkidle" });
  const kartu = await page.$$eval("div.grid.gap-4 > div", (els) =>
    els.map((e) => {
      const t = (e.textContent ?? "").trim();
      const m = t.match(/^(Surat keluar belum dikirim|Belum didisposisikan|Disposisi belum selesai|Agenda mendatang|Surat masuk|Surat keluar)\D*?(\d+)/);
      return m ? { label: m[1], nilai: Number(m[2]) } : null;
    }).filter(Boolean) as { label: string; nilai: number }[],
  );
  const batas = key === "hari" ? [hariMulai, hariAkhir] : key === "bulan" ? [bulanMulai, null] : key === "tahun" ? [tahunMulai, null] : [null, null];
  const exp = await harapan(batas[0], batas[1]);
  for (const k of kartu) {
    const ok = exp[k.label] === k.nilai;
    if (!ok) gagal++;
    console.log(`${ok ? "PASS" : "FAIL"} ${key}: ${k.label} layar=${k.nilai} db=${exp[k.label]}`);
  }
  if (kartu.length !== 6) console.log(`FAIL ${key}: kartu ditemukan ${kartu.length}, seharusnya 6`);
}
await browser.close();
await prisma.$disconnect();
console.log(gagal === 0 ? "SEMUA COCOK" : `${gagal} TIDAK COCOK`);
process.exit(gagal === 0 ? 0 : 1);
