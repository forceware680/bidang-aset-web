/**
 * Pemeriksa layout responsif: tidak ada overflow horizontal, tidak ada elemen form
 * yang tumpang tindih, dan target sentuh minimal 44px.
 * Jalankan: node scripts/layout-check.mjs (butuh server dev di http://localhost:3000)
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
// Monitor diukur sampai lebar TV 1920 — layar ini memang untuk TV di depan ruangan, bukan untuk HP.
const lebar = [375, 640, 768, 1024, 1280, 1440, 1920];
// detail satu tanggal pada kalender rapat ikut diperiksa karena bentuknya berbeda dari daftar bulan
const kunciHari = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const prisma = new PrismaClient();
// Kunci monitor dibaca dari database (kunci aktif); .env hanya cadangan kalau tabel masih kosong.
const kunciMonitor = (await prisma.monitor_token.findFirst({ where: { aktif: true }, select: { token: true } }))?.token ?? process.env.MONITOR_TOKEN ?? "";
const rute = ["/login", "/surat", "/disposisi", "/rapat", "/rekap", "/surat/baru", "/keluar", "/keluar/baru", "/pengaturan", "/pengaturan/pengguna", "/pengaturan/jenis/masuk", "/pengaturan/jenis/keluar", "/pengaturan/nama/pengirim", "/pengaturan/nama/terusan", "/pengaturan/nama/pegawai", "/pengaturan/nama/penerima", "/pengaturan/jejak", "/pengaturan/jejak?halaman=2", "/pengaturan/monitor", "/surat?halaman=2", "/akun", `/rapat?bulan=${kunciHari.slice(0, 7)}&tanggal=${kunciHari}`, kunciMonitor ? `/monitor?t=${kunciMonitor}` : "/monitor"];

// Data uji dibersihkan dulu: nomor surat "UJ/Layout-1" harus bisa dibuat lagi, kalau tidak
// insert ditolak unik dan script berhenti di tengah. Pengosongan ini menyapu tabel surat masuk
// dan disposisi — hanya untuk database uji (UJI_DB=1).
const { jagaDatabaseNyata } = await import("./pagar-uji.mjs");
await jagaDatabaseNyata(prisma, "pemeriksa tata letak (scripts/layout-check.mjs)");
await prisma.riwayat_jadwal_rapat.deleteMany({});
await prisma.peserta_rapat.deleteMany({});
await prisma.jadwal_rapat.deleteMany({});
await prisma.disposisi.deleteMany({});
await prisma.lampiran_surat.deleteMany({});
await prisma.lampiran_keluar.deleteMany({});
await prisma.surat_keluar.deleteMany({});
await prisma.keluar_counter.deleteMany({});
await prisma.audit_logs.deleteMany({});
await prisma.surat_masuk.deleteMany({});
await prisma.agenda_counter.deleteMany({});
await prisma.$disconnect();

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
// penyegar SSE membuat layout berubah di tengah pengukuran; layout butuh DOM yang tenang
await page.route("**/api/pembaruan", (r) => r.fulfill({ status: 200, contentType: "text/event-stream", body: "" }));
// server dev bisa lambat compile saat halaman pertama dibuka, jadi timeout diperlebar
page.setDefaultTimeout(60000);

// masuk sebagai petugas agar halaman dalam bisa dibuka
await page.goto(`${BASE}/login`);
// Form memakai useActionState: tanpa hidrasi, submit jadi GET biasa dan tidak ada POST.
await page.waitForLoadState("load");
  await page.waitForTimeout(200);
await page.fill("#email", "petugas.aset@magelang.go.id");
await page.fill("#password", "BCed08Gkc34dF1RM");
await page.getByRole("button", { name: "Masuk" }).click();
await page.waitForURL(`${BASE}/dashboard`);

// satu surat + disposisi + jadwal rapat dibuat lewat UI supaya select di dalam tabel ikut diperiksa
await page.goto(`${BASE}/surat/baru`);
await page.waitForLoadState("load");
  await page.waitForTimeout(200);
await page.fill("#tanggal_terima", "2026-10-30");
await page.selectOption("#pengirim", "Sekretariat Daerah");
await page.fill("#nomor_surat", "UJ/Layout-1");
await page.fill("#perihal", "Undangan koordinasi barang milik daerah");
await page.fill("#isi_ringkas", "Koordinasi inventarisasi.");
await page.locator('input[name="undangan"][value="ya"]').check();
await page.fill("#rapat_agenda", "Koordinasi inventarisasi barang milik daerah");
await page.fill("#rapat_mulai", "2026-11-14T10:00");
await page.fill("#rapat_selesai", "2026-11-14T12:00");
await page.fill("#rapat_tempat", "Ruang Rapat A");
await page.mouse.move(700, 420);
await page.getByRole("button", { name: "Simpan surat" }).click();
// server action bisa butuh lebih dari satu tick sebelum redirect, jadi diberi waktu dulu
await page.waitForTimeout(1200);
await page.waitForURL(/\/surat\/[0-9a-f-]{36}/);
if (!/\/surat\/[0-9a-f-]{36}/.test(page.url())) {
  console.log(`GAGAL: surat tidak tersimpan. url=${page.url()} alert=${await page.locator("[data-slot='alert']").allTextContents()}`);
}
const urlSurat = page.url().includes("?") ? `${page.url()}&semua=1` : `${page.url()}?semua=1`;
await page.waitForLoadState("load");
  await page.waitForTimeout(200);

// satu surat tanpa agenda yang ditandai sebagai undangan rapat: bagian Rapat menampilkan formulir agendanya,
// jadi formulir itu ikut diukur di tiap viewport.
const prismaUndangan = new PrismaClient();
const petugasUndangan = await prismaUndangan.users.findFirst({ where: { email: "petugas.aset@magelang.go.id" } });
const suratUndangan = await prismaUndangan.surat_masuk.create({
  data: {
    nomor_agenda: "UJ/Layout-undangan",
    tanggal_terima: new Date("2026-10-30T00:00:00Z"),
    pengirim: "Sekretariat Daerah",
    perihal: "Uji surat undangan tanpa agenda",
    status_undangan_rapat: "ya",
    created_by: petugasUndangan?.id ?? null,
  },
  select: { id: true },
});
await prismaUndangan.$disconnect();
const urlUndangan = `${BASE}/surat/${suratUndangan.id}?semua=1`;

await page.goto(urlSurat);
await page.waitForLoadState("load");
  await page.waitForTimeout(200);
if (await page.locator("#tanggal_disposisi").count() === 0) {
  console.log(`DIAG sebelum isian disposisi: url=${page.url()} judul=${(await page.locator("[data-slot=card-title]").allTextContents()).join(" | ")} alert=${(await page.locator("[data-slot=alert]").allTextContents()).join(" | ")}`);
}
await page.fill("#tanggal_disposisi", "2026-10-30");
await page.selectOption("#pemberi_disposisi", "Kabid Aset");
await page.selectOption("#penerima_disposisi", "Subid Penatausahaan Aset");
await page.fill("#isi_disposisi", "Laksanakan koordinasi.");
await page.getByRole("button", { name: "Simpan disposisi" }).click();
await page.waitForSelector("[data-slot='card-title']");
// redirect hasil simpan membawa halaman kembali ke langkah pertama, jadi buka lagi semua bagian
await page.goto(urlSurat);
await page.waitForLoadState("load");
  await page.waitForTimeout(200);

// kalau surat belum punya jadwal rapat (misal karena validasi), jadwalkan lewat formulir rapat
if ((await page.getByRole("button", { name: "Jadwalkan rapat" }).count()) > 0) {
  await page.fill("#tanggal_rapat", "2026-11-14");
  await page.fill("#waktu_rapat", "10:00");
  await page.fill("#lokasi_rapat", "Ruang rapat");
  await page.fill("#baru_agenda", "Koordinasi inventarisasi");
  await page.fill("#jumlah_peserta", "6");
  await page.getByRole("button", { name: "Jadwalkan rapat" }).click();
  await page.waitForSelector("[data-slot='card-title']");
}

// satu surat keluar dibuat lewat UI supaya daftar, form baru, detail, dan panel koreksinya ikut diperiksa
await page.goto(`${BASE}/keluar/baru`);
await page.waitForSelector("#tanggal_surat");
await page.fill("#tanggal_surat", "2026-10-30");
await page.selectOption("#tujuan", "Sekretariat Daerah");
await page.fill("#nomor_surat", "UJ/Keluar-1");
await page.fill("#perihal", "Balasan undangan koordinasi barang milik daerah");
await page.fill("#isi_ringkas", "Jawaban atas koordinasi inventaris.");
await page.getByRole("button", { name: "Simpan surat keluar" }).click();
await page.waitForTimeout(1200);
if (!/\/keluar\/[0-9a-f-]{36}/.test(page.url())) {
  console.log(`GAGAL: surat keluar tidak tersimpan. url=${page.url()} alert=${await page.locator("[data-slot='alert']").allTextContents()}`);
}
const urlKeluar = page.url();
await page.waitForLoadState("load");
  await page.waitForTimeout(200);

let gagal = 0;
const laporan = [];

async function ukurLayout(scope) {
  return page.evaluate((scope) => {
      const sc = scope === "dialog" ? '[data-slot="dialog-content"]' : scope === "combobox" ? '[data-slot="combobox-content"]' : "main";
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height, nama: el.id || el.textContent?.slice(0, 22) || el.tagName };
      };
      const elemen = [...document.querySelectorAll(
        `${sc} [data-slot='card'], ${sc} [data-slot='input'], ${sc} [data-slot='input-group'], ${sc} [data-slot='combobox-chips'], ${sc} [data-slot='native-select'], ${sc} [data-slot='textarea'], ${sc} [data-slot='button'], ${sc} [data-slot='field-label']`,
      )].filter((el) => el.getBoundingClientRect().width > 0);
      const pasangan = [];
      const rects = elemen.map(box);
      let tumpang = 0;
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];
          if (elemen[i].closest("[data-slot='form-actions']") || elemen[j].closest("[data-slot='form-actions']")) continue;
          // navigasi bagian surat memang sticky dan melayang di atas konten saat scroll — bukan tumpang tindih
          if (elemen[i].closest("nav[aria-label='Bagian surat ini']") || elemen[j].closest("nav[aria-label='Bagian surat ini']")) continue;
          // elemen yang bersarang di dalam elemen lain (panel berisi field) bukan tumpang tindih
          if (elemen[i].contains(elemen[j]) || elemen[j].contains(elemen[i])) continue;
          // tombol melayang (FAB tambah surat) memang berada di atas konten — bukan tumpang tindih
          if (getComputedStyle(elemen[i]).position === "fixed" || getComputedStyle(elemen[j]).position === "fixed") continue;
          const irisanX = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
          const irisanY = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
          if (irisanX > 2 && irisanY > 2) {
            tumpang++;
            pasangan.push(`${a.nama} <> ${b.nama}`);
          }
        }
      }
      // target sentuh: minimal 44px di layar <=768px; di desktop kontrol padat shadcn boleh 28px, navigasi padat 24px (WCAG AA minimum non-teks 24px)
      const sentuh = window.innerWidth <= 768;
      const padat = `${sc} [data-slot='nav-tab'], ${sc} [data-slot='pagination-link'], ${sc} [aria-label^='Halaman daftar'] button, [data-slot='sidebar-menu-button'], [data-slot='sidebar-trigger'], ${sc} [data-slot='combobox-item'], ${sc} [data-slot='combobox-chip-remove']`;
      const utama = `${sc} [data-slot='button'], ${sc} [data-slot='input'], ${sc} [data-slot='combobox-chips'], ${sc} [data-slot='native-select'], ${sc} [data-slot='textarea'], ${sc} [data-slot='switch'], ${sc} label:has([data-slot='radio']), [data-slot='sidebar-attach'] a`;
      const kecil = [
        ...[...document.querySelectorAll(padat)].map((el) => ({ el, batas: sentuh ? 44 : 24 })),
        ...[...document.querySelectorAll(utama)].map((el) => ({ el, batas: sentuh ? 44 : 28 })),
      ]
        .filter(({ el }) => el.getBoundingClientRect().width > 0)
        .filter(({ el, batas }) => el.getBoundingClientRect().height < batas)
        .map(({ el }) => `${el.id || el.textContent?.slice(0, 16) || el.getAttribute("data-slot")} (${Math.round(el.getBoundingClientRect().height)}px)`);
      // popup bawaan browser selebar elemen select, jadi opsi terpanjang harus muat di dalamnya.
      // Di layar sentuh select ditahan sampai lebar panelnya (lebarOpsiMin memakai min(ch, 100%)) supaya
      // isian tidak menembus tepi kartu; nama pejabat panjang boleh terpotong di popup HP, desktop tetap diukur.
      const sempit = [];
      if (!sentuh) {
        for (const sel of document.querySelectorAll(`${sc} select`)) {
        const r = sel.getBoundingClientRect();
        // select yang disembunyikan breakpoint (daftar ponsel/table) tidak diukur
        if (r.width === 0 || r.height === 0) continue;
        const penimbang = document.createElement("canvas").getContext("2d");
        penimbang.font = getComputedStyle(sel).font;
        let paling = 0;
        for (const op of sel.options) {
          const w = penimbang.measureText(op.text).width;
          if (w > paling) paling = w;
        }
        if (r.width < paling + 34) sempit.push(`${sel.name || sel.id} butuh ${Math.ceil(paling + 34)}px, hanya ${Math.round(r.width)}px`);
      }
      }
      // tombol hanya-icon di layar sentuh harus 44px lebarnya, bukan tingginya saja
      const sempitIkon = [...document.querySelectorAll(`${sc} [data-ikon-saja]`)]
        .filter((el) => el.getBoundingClientRect().width > 0)
        .filter((el) => el.getBoundingClientRect().width < (sentuh ? 44 : 28))
        .map((el) => `${el.getAttribute("aria-label") || el.textContent?.slice(0, 16)} (${Math.round(el.getBoundingClientRect().width)}px)`);
      // kalender agenda: tautan tanggal harus bisa disentuh selebar minimal batas sentuh, dan pada lebar
      // >=375 kalender tidak boleh digulung horizontal (kalender keluar kartu berarti layout rusak)
      const kal = document.querySelector(`${sc} .kalender`);
      const kalender = [];
      if (kal) {
        const tanggal = [...document.querySelectorAll("[data-slot='calendar'] a[aria-label^='Lihat agenda tanggal']")];
        if (tanggal.length) {
          const paling = Math.min(...tanggal.map((el) => el.getBoundingClientRect().width));
          if (paling < (sentuh ? 44 : 24)) kalender.push(`tautan tanggal hanya ${Math.round(paling)}px lebar`);
        }
        if (window.innerWidth >= 375 && kal.scrollWidth > kal.clientWidth + 1) {
          kalender.push(`kalender digulung ${kal.scrollWidth - kal.clientWidth}px`);
        }
      }
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        lebarDok: document.documentElement.scrollWidth,
        lebarJendela: window.innerWidth,
        tumpang,
        pasangan,
        kecil,
        sempit,
        sempitIkon,
        kalender,
      };
    }, scope);
}

let kombinasi = 0;

async function catat(label, hasil, tanpaKalender = false) {
  kombinasi++;
  const bermasalah = hasil.overflow || hasil.tumpang > 0 || hasil.kecil.length > 0 || hasil.sempit.length > 0 || hasil.sempitIkon.length > 0 || (!tanpaKalender && hasil.kalender.length > 0);
  if (bermasalah) {
    gagal++;
    console.log(`FAIL ${label} overflow=${hasil.overflow} (${hasil.lebarDok}>${hasil.lebarJendela}) tumpang=${hasil.tumpang} kecil=${hasil.kecil.join(", ")} dropdown=${hasil.sempit.join(", ")} ikon=${hasil.sempitIkon.join(", ")} kalender=${hasil.kalender.join(", ")}`);
    if (hasil.pasangan.length) console.log(`   tumpang tindih: ${hasil.pasangan.join(" | ")}`);
  } else {
    console.log(`PASS ${label}`);
  }
}

async function gantiLebar(w) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(150);
}

// satu muat halaman per rute, lalu tiap lebar diukur dengan ganti ukuran jendela saja: CSS menangani
// breakpoint, jadi muat ulang per kombinasi tidak diperlukan dan hemat banyak waktu
for (const ruteNama of [...rute, urlSurat.replace(BASE, ""), `${urlSurat.replace(BASE, "")}&surat=ubah`, urlUndangan.replace(BASE, ""), urlKeluar.replace(BASE, ""), `${urlKeluar.replace(BASE, "")}&keluar=ubah`, "/dashboard"]) {
  await page.goto(`${BASE}${ruteNama}`);
  // halaman bisa masih streaming (fallback loading) saat diukur; tunggu sampai isi masuk
  await page.waitForLoadState("load");
  await page.waitForSelector("main");
  await page.waitForTimeout(300);
  for (const w of lebar) {
    await gantiLebar(w);
    await catat(`${w}px ${ruteNama}`, await ukurLayout("main"));
  }
}

// Modal tambah surat diperiksa di tiap lebar: dialog di-portal ke body (bukan di dalam main),
// jadi isinya diukur dengan scope dialog dan overflow tetap diukur terhadap dokumen.
for (const [halaman, pemicu, nama] of [
  ["/surat", "Tambah Surat", "modal tambah surat masuk"],
  ["/keluar", "Tambah Surat Keluar", "modal tambah surat keluar"],
]) {
  await page.goto(`${BASE}${halaman}`);
  await page.waitForSelector("#q");
  await page.waitForTimeout(300);
  for (const w of lebar) {
    await gantiLebar(w);
    if ((await page.locator('[data-slot="dialog-content"]').count()) === 0) {
      const tautan = page.getByRole("link", { name: pemicu }).first();
      if ((await tautan.count()) > 0 && (await tautan.isVisible())) {
        await tautan.click();
      } else {
        await page.locator("[data-fab]").first().click();
      }
      await page.waitForSelector('[data-slot="dialog-content"]');
    }
    await page.waitForTimeout(200);
    await catat(`${w}px ${nama}`, await ukurLayout("dialog"), true);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

// Daftar pilihan nama peserta rapat diperiksa dalam keadaan terbuka: popup di-portal ke body, jadi
// isinya diukur sendiri; chip nama ikut diukur bersama isian di dalam kartu. Surat yang dipakai adalah
// surat yang sudah punya agenda, karena formulir peserta hanya muncul di bagian Rapat.
const prismaPeserta = new PrismaClient();
const suratBeragenda = await prismaPeserta.surat_masuk.findFirst({
  where: { status_undangan_rapat: "ya", jadwal_rapat: { some: {} } },
  select: { id: true },
});
await prismaPeserta.$disconnect();
if (!suratBeragenda) {
  console.log("SKIP daftar nama peserta terbuka (tidak ada surat dengan agenda)");
} else {
  await page.goto(`${BASE}/surat/${suratBeragenda.id}?semua=1`);
  await page.waitForSelector("#peserta_nama");
  await page.waitForTimeout(300);
  for (const w of lebar) {
    await gantiLebar(w);
    if ((await page.locator('[data-slot="combobox-content"]').count()) === 0) {
      await page.locator("#peserta_nama").first().click();
      await page.locator("#peserta_nama").first().fill("aset");
      await page.waitForSelector('[data-slot="combobox-content"]');
      await page.locator("#peserta_nama").first().press("Tab");
    }
    await page.waitForTimeout(200);
    const isiCombobox = await ukurLayout("combobox");
    const isiKartu = await ukurLayout("main");
    const tepiPopup = await page.evaluate(() => {
      const p = document.querySelector('[data-slot="combobox-content"]');
      if (!p) return null;
      const r = p.getBoundingClientRect();
      return { kanan: Math.round(r.right), jendela: window.innerWidth, kiri: Math.round(r.left) };
    });
    await catat(`${w}px daftar nama peserta terbuka`, { ...isiKartu, kecil: [...isiKartu.kecil, ...isiCombobox.kecil] }, true);
    if (!tepiPopup || tepiPopup.kanan > tepiPopup.jendela + 1 || tepiPopup.kiri < -1) {
      gagal++;
      console.log(`FAIL ${w}px daftar nama peserta terbuka tepi popup=${tepiPopup ? `${tepiPopup.kanan}/${tepiPopup.jendela}` : "tidak ada"}`);
    }
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

await browser.close();
console.log(`\n${kombinasi} kombinasi diperiksa, ${gagal} gagal`);
if (gagal > 0) process.exit(1);
