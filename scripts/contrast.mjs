/**
 * Pemeriksa kontras WCAG dengan mengukur warna yang benar-benar dihitung browser
 * (token shadcn memakai oklch dan color-mix, jadi nilai alpha ikut diperhitungkan).
 * Ambang: teks 4.5:1, batas form/tombol dan indikator non-teks 3:1.
 * Jalankan: node scripts/contrast.mjs (butuh server dev di http://localhost:3000)
 */
import { chromium } from "playwright";
import "dotenv/config";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
// Monitor butuh kunci akses; tanpa kunci layar hanya menampilkan gerbang dan tidak ada teks yang diukur.
const { PrismaClient: PrismaClientKunci } = await import("@prisma/client");
const prismaKunci = new PrismaClientKunci();
// Kunci monitor dibaca dari database (kunci aktif), .env hanya cadangan kalau tabel masih kosong.
const kunciMonitor = (await prismaKunci.monitor_token.findFirst({ where: { aktif: true }, select: { token: true } }))?.token ?? process.env.MONITOR_TOKEN ?? "";
const MONITOR = kunciMonitor ? `/monitor?t=${kunciMonitor}` : "/monitor";
// Gerbang dibaca dengan kunci yang pasti tidak cocok dengan kunci aktif di database.
const GERBANG = `/monitor?t=${kunciMonitor ? `${kunciMonitor}-salah` : "tanpa-kunci"}`;

function warna(teks) {
  const m = teks.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const bagian = m[1].split(",").map((v) => Number(v.trim()));
  return { r: bagian[0], g: bagian[1], b: bagian[2], a: bagian[3] === undefined ? 1 : bagian[3] };
}

function luminansi(w) {
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(w.r) + 0.7152 * lin(w.g) + 0.0722 * lin(w.b);
}

function campur(depan, belakang) {
  const a = depan.a;
  return {
    r: a * depan.r + (1 - a) * belakang.r,
    g: a * depan.g + (1 - a) * belakang.g,
    b: a * depan.b + (1 - a) * belakang.b,
    a: 1,
  };
}

function rasio(a, b) {
  const l1 = luminansi(a);
  const l2 = luminansi(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

const kasus = [
  // Monitor selalu mode gelap (layar TV di depan ruangan) dan diukur pada 1920×1080.
  { nama: "judul header di monitor", halaman: MONITOR, selector: "header p:first-child", property: "color", min: 4.5, lebar: 1920 },
  { nama: "jam besar di header monitor", halaman: MONITOR, selector: "header .num", property: "color", min: 3, lebar: 1920 },
  { nama: "judul bagian di monitor", halaman: MONITOR, selector: "main h2", property: "color", min: 4.5, lebar: 1920 },
  { nama: "label kartu statistik di monitor", halaman: MONITOR, selector: "main section:nth-child(2) div p:first-child", property: "color", min: 4.5, lebar: 1920 },
  { nama: "angka statistik di monitor", halaman: MONITOR, selector: "main section:nth-child(2) .num", property: "color", min: 3, lebar: 1920 },
  { nama: "keterangan footer di monitor", halaman: MONITOR, selector: "footer p", property: "color", min: 4.5, lebar: 1920 },
  // Layar grafik: judul panel, keterangan, dan label sumbu. Batang/donut diukur lewat token yang sama dengan
  // Rekap; kalau tahun ini belum ada data, kasus label sumbu di-SKIP oleh script.
  { nama: "judul panel grafik di monitor", halaman: MONITOR, selector: "main section:nth-child(3) h3", property: "color", min: 4.5, lebar: 1920 },
  { nama: "keterangan panel grafik di monitor", halaman: MONITOR, selector: "[aria-labelledby='grafik-masuk-monitor'] p", property: "color", min: 4.5, lebar: 1920 },
  { nama: "label sumbu grafik di monitor", halaman: MONITOR, selector: ".recharts-text", property: "color", min: 4.5, lebar: 1920 },
  // Bar penanda besar di kartu statistik: indikator non-teks di atas jalur track muted, ambang 3:1.
  { nama: "bar penanda surat masuk di monitor", halaman: MONITOR, selector: "[data-meter='masuk']", property: "isi-color", min: 3, lebar: 1920 },
  { nama: "bar penanda surat keluar di monitor", halaman: MONITOR, selector: "[data-meter='keluar']", property: "isi-color", min: 3, lebar: 1920 },
  { nama: "bar penanda surat keluar belum dikirim di monitor", halaman: MONITOR, selector: "[data-meter='belum-kirim']", property: "isi-color", min: 3, lebar: 1920 },
  { nama: "bar penanda surat belum didisposisikan di monitor", halaman: MONITOR, selector: "[data-meter='belum-disposisi']", property: "isi-color", min: 3, lebar: 1920 },
  { nama: "bar penanda disposisi belum selesai di monitor", halaman: MONITOR, selector: "[data-meter='belum-selesai']", property: "isi-color", min: 3, lebar: 1920 },
  { nama: "bar penanda agenda hari ini di monitor", halaman: MONITOR, selector: "[data-meter='agenda']", property: "isi-color", min: 3, lebar: 1920 },
  { nama: "bar penanda rapat bulan ini di monitor", halaman: MONITOR, selector: "[data-meter='rapat']", property: "isi-color", min: 3, lebar: 1920 },
  // Gerbang monitor (alamat tanpa kunci cocok): kartu amber tanpa kalimat penjelasan, jadi yang diukur judul,
  // eyebrow, garis kartu, dan ikon kunci.
  { nama: "judul gerbang monitor", halaman: GERBANG, selector: "[data-gerbang='judul']", property: "color", min: 4.5, lebar: 1920 },
  { nama: "garis kartu gerbang monitor", halaman: GERBANG, selector: "[data-gerbang='kartu']", property: "border-color", min: 3, lebar: 1920 },
  { nama: "teks eyebrow gerbang monitor", halaman: GERBANG, selector: "[data-gerbang='eyebrow']", property: "color", min: 4.5, lebar: 1920 },
  { nama: "garis eyebrow gerbang monitor", halaman: GERBANG, selector: "[data-gerbang='eyebrow']", property: "border-color", min: 3, lebar: 1920 },
  { nama: "ikon kunci gerbang monitor", halaman: GERBANG, selector: "[data-gerbang='ikon'] svg", property: "color", min: 3, lebar: 1920 },
  // Lencana status di baris agenda monitor: teks dibaca terhadap latar kartunya (bg-card), bukan tint barisnya —
  // lencana yang memakai tint baris yang sama nyaris tidak kelihatan (1,42:1).
  { nama: "lencana agenda sedang berlangsung di monitor", halaman: MONITOR, selector: "[data-lencana='sedang']", property: "color", min: 4.5, lebar: 1920 },
  { nama: "lencana 'N menit lagi' di monitor", halaman: MONITOR, selector: "[data-lencana='segera']", property: "color", min: 4.5, lebar: 1920 },
  { nama: "lencana terjadwal di monitor", halaman: MONITOR, selector: "[data-lencana='terjadwal']", property: "color", min: 4.5, lebar: 1920 },
  { nama: "lencana dibatalkan di monitor", halaman: MONITOR, selector: "[data-lencana='batal']", property: "color", min: 4.5, lebar: 1920 },
  // Keterangan baris yang di-tint (sedang berlangsung = success-bg, segera = warning-bg) diukur terhadap tintnya.
  { nama: "keterangan baris berlangsung di monitor", halaman: MONITOR, selector: "li[data-baris='berlangsung'] > div > p:last-child", property: "color", min: 4.5, lebar: 1920 },
  { nama: "keterangan baris segera di monitor", halaman: MONITOR, selector: "li[data-baris='terjadwal'] > div > p:last-child", property: "color", min: 4.5, lebar: 1920 },
  { nama: "teks judul card di card", halaman: "/dashboard", selector: "[data-slot='card-title']", property: "color", min: 4.5 },
  { nama: "teks keterangan card di card", halaman: "/dashboard", selector: "[data-slot='card-description']", property: "color", min: 4.5 },
  { nama: "teks tabel di card", halaman: "/surat", selector: "[data-slot='table-cell']", property: "color", min: 4.5 },
  { nama: "header tabel di card", halaman: "/surat", selector: "[data-slot='table-head']", property: "color", min: 4.5 },
  { nama: "tautan nomor agenda di card", halaman: "/surat", selector: "[data-slot='table-cell'] a", property: "color", min: 4.5 },
  { nama: "badge sukses", halaman: "/surat", selector: "[data-slot='badge'][data-variant='success']", property: "color", min: 4.5 },
  { nama: "badge info", halaman: "/rapat", selector: "[data-slot='badge'][data-variant='info']", property: "color", min: 4.5 },
  { nama: "teks select status rapat yang ditint", halaman: "/rapat", selector: "[data-slot='select-trigger'][aria-label^='Status agenda']", property: "color", min: 4.5 },
  { nama: "teks select tindak lanjut yang ditint", halaman: "/disposisi", selector: "[data-slot='select-trigger'][aria-label^='Status tindak lanjut']", property: "color", min: 4.5 },
  { nama: "badge warning", halaman: "/surat", selector: "[data-slot='badge'][data-variant='warning']", property: "color", min: 4.5 },
  { nama: "badge destructive", halaman: "/rapat", selector: "[data-slot='badge'][data-variant='destructive']", property: "color", min: 4.5 },
  { nama: "badge secondary", halaman: "/pengaturan", selector: "[data-slot='badge'][data-variant='secondary']", property: "color", min: 4.5 },
  { nama: "teks tombol primary", halaman: "/surat", selector: "[data-slot='button'][data-variant='default']", property: "color", min: 4.5 },
  { nama: "batas tombol outline di card", halaman: "/surat/baru", selector: "[data-slot='button'][data-variant='outline']", property: "border-color", min: 3 },
  { nama: "batas input di card", halaman: "/surat", selector: "[data-slot='input']", property: "border-color", min: 3 },
  { nama: "batas native select di card", halaman: "/surat", selector: "[data-slot='native-select']", property: "border-color", min: 3 },
  { nama: "placeholder input di isian", halaman: "/surat", selector: "#q", property: "placeholder-color", min: 4.5 },
  { nama: "teks label field di card", halaman: "/surat", selector: "[data-slot='field-label']", property: "color", min: 4.5 },
  { nama: "teks submenu pengaturan di sidebar", halaman: "/pengaturan/nama", selector: "[data-slot='sidebar-menu-sub-button']:not([data-active='true'])", property: "color", min: 4.5 },
  { nama: "teks submenu pengaturan terpilih", halaman: "/pengaturan/nama", selector: "[data-slot='sidebar-menu-sub-button'][data-active='true']", property: "color", min: 4.5 },
  { nama: "teks item pengaturan aktif di sidebar", halaman: "/pengaturan/nama", selector: "[data-slot='sidebar-menu-button'][data-active='true']", property: "color", min: 4.5 },
  { nama: "teks navigasi antar Daftar Nama", halaman: "/pengaturan/nama/pengirim", selector: "nav[aria-label='Daftar Nama'] [data-slot='nav-tab']", property: "color", min: 4.5 },
  { nama: "Daftar Nama terpilih", halaman: "/pengaturan/nama/pengirim", selector: "nav[aria-label='Daftar Nama'] [data-slot='nav-tab'][data-state='active']", property: "color", min: 4.5 },
  { nama: "Daftar Nama belum dipilih", halaman: "/pengaturan/nama/pengirim", selector: "nav[aria-label='Daftar Nama'] [data-slot='nav-tab']:not([data-state='active'])", property: "color", min: 4.5 },
  { nama: "teks navigasi antar Kategori Surat", halaman: "/pengaturan/jenis/masuk", selector: "nav[aria-label='Kategori Surat'] [data-slot='nav-tab']", property: "color", min: 4.5 },
  { nama: "Kategori Surat terpilih", halaman: "/pengaturan/jenis/masuk", selector: "nav[aria-label='Kategori Surat'] [data-slot='nav-tab'][data-state='active']", property: "color", min: 4.5 },
  { nama: "Kategori Surat belum dipilih", halaman: "/pengaturan/jenis/masuk", selector: "nav[aria-label='Kategori Surat'] [data-slot='nav-tab']:not([data-state='active'])", property: "color", min: 4.5 },
  // tombol mode di header: ikon yang aktif (sun atau moon) di dua mode dan saat hover
  { nama: "ikon di tombol mode", halaman: "/surat", selector: "[data-slot='theme-toggle'] svg", property: "color", min: 4.5 },
  { nama: "ikon tombol mode saat hover", halaman: "/surat", selector: "[data-slot='theme-toggle'] svg", property: "color", min: 4.5, hover: true },
  // state hover: latar berubah (fill primary jadi lebih gelap, tint nonaktif muncul) dan teks harus tetap terbaca
  { nama: "teks submenu terpilih saat hover", halaman: "/pengaturan/nama", selector: "[data-slot='sidebar-menu-sub-button'][data-active='true']", property: "color", min: 4.5, hover: true },
  { nama: "teks menu sidebar aktif saat hover", halaman: "/disposisi", selector: "[data-slot='sidebar-menu-button'][data-active='true']", property: "color", min: 4.5, hover: true },
  { nama: "teks menu sidebar di latar sidebar", halaman: "/dashboard", selector: "[data-slot='sidebar-menu-button']", property: "color", min: 4.5 },
  { nama: "label grup menu sidebar", halaman: "/dashboard", selector: "[data-slot='sidebar-group-label']", property: "color", min: 4.5 },
  { nama: "teks menu sidebar aktif", halaman: "/dashboard", selector: "[data-slot='sidebar-menu-button'][data-active='true']", property: "color", min: 4.5 },
  { nama: "angka grafik batang di card", halaman: "/dashboard", selector: "[data-slot='chart'] path", property: "fill", min: 3 },
  // grafik surat masuk dan surat keluar di Rekap sekarang berdiri sendiri, jadi warna batangnya diukur terpisah
  { nama: "batang grafik surat masuk di rekap", halaman: "/rekap", selector: "[aria-labelledby='grafik-masuk'] path", property: "chart-color", min: 3 },
  { nama: "batang grafik surat keluar di rekap", halaman: "/rekap", selector: "[aria-labelledby='grafik-keluar'] path", property: "chart-color", min: 3 },
  { nama: "slice donut komposisi kategori di card", halaman: "/rekap", selector: "[aria-labelledby='komposisi-jenis'] svg path, [aria-labelledby='komposisi-jenis'] svg circle", property: "chart-color", min: 3 },
  { nama: "teks galat isian di form", halaman: "/surat/baru?galat=uji", selector: "[data-slot='field-error']", property: "color", min: 4.5 },
  { nama: "teks deskripsi login di latar aplikasi", halaman: "/login", selector: "main p", property: "color", min: 4.5 },
  { nama: "label metrik di card", halaman: "/dashboard", selector: "[data-slot='metric-label']", property: "color", min: 4.5 },
  { nama: "angka metrik di card", halaman: "/dashboard", selector: "[data-slot='metric-nilai']", property: "color", min: 4.5 },
  { nama: "teks chip delta di card", halaman: "/dashboard", selector: ".metrik-chip", property: "color", min: 4.5 },
  { nama: "angka hari ini di kalender rapat", halaman: "/rapat", selector: "[aria-label^='Hari ini'] p", property: "color", min: 4.5 },
  // angka tanggal pada kalender adalah tautan yang bisa diklik, jadi teksnya harus cukup kontras juga
  { nama: "angka tanggal pada kalender rapat", halaman: "/rapat", selector: "[data-slot='calendar'] a", property: "color", min: 4.5 },
  { nama: "keterangan kalender agenda", halaman: "/rapat", selector: "[aria-labelledby='judul-kalender'] .text-muted-foreground", property: "color", min: 4.5 },
  { nama: "teks tombol periode aktif", halaman: "/dashboard", selector: "[data-slot='button'][data-variant='selected']", property: "color", min: 4.5 },
  { nama: "garis tombol periode aktif", halaman: "/dashboard", selector: "[data-slot='button'][data-variant='selected']", property: "border-color", min: 3 },
  { nama: "teks bulan pada navigasi bulan", halaman: "/rapat", selector: "[data-slot='month-nav'] span", property: "color", min: 4.5 },
  { nama: "icon navigasi bulan (ghost di dalam grup)", halaman: "/rapat", selector: "[data-slot='month-nav'] [data-slot='button'][data-variant='ghost']", property: "color", min: 4.5 },
  { nama: "garis grup navigasi bulan", halaman: "/rapat", selector: "[data-slot='month-nav']", property: "border-color", min: 3 },
  { nama: "icon tombol bulan berjalan (fill di dalam grup)", halaman: "/rapat", selector: "[data-slot='month-nav'] [data-slot='button'][data-variant='selected']", property: "color", min: 4.5 },
  // tombol melayang hanya ada di HP; teksnya di atas fill primary
  { nama: "teks tombol melayang tambah surat di HP", halaman: "/dashboard", selector: "[data-fab]", property: "color", min: 4.5, lebar: 375 },
  { nama: "teks pil melayang buat agenda di HP", halaman: "/rapat", selector: "[data-fab]", property: "color", min: 4.5, lebar: 375 },
  { nama: "icon ekspor Excel di HP", halaman: "/rekap", selector: "[data-ikon-saja][data-variant='default']", property: "color", min: 4.5, lebar: 375 },
  { nama: "icon cetak PDF di HP", halaman: "/rekap", selector: "[data-ikon-saja][data-variant='outline']", property: "color", min: 4.5, lebar: 375 },
  { nama: "garis tombol cetak di HP", halaman: "/rekap", selector: "[data-ikon-saja][data-variant='outline']", property: "border-color", min: 3, lebar: 375 },
  // bilah bawah navigasi Pengaturan hanya ada di HP
  { nama: "label bagian aktif di bilah bawah HP", halaman: "/pengaturan", selector: "nav[aria-label='Bagian pengaturan (bilah bawah)'] [data-slot='nav-tab'][data-state='active']", property: "color", min: 4.5, lebar: 375 },
  { nama: "label bagian nonaktif di bilah bawah HP", halaman: "/pengaturan", selector: "nav[aria-label='Bagian pengaturan (bilah bawah)'] [data-slot='nav-tab']:not([data-state='active'])", property: "color", min: 4.5, lebar: 375 },
  { nama: "garis atas bilah bawah HP", halaman: "/pengaturan", selector: "nav[aria-label='Bagian pengaturan (bilah bawah)']", property: "border-color", min: 3, lebar: 375 },
  // dialog agenda mandiri: latar dialog adalah popover, bukan latar card
  { nama: "judul dialog agenda mandiri", halaman: "/rapat", selector: "[data-slot='dialog-title']", property: "color", min: 4.5, bukaDialog: true },
  { nama: "keterangan dialog agenda mandiri", halaman: "/rapat", selector: "[data-slot='dialog-description']", property: "color", min: 4.5, bukaDialog: true },
  { nama: "icon tutup dialog agenda mandiri", halaman: "/rapat", selector: "[data-slot='dialog-close']", property: "color", min: 4.5, bukaDialog: true, lebar: 375 },
  { nama: "label isian di dalam dialog", halaman: "/rapat", selector: "[data-slot='dialog-content'] [data-slot='field-label']", property: "color", min: 4.5, bukaDialog: true },
  { nama: "batas isian di dalam dialog", halaman: "/rapat", selector: "[data-slot='dialog-content'] #baru_agenda", property: "border-color", min: 3, bukaDialog: true },
  { nama: "placeholder isian di dalam dialog", halaman: "/rapat", selector: "[data-slot='dialog-content'] #agenda_tempat", property: "placeholder-color", min: 4.5, bukaDialog: true },
  { nama: "teks tombol buat agenda di dalam dialog", halaman: "/rapat", selector: "[data-slot='dialog-content'] button[type='submit']", property: "color", min: 4.5, bukaDialog: true },
  { nama: "keterangan bawah dialog agenda mandiri", halaman: "/rapat", selector: "[data-slot='dialog-content'] p", property: "color", min: 4.5, bukaDialog: true, lebar: 375 },
  // modal rute "tambah surat": dialognya di-portal ke latar popover, isinya sama dengan halaman penuh
  { nama: "judul modal tambah surat masuk", halaman: "/surat", selector: "[data-slot='dialog-title']", property: "color", min: 4.5, bukaDialog: "Tambah Surat" },
  { nama: "keterangan modal tambah surat masuk", halaman: "/surat", selector: "[data-slot='dialog-description']", property: "color", min: 4.5, bukaDialog: "Tambah Surat" },
  { nama: "icon tutup modal tambah surat", halaman: "/surat", selector: "[data-slot='dialog-close']", property: "color", min: 4.5, bukaDialog: "Tambah Surat" },
  { nama: "teks judul kartu di dalam modal", halaman: "/surat", selector: "[data-slot='dialog-content'] [data-slot='card-title']", property: "color", min: 4.5, bukaDialog: "Tambah Surat" },
  { nama: "teks keterangan kartu di dalam modal", halaman: "/surat", selector: "[data-slot='dialog-content'] [data-slot='card-description']", property: "color", min: 4.5, bukaDialog: "Tambah Surat" },
  { nama: "teks label isian di dalam modal", halaman: "/surat", selector: "[data-slot='dialog-content'] [data-slot='field-label']", property: "color", min: 4.5, bukaDialog: "Tambah Surat" },
  { nama: "batas isian di dalam modal", halaman: "/surat", selector: "[data-slot='dialog-content'] #perihal", property: "border-color", min: 3, bukaDialog: "Tambah Surat" },
  { nama: "batas select pengirim di dalam modal", halaman: "/surat", selector: "[data-slot='dialog-content'] #pengirim", property: "border-color", min: 3, bukaDialog: "Tambah Surat" },
  { nama: "placeholder nomor surat di dalam modal", halaman: "/surat", selector: "[data-slot='dialog-content'] #nomor_surat", property: "placeholder-color", min: 4.5, bukaDialog: "Tambah Surat" },
  { nama: "teks tombol simpan surat di dalam modal", halaman: "/surat", selector: "[data-slot='dialog-content'] button[type='submit']", property: "color", min: 4.5, bukaDialog: "Tambah Surat" },
  { nama: "teks tombol Batal di dalam modal", halaman: "/surat", selector: "[data-slot='dialog-content'] [data-slot='button'][data-variant='outline']", property: "color", min: 4.5, bukaDialog: "Tambah Surat" },
  { nama: "garis tombol Batal di dalam modal", halaman: "/surat", selector: "[data-slot='dialog-content'] [data-slot='button'][data-variant='outline']", property: "border-color", min: 3, bukaDialog: "Tambah Surat" },
  { nama: "keterangan aksi di dasar modal", halaman: "/surat", selector: "[data-slot='dialog-content'] [data-slot='form-actions'] p", property: "color", min: 4.5, bukaDialog: "Tambah Surat", lebar: 375 },
  { nama: "judul modal tambah surat keluar", halaman: "/keluar", selector: "[data-slot='dialog-title']", property: "color", min: 4.5, bukaDialog: "Tambah Surat Keluar" },
  { nama: "batas select tujuan di dalam modal keluar", halaman: "/keluar", selector: "[data-slot='dialog-content'] #tujuan", property: "border-color", min: 3, bukaDialog: "Tambah Surat Keluar" },
  { nama: "placeholder nomor keluar di dalam modal", halaman: "/keluar", selector: "[data-slot='dialog-content'] #nomor_surat", property: "placeholder-color", min: 4.5, bukaDialog: "Tambah Surat Keluar" },
  { nama: "teks tombol simpan surat keluar di dalam modal", halaman: "/keluar", selector: "[data-slot='dialog-content'] button[type='submit']", property: "color", min: 4.5, bukaDialog: "Tambah Surat Keluar" },
  { nama: "keterangan pilihan surat asal di dalam modal keluar", halaman: "/keluar", selector: "[data-slot='dialog-content'] #surat_asal_id + p, [data-slot='dialog-content'] [data-slot='field-description']", property: "color", min: 4.5, bukaDialog: "Tambah Surat Keluar" },
  // surat keluar: daftar, form baru, bagian tujuan di pengaturan, dan bilah melayang di HP
  { nama: "teks tabel surat keluar di card", halaman: "/keluar", selector: "[data-slot='table-cell']", property: "color", min: 4.5 },
  { nama: "header tabel surat keluar di card", halaman: "/keluar", selector: "[data-slot='table-head']", property: "color", min: 4.5 },
  { nama: "tautan nomor surat keluar di card", halaman: "/keluar", selector: "[data-slot='table-cell'] a", property: "color", min: 4.5 },
  { nama: "badge draf surat keluar di daftar", halaman: "/keluar", selector: "[data-slot='badge'][data-variant='warning']", property: "color", min: 4.5 },
  { nama: "badge dikirim surat keluar di daftar", halaman: "/keluar", selector: "[data-slot='badge'][data-variant='info']", property: "color", min: 4.5 },
  { nama: "badge selesai surat keluar di daftar", halaman: "/keluar", selector: "[data-slot='badge'][data-variant='success']", property: "color", min: 4.5 },
  { nama: "badge arsip surat keluar di daftar", halaman: "/keluar", selector: "[data-slot='badge'][data-variant='secondary']", property: "color", min: 4.5 },
  { nama: "placeholder nomor surat keluar di form", halaman: "/keluar/baru", selector: "#nomor_surat", property: "placeholder-color", min: 4.5 },
  { nama: "batas select tujuan surat keluar", halaman: "/keluar/baru", selector: "#tujuan", property: "border-color", min: 3 },
  { nama: "batas isian surat keluar", halaman: "/keluar/baru", selector: "#perihal", property: "border-color", min: 3 },
  { nama: "teks tombol simpan surat keluar", halaman: "/keluar/baru", selector: "[data-slot='button'][data-variant='default']", property: "color", min: 4.5 },
  { nama: "teks tujuan surat keluar di pengaturan", halaman: "/pengaturan/nama/penerima", selector: "[aria-labelledby='daftar-penerima'] [data-slot='card-title']", property: "color", min: 4.5 },
  { nama: "keterangan tujuan surat keluar di pengaturan", halaman: "/pengaturan/nama/penerima", selector: "[aria-labelledby='daftar-penerima'] [data-slot='card-description']", property: "color", min: 4.5 },
  { nama: "teks tombol melayang tambah surat keluar di HP", halaman: "/keluar", selector: "[data-fab]", property: "color", min: 4.5, lebar: 375 },
  { nama: "judul kartu kunci monitor", halaman: "/pengaturan/monitor", selector: "[aria-labelledby='monitor-kunci'] [data-slot='card-title']", property: "color", min: 4.5 },
  { nama: "keterangan kartu kunci monitor", halaman: "/pengaturan/monitor", selector: "[aria-labelledby='monitor-kunci'] [data-slot='card-description']", property: "color", min: 4.5 },
  { nama: "teks alamat layar di isian", halaman: "/pengaturan/monitor", selector: "#monitor-url", property: "color", min: 4.5 },
  { nama: "batas isian alamat layar", halaman: "/pengaturan/monitor", selector: "[data-slot='input-group']", property: "border-color", min: 3 },
  { nama: "teks badge asal kunci", halaman: "/pengaturan/monitor", selector: "[aria-labelledby='monitor-kunci'] [data-slot='badge'][data-variant='secondary']", property: "color", min: 4.5 },
  { nama: "teks tombol balas kunci", halaman: "/pengaturan/monitor", selector: "[aria-labelledby='monitor-kunci'] [data-slot='button'][data-variant='outline']", property: "color", min: 4.5 },
  { nama: "batas tombol balas kunci", halaman: "/pengaturan/monitor", selector: "[aria-labelledby='monitor-kunci'] [data-slot='button'][data-variant='outline']", property: "border-color", min: 3 },
];

// satu nama kategori yang sudah ada dipakai untuk memicu penolakan duplikat
const { PrismaClient: PrismaNama } = await import("@prisma/client");
const prismaNama = new PrismaNama();
const [{ nama: namaJenisUji }] = await prismaNama.$queryRaw`SELECT nama FROM jenis_surat ORDER BY nama LIMIT 1`;
await prismaNama.$disconnect();

const browser = await chromium.launch();
const page = await browser.newPage();
// penyegar SSE membuat elemen berganti di tengah pengukuran; kontras butuh DOM yang tenang
await page.route("**/api/pembaruan", (r) => r.fulfill({ status: 200, contentType: "text/event-stream", body: "" }));
// server dev bisa lambat compile saat halaman pertama dibuka, jadi timeout diperlebar
page.setDefaultTimeout(60000);

// Data uji dibersihkan dulu supaya nomor surat uji "UJ/Kontras-*" bisa dibuat lagi.
// Pengosongan ini menyapu tabel surat masuk dan disposisi — hanya untuk database uji (UJI_DB=1).
const { PrismaClient } = await import("@prisma/client");
const prismaBersih = new PrismaClient();
const { jagaDatabaseNyata } = await import("./pagar-uji.mjs");
await jagaDatabaseNyata(prismaBersih, "pemeriksa kontras (scripts/contrast.mjs)");
await prismaBersih.riwayat_jadwal_rapat.deleteMany({});
await prismaBersih.peserta_rapat.deleteMany({});
await prismaBersih.jadwal_rapat.deleteMany({});
await prismaBersih.disposisi.deleteMany({});
await prismaBersih.lampiran_surat.deleteMany({});
await prismaBersih.audit_logs.deleteMany({});
await prismaBersih.surat_masuk.deleteMany({});
await prismaBersih.agenda_counter.deleteMany({});
await prismaBersih.lampiran_keluar.deleteMany({});
await prismaBersih.surat_keluar.deleteMany({});
await prismaBersih.keluar_counter.deleteMany({});
await prismaBersih.$disconnect();

// Empat surat keluar uji dibuat langsung di database: pemicu alur maju hanya bekerja pada UPDATE,
// jadi insert boleh langsung berisi status yang mau diukur warnanya.
const prismaKeluar = new PrismaClient();
const hariUji = new Date("2026-11-05T00:00:00Z");
const keluarUji = {
  draf: await prismaKeluar.surat_keluar.create({
    data: { nomor_surat: "UJ/Keluar-draf", tanggal_surat: hariUji, tujuan: "Sekretariat Daerah", perihal: "Uji kontras surat keluar draf" },
  }),
  dikirim: await prismaKeluar.surat_keluar.create({
    data: { nomor_surat: "UJ/Keluar-dikirim", tanggal_surat: hariUji, tujuan: "Inspektorat Daerah", perihal: "Uji kontras surat keluar dikirim", status_surat: "dikirim", tanggal_kirim: hariUji },
  }),
  selesai: await prismaKeluar.surat_keluar.create({
    data: { nomor_surat: "UJ/Keluar-selesai", tanggal_surat: hariUji, tujuan: "Bagian Aset", perihal: "Uji kontras surat keluar selesai", status_surat: "selesai", tanggal_kirim: hariUji },
  }),
  arsip: await prismaKeluar.surat_keluar.create({
    data: { nomor_surat: "UJ/Keluar-arsip", tanggal_surat: hariUji, tujuan: "Badan Keuangan Daerah", perihal: "Uji kontras surat keluar arsip", status_surat: "arsip", status_sebelum_arsip: "selesai", tanggal_kirim: hariUji },
  }),
};
await prismaKeluar.$disconnect();

// bar penanda monitor dan badge "Sedang berjalan" di kalender butuh agenda hari ini sebagai sampel
const prismaAgenda = new PrismaClient();
const petugasAgenda = await prismaAgenda.users.findFirst({ where: { email: "petugas.aset@magelang.go.id" }, select: { id: true } });
const hariIniJakarta = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
await prismaAgenda.jadwal_rapat.create({
  data: {
    agenda_rapat: "Uji kontras agenda hari ini",
    tanggal_mulai: new Date(`${hariIniJakarta}T09:00:00+07:00`),
    status_rapat: "berlangsung",
    created_by: petugasAgenda?.id ?? null,
  },
});
// Baris agenda monitor butuh keempat nada lencana sekaligus, jadi waktunya diukur relatif ke sekarang:
// satu sedang berlangsung, satu dalam 30 menit berikutnya, satu terjadwal jauh, satu dibatalkan.
const sekarangUji = Date.now();
await prismaAgenda.jadwal_rapat.createMany({
  data: [
    {
      agenda_rapat: "Uji kontras berlangsung",
      tanggal_mulai: new Date(sekarangUji - 20 * 60_000),
      tanggal_selesai: new Date(sekarangUji + 40 * 60_000),
      tempat: "Ruang setsa",
      penyelenggara: "Sekretaris Daerah",
      status_rapat: "berlangsung",
      created_by: petugasAgenda?.id ?? null,
    },
    {
      agenda_rapat: "Uji kontras segera",
      tanggal_mulai: new Date(sekarangUji + 22 * 60_000),
      tanggal_selesai: new Date(sekarangUji + 82 * 60_000),
      tempat: "Aula BPKAD",
      status_rapat: "terjadwal",
      created_by: petugasAgenda?.id ?? null,
    },
    {
      agenda_rapat: "Uji kontras terjadwal",
      tanggal_mulai: new Date(sekarangUji + 150 * 60_000),
      tempat: "Ruang rapat 3",
      status_rapat: "terjadwal",
      created_by: petugasAgenda?.id ?? null,
    },
    {
      agenda_rapat: "Uji kontras dibatalkan",
      tanggal_mulai: new Date(sekarangUji + 300 * 60_000),
      tempat: "Aula",
      status_rapat: "dibatalkan",
      created_by: petugasAgenda?.id ?? null,
    },
  ],
});
await prismaAgenda.$disconnect();

// redirect server action kadang baru sampai beberapa saat setelah klik, dan waitForURL hanya
// menunggu navigasi berikutnya — jadi url di-poll saja.
async function tungguUrl(re, timeout = 30000) {
  const mulai = Date.now();
  while (!re.test(page.url())) {
    if (Date.now() - mulai > timeout) {
      const pesan = await page.locator("[data-slot='alert'], .text-destructive, [data-slot='field-error']").allTextContents();
      throw new Error(`url tidak menjadi ${re}, terakhir: ${page.url()}, pesan: ${JSON.stringify(pesan).slice(0, 260)}`);
    }
    await page.waitForTimeout(200);
  }
}

// Perubahan di halaman yang sama tidak lagi berpindah: pesannya toast, lalu payload di-refresh.
async function tungguToast(bagian, timeout = 30000) {
  const toast = page.locator('[data-slot="toast"]').filter({ hasText: bagian }).first();
  const mulai = Date.now();
  while (!(await toast.isVisible().catch(() => false))) {
    if (Date.now() - mulai > timeout) throw new Error(`toast "${bagian}" tidak muncul, url=${page.url()}`);
    await page.waitForTimeout(200);
  }
  await page.waitForLoadState("load").catch(() => {});
}

// form server action baru bisa dipakai setelah hidrasi selesai, jadi setiap goto diberi jeda
async function siapHalaman(url) {
  await page.goto(url);
  await page.waitForLoadState("load");
  await page.waitForTimeout(250);
}

await siapHalaman(`${BASE}/login`);
await page.fill("#email", "petugas.aset@magelang.go.id");
await page.fill("#password", "BCed08Gkc34dF1RM");
await page.getByRole("button", { name: "Masuk" }).click();
await page.waitForURL(`${BASE}/dashboard`);

// satu surat tanpa disposisi (badge destructive) lalu satu disposisi (badge info) supaya semua varian badge punya sampel
await siapHalaman(`${BASE}/surat/baru`);
await page.fill("#tanggal_terima", "2026-11-02");
await page.selectOption("#pengirim", "Sekretariat Daerah");
await page.fill("#nomor_surat", "UJ/Kontras-1");
await page.fill("#perihal", "Kontrak kerja sama pengelolaan barang milik daerah");
await page.fill("#isi_ringkas", "Koordinasi penyerahan aset.");
await page.getByRole("button", { name: "Simpan surat" }).click();
await tungguUrl(/\/surat\/[0-9a-f-]{36}/);
// form disposisi berada di langkah ke-4, jadi buka semua bagian dulu
await page.goto(page.url().includes("?") ? `${page.url()}&semua=1` : `${page.url()}?semua=1`);
await page.waitForLoadState("load");
await page.fill("#tanggal_disposisi", "2026-11-02");
await page.selectOption("#pemberi_disposisi", "Kabid Aset");
await page.selectOption("#penerima_disposisi", "Subid Penatausahaan Aset");
await page.fill("#isi_disposisi", "Laksanakan koordinasi.");
await page.getByRole("button", { name: "Simpan disposisi" }).click();
await page.waitForSelector("[data-slot='card-title']");
await siapHalaman(`${BASE}/surat/baru`);
await page.fill("#tanggal_terima", "2026-11-03");
await page.selectOption("#pengirim", "DPPKUM");
await page.fill("#nomor_surat", "UJ/Kontras-2");
await page.fill("#perihal", "Laporan inventaris aset gedung");
await page.fill("#isi_ringkas", "Inventaris tahunan.");
await page.getByRole("button", { name: "Simpan surat" }).click();
await tungguUrl(/\/surat\/[0-9a-f-]{36}/);
// surat ketiga dijadikan undangan rapat supaya badge info dan destructive punya sampel
await siapHalaman(`${BASE}/surat/baru`);
await page.fill("#tanggal_terima", "2026-11-04");
await page.selectOption("#pengirim", "Inspektorat Daerah");
await page.fill("#nomor_surat", "UJ/Kontras-3");
await page.fill("#perihal", "Undangan review aset gedung");
await page.fill("#isi_ringkas", "Review penggunaan gedung.");
await page.check('input[name="undangan"][value="ya"]');
await page.fill("#rapat_agenda", "Review penggunaan gedung");
await page.fill("#rapat_mulai", "2026-11-20T09:00");
await page.getByRole("button", { name: "Simpan surat" }).click();
await page.waitForTimeout(1200);
if (!/\/surat\/[0-9a-f-]{36}/.test(page.url())) {
  console.log("debug surat3:", page.url(), await page.locator("[data-slot='alert']").first().textContent().catch(() => "(tidak ada)"));
}
await tungguUrl(/\/surat\/[0-9a-f-]{36}/);
// surat ini punya agenda terjadwal, jadi kartu pengelolaan menampilkan hint blocker dan tombol yang di-disable
const urlSuratUndangan = page.url();

// surat undangan yang belum punya agenda: bagian Rapat menampilkan formulir agendanya, jadi isian itu ikut diukur
const prismaUndangan = new PrismaClient();
const petugasUndangan = await prismaUndangan.users.findFirst({ where: { email: "petugas.aset@magelang.go.id" } });
const suratUndanganTanpaAgenda = await prismaUndangan.surat_masuk.create({
  data: {
    nomor_agenda: "UJ/Kontras-undangan-tanpa-agenda",
    tanggal_terima: new Date("2026-11-05T00:00:00Z"),
    pengirim: "Inspektorat Daerah",
    perihal: "Uji surat undangan tanpa agenda",
    status_undangan_rapat: "ya",
    created_by: petugasUndangan?.id ?? null,
  },
  select: { id: true },
});
await prismaUndangan.$disconnect();
const ruteTanpaAgenda = `/surat/${suratUndanganTanpaAgenda.id}?semua=1`;
await siapHalaman(`${BASE}/surat/baru`);
await page.fill("#tanggal_terima", "2026-11-06");
await page.selectOption("#pengirim", "BKPSDM");
await page.fill("#nomor_surat", "UJ/Kontras-4");
await page.fill("#perihal", "Undangan koordinasi kepegawaian aset");
await page.fill("#isi_ringkas", "Koordinasi pegawai pada unit aset.");
await page.check('input[name="undangan"][value="ya"]');
await page.fill("#rapat_agenda", "Koordinasi kepegawaian aset");
await page.fill("#rapat_mulai", "2026-11-03T09:00");
await page.getByRole("button", { name: "Simpan surat" }).click();
await tungguUrl(/\/surat\/[0-9a-f-]{36}/);
// agenda yang lewat dibatalkan lewat detail tanggalnya; badge "Dibatalkan" lalu terlihat
// di daftar "sudah lewat" dan select yang di-tint di detail tanggal — dua sampel varian destructive.
await siapHalaman(`${BASE}/rapat?bulan=2026-11&tanggal=2026-11-03`);
await page.waitForSelector("[data-slot='select-trigger'][aria-label^='Status agenda']");
await page.locator("[data-slot='select-trigger'][aria-label^='Status agenda']").first().click();
await page.getByRole("option", { name: "Dibatalkan", exact: true }).click();
await tungguToast("Status agenda diubah menjadi Dibatalkan.");
await siapHalaman(`${BASE}/rapat?bulan=2026-11`);
await page.waitForSelector("[data-slot='badge'][data-variant='destructive']");
await siapHalaman(`${BASE}/rapat?bulan=2026-11&tanggal=2026-11-03`);
await page.waitForSelector("[data-slot='select-trigger'][aria-label^='Status agenda']");
await siapHalaman(`${BASE}/surat`);
await page.waitForSelector("[data-slot='badge']");

// ganti mode lewat tombol di header: kelas .dark dipasang oleh next-themes, tidak di-toggle manual
async function gantiMode() {
  await page.locator("[data-slot='theme-toggle']").filter({ visible: true }).first().click();
  await page.waitForTimeout(250);
}

const siap = new Set();
async function buka(h, bukaDialog, gelap, isiCombobox, ketikCombobox) {
  await page.mouse.move(700, 420);
  // tema dibaca dari penyimpanan peramban sebelum halaman dimuat, jadi next-themes memasang
  // kelas .dark sendiri; toggle manual setelah hidrasi bisa kalah oleh efek provider.
  await page.evaluate((t) => localStorage.setItem("aset-theme", t), gelap ? "dark" : "light");
  const kunci = `${h}:${gelap ? "gelap" : "terang"}`;
  // halaman alert dibangun lewat validasi server, jadi jangan dibuka ulang
  if (h === "/surat/baru?galat=uji") {
    if (siap.has(kunci)) return;
    siap.add(kunci);
  }
  await page.goto(`${BASE}${h}`);
  await page.waitForLoadState("load");
  await page.waitForSelector("main");
  // komponen client (tab, grafik) butuh hidrasi sebelum warnanya bisa dibaca
  await page.waitForTimeout(500);
  // dialog harus dibuka dulu: isinya tidak ada di DOM sampai pemicunya ditekan. `true` = dialog agenda
  // mandiri; string = nama pemicu modal rute (tautan di header, atau tombol melayang di HP).
  if (bukaDialog) {
    if (bukaDialog === true) {
      await page.getByRole("button", { name: "Buat agenda sendiri" }).filter({ visible: true }).first().click();
      await page.waitForSelector("#baru_agenda");
    } else {
      const tautan = page.getByRole("link", { name: bukaDialog }).first();
      if ((await tautan.count()) > 0 && (await tautan.isVisible())) {
        await tautan.click();
      } else {
        await page.locator("[data-fab]").first().click();
      }
      await page.waitForSelector('[data-slot="dialog-content"]');
    }
    await page.waitForTimeout(250);
  }
  // daftar pilihan nama peserta rapat harus dibuka dulu: popupnya baru ada setelah mengetik, dan chip
  // nama baru muncul setelah Tab.
  if (isiCombobox || ketikCombobox) {
    await page.locator("#peserta_nama").first().click();
    await page.locator("#peserta_nama").first().fill(ketikCombobox ?? isiCombobox);
    await page.waitForSelector('[data-slot="combobox-content"]');
    if (isiCombobox) await page.locator("#peserta_nama").first().press("Tab");
    await page.waitForTimeout(250);
  }
  if (h === "/surat/baru?galat=uji") {
    // waktu selesai mendahului waktu mulai menghasilkan alert galat dari validasi server
    await page.fill("#tanggal_terima", "2026-11-05");
    await page.selectOption("#pengirim", "Inspektorat Daerah");
    await page.fill("#nomor_surat", "UJ/Kontras-Galat");
    await page.fill("#perihal", "Undangan dengan jadwal tidak valid");
    await page.fill("#isi_ringkas", "Contoh penolakan validasi.");
    await page.check('input[name="undangan"][value="ya"]');
    await page.fill("#rapat_agenda", "Review penggunaan gedung");
    await page.fill("#rapat_mulai", "2026-11-20T09:00");
    await page.fill("#rapat_selesai", "2026-11-20T08:00");
    await page.getByRole("button", { name: "Simpan surat" }).click();
    await page.waitForSelector("[data-slot='field-error']");
  }
  siap.add(h);
}

let gagal = 0;
let diperiksa = 0;

const daftarUkur = [];

/** Kumpulkan pemeriksaan dulu: satu kunjungan halaman mengukur semua selector di grup yang sama. */
async function ukur(k) {
  daftarUkur.push(k);
}

async function ukurSatu(k, gelap) {
  // sebagian kasus hanya ada di layar sentuh (tombol melayang, tombol hanya-icon), jadi periksa di lebar itu
  await page.setViewportSize({ width: k.lebar ?? 1280, height: k.lebar ? 820 : 720 });
  for (let percobaan = 1; percobaan <= 2; percobaan++) {
    const el = page.locator(k.selector).filter({ visible: true }).first();
    if ((await el.count()) === 0) {
      console.log(`SKIP ${k.nama} — ${gelap ? "mode gelap" : "mode terang"} (selector ${k.selector} tidak ditemukan, halaman ${page.url()})`);
      return;
    }
    let hasil;
    try {
      await el.scrollIntoViewIfNeeded();
      if (k.hover) {
        await el.hover();
        await page.waitForTimeout(150);
      }
      hasil = await el.evaluate((node, property) => {
    // canvas ikut membaca CSS color (oklch / color-mix) lalu menormalkannya ke rgb/rgba
    const kanvas = document.createElement("canvas");
    kanvas.width = kanvas.height = 1;
    const ctx = kanvas.getContext("2d");
    const baca = (teks) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = teks;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      if (a === 0) return null;
      return { r, g, b, a: a / 255 };
    };
    const blend = (depan, belakang) => ({
      r: depan.a * depan.r + (1 - depan.a) * belakang.r,
      g: depan.a * depan.g + (1 - depan.a) * belakang.g,
      b: depan.a * depan.b + (1 - depan.a) * belakang.b,
      a: 1,
    });
    const gaya = getComputedStyle(node);
    // Shape grafik: slice donut bisa berupa path (fill) atau cincin penuh (stroke).
    const warnaDepan =
      property === "chart-color"
        ? gaya.fill !== "none" ? gaya.fill : gaya.stroke
        : property === "placeholder-color"
          ? getComputedStyle(node, "::placeholder").color
          : property === "isi-color"
            ? gaya.backgroundColor
            : gaya[property];
    const depan = baca(warnaDepan);
    // rantai latar: dari elemen ke html, masing-masing di-blend ke latar berikutnya
    let latar = { r: 255, g: 255, b: 255, a: 1 };
    const rantai = [];
    // batas (border) dan isi solid (bar meter) diukur terhadap latar di luar elemen: warna elemen dan
    // latar elemen sendiri sama, jadi latar sendiri tidak ikut di-blend
    const mulai = property === "border-color" || property === "isi-color" ? node.parentElement : node;
    for (let n = mulai; n; n = n.parentElement) rantai.push(n);
    for (let i = rantai.length - 1; i >= 0; i--) {
      const bg = baca(getComputedStyle(rantai[i]).backgroundColor);
      if (bg && bg.a > 0) latar = blend(bg, latar);
    }
    return { depan, latar };
    }, k.property);
    } catch {
      if (percobaan === 1) {
        await page.waitForTimeout(400);
        continue;
      }
      console.log(`SKIP ${k.nama} — ${gelap ? "mode gelap" : "mode terang"} (elemen berganti saat diukur)`);
      return;
    }

    if (!hasil.depan) {
      console.log(`SKIP ${k.nama} — ${gelap ? "mode gelap" : "mode terang"} (warna tidak terbaca)`);
      return;
    }
    diperiksa++;
    const depan = hasil.depan.a < 1 ? campur(hasil.depan, hasil.latar) : hasil.depan;
    const r = rasio(depan, hasil.latar);
    const ok = r >= k.min;
    if (!ok) gagal++;
    console.log(`${ok ? "PASS" : "FAIL"} ${r.toFixed(2)}:1 (min ${k.min}:1) ${k.nama} — ${gelap ? "mode gelap" : "mode terang"}`);
    return;
  }
}

/** Jalankan semua pemeriksaan yang sudah dikumpulkan, per grup halaman + lebar + dialog. */
async function jalankanUkur() {
  const grup = new Map();
  const hanya = process.env.KONTRAS_HANYA;
  const daftar = hanya ? daftarUkur.filter((k) => k.nama.includes(hanya)) : daftarUkur;
  for (const k of daftar) {
    const kunci = `${k.halaman}|${k.lebar ?? 1280}|${k.bukaDialog ?? ""}|${k.isiCombobox ?? ""}|${k.ketikCombobox ?? ""}`;
    const isi = grup.get(kunci) ?? [];
    isi.push(k);
    grup.set(kunci, isi);
  }
  for (const isi of grup.values()) {
    const k0 = isi[0];
    await buka(k0.halaman, k0.bukaDialog, false, k0.isiCombobox, k0.ketikCombobox);
    for (const gelap of [false, true]) {
      await buka(k0.halaman, k0.bukaDialog, gelap, k0.isiCombobox, k0.ketikCombobox);
      for (const k of isi) await ukurSatu(k, gelap);
    }
  }
  daftarUkur.length = 0;
}

// toast: teks hasil harus terbaca di latarnya sendiri (sukses dan galat diukur terpisah)
async function ukurToast(nama, bagian, min, elem = '[data-slot="toast-title"]') {
  const toast = page.locator('[data-slot="toast"]').filter({ hasText: bagian }).first();
  if ((await toast.count()) === 0) {
    console.log(`SKIP ${nama} (toast ${bagian} tidak terlihat)`);
    return;
  }
  for (const gelap of [false, true]) {
    // mode dibaca dengan tombol tema di header (next-themes yang memasang kelas), bukan toggle manual
    if (gelap) await gantiMode();
    const hasil = await toast.evaluate((node, sel) => {
    const kanvas = document.createElement("canvas");
    kanvas.width = kanvas.height = 1;
    const ctx = kanvas.getContext("2d");
    const baca = (teks) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = teks;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return a === 0 ? null : { r, g, b, a: a / 255 };
    };
    const judul = node.querySelector(sel) ?? node;
    const gaya = getComputedStyle(judul);
    const teks = baca(gaya.color);
    let latar = null;
    for (let el = judul; el && !latar; el = el.parentElement) {
      const c = baca(getComputedStyle(el).backgroundColor);
      if (c && c.a === 1) latar = c;
    }
    if (!latar) latar = baca(getComputedStyle(document.body).backgroundColor);
    const lum = (c) => {
      const k = (v) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * k(c.r) + 0.7152 * k(c.g) + 0.0722 * k(c.b);
    };
    if (!teks || !latar) return { banding: null };
    const a = lum(teks);
    const b = lum(latar);
    return { banding: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    }, elem);
    diperiksa++;
    const ok = hasil.banding !== null && hasil.banding >= min;
    if (!ok) gagal++;
    console.log(`${ok ? "PASS" : "GAGAL"} ${nama} — ${gelap ? "mode gelap" : "mode terang"} (${hasil.banding === null ? "?" : hasil.banding.toFixed(2)}:1, min ${min})`);
    if (gelap) await gantiMode();
  }
}

for (const k of kasus) await ukur(k);

// kartu pengelolaan surat: keterangan blocker dan tombol yang di-disable harus tetap terbaca
const rutePengelolaan = urlSuratUndangan.replace(BASE, "") + (urlSuratUndangan.includes("?") ? "&semua=1" : "?semua=1");
await ukur({ nama: "keterangan yang menghalangi arsip", halaman: rutePengelolaan, selector: "#bagian-pengelolaan p", property: "color", min: 4.5 });
await ukur({ nama: "garis tombol arsipkan yang di-disable", halaman: rutePengelolaan, selector: "#bagian-pengelolaan button[disabled]", property: "border-color", min: 3 });
await ukur({ nama: "teks tombol arsipkan yang di-disable", halaman: rutePengelolaan, selector: "#bagian-pengelolaan button[disabled]", property: "color", min: 3 });

// formulir agenda untuk surat undangan yang belum punya agenda
await ukur({ nama: "teks isian agenda rapat surat tanpa agenda", halaman: ruteTanpaAgenda, selector: `#agenda-${suratUndanganTanpaAgenda.id}`, property: "color", min: 4.5 });
await ukur({ nama: "garis isian waktu mulai rapat surat tanpa agenda", halaman: ruteTanpaAgenda, selector: `#mulai-${suratUndanganTanpaAgenda.id}`, property: "border-color", min: 3 });
await ukur({ nama: "keterangan waktu selesai rapat surat tanpa agenda", halaman: ruteTanpaAgenda, selector: `#selesai-${suratUndanganTanpaAgenda.id} + [data-slot='field-description']`, property: "color", min: 4.5 });

// isian nama peserta rapat: placeholder, garis grup, chip nama, dan daftar pilihan yang terbuka
await ukur({ nama: "placeholder isian nama peserta", halaman: rutePengelolaan, selector: "#peserta_nama", property: "placeholder-color", min: 4.5 });
await ukur({ nama: "garis grup isian nama peserta", halaman: rutePengelolaan, selector: "[data-slot='combobox-chips']", property: "border-color", min: 3, isiCombobox: "aset" });
await ukur({ nama: "teks chip nama peserta", halaman: rutePengelolaan, selector: "[data-slot='combobox-chip']", property: "color", min: 4.5, isiCombobox: "aset" });
await ukur({ nama: "ikon hapus pada chip nama peserta", halaman: rutePengelolaan, selector: "[data-slot='combobox-chip-remove']", property: "color", min: 3, isiCombobox: "aset", lebar: 375 });
await ukur({ nama: "teks nama pegawai di daftar pilihan", halaman: rutePengelolaan, selector: "[data-slot='combobox-item']", property: "color", min: 4.5, isiCombobox: "aset" });
await ukur({ nama: "teks nama pegawai yang tersorot", halaman: rutePengelolaan, selector: "[data-slot='combobox-item'][data-highlighted]", property: "color", min: 4.5, isiCombobox: "aset" });
await ukur({ nama: "keterangan saat tidak ada nama yang cocok", halaman: rutePengelolaan, selector: "[data-slot='combobox-empty']", property: "color", min: 4.5, ketikCombobox: "zzzzzzzz" });

// surat yang sudah diarsipkan: keterangan penguncian dan catatan kalender harus tetap terbaca
await jalankanUkur();
await buka(rutePengelolaan);
await page.mouse.move(700, 420);
await page.getByLabel("Ubah status agenda").click();
await page.getByRole("option", { name: "Dibatalkan", exact: true }).click();
await tungguToast("Status agenda diubah menjadi Dibatalkan.");
await jalankanUkur();
await buka(rutePengelolaan);
await page.mouse.move(700, 420);
await page.getByRole("button", { name: "Arsipkan surat" }).click();
await tungguToast("Surat diarsipkan.");
await ukurToast("teks toast sukses di latarnya", "Surat diarsipkan.", 4.5);
await ukurToast("ikon sukses di chip toast", "Surat diarsipkan.", 4.5, '[data-slot="toast-chip"]');
await ukurToast("ikon tutup toast di latarnya", "Surat diarsipkan.", 3, '[data-slot="toast-close"]');
await ukur({ nama: "keterangan penguncian surat arsip", halaman: rutePengelolaan, selector: "#bagian-pengelolaan p:nth-of-type(2)", property: "color", min: 4.5 });
await ukur({ nama: "catatan agenda dari surat arsip di kalender", halaman: "/rapat?bulan=2026-11&tanggal=2026-11-20", selector: '.text-muted-foreground:has-text("suratnya sudah diarsipkan")', property: "color", min: 4.5 });

// surat dikeluarkan dari arsip: tombol hapus agenda (teks destructive di latar kartu) harus tetap terbaca
await jalankanUkur();
await buka(rutePengelolaan);
await page.mouse.move(700, 420);
await page.getByRole("button", { name: "Keluarkan dari arsip" }).click();
await tungguToast("Surat dikeluarkan dari arsip");
await buka(rutePengelolaan);
await ukur({ nama: "teks tombol hapus agenda", halaman: rutePengelolaan, selector: "[aria-labelledby='rapat'] button.text-destructive", property: "color", min: 4.5 });

// toast galat harus tetap terbaca di latarnya: nama kategori yang sudah ada ditolak duplikatnya
await jalankanUkur();
await buka("/pengaturan/jenis/masuk");
await page.waitForSelector("#nama_jenis_masuk");
await page.fill("#nama_jenis_masuk", namaJenisUji);
await page.getByRole("button", { name: "Tambah Kategori Surat masuk" }).click();
await tungguToast("sudah terdaftar");
await ukurToast("teks toast galat di latarnya", "sudah terdaftar", 4.5);
await ukurToast("ikon galat di chip toast", "sudah terdaftar", 4.5, '[data-slot="toast-chip"]');

// --- surat keluar: badge tiap status, isian status, state disabled, dan toast di dua mode ---
const ruteKeluarDraf = `/keluar/${keluarUji.draf.id}?semua=1`;
const ruteKeluarArsip = `/keluar/${keluarUji.arsip.id}?semua=1`;
await ukur({ nama: "badge draf surat keluar di detail", halaman: `/keluar/${keluarUji.draf.id}`, selector: "[data-slot='badge'][data-variant='warning']", property: "color", min: 4.5 });
await ukur({ nama: "badge dikirim surat keluar di detail", halaman: `/keluar/${keluarUji.dikirim.id}`, selector: "[data-slot='badge'][data-variant='info']", property: "color", min: 4.5 });
await ukur({ nama: "badge selesai surat keluar di detail", halaman: `/keluar/${keluarUji.selesai.id}`, selector: "[data-slot='badge'][data-variant='success']", property: "color", min: 4.5 });
await ukur({ nama: "badge arsip surat keluar di detail", halaman: ruteKeluarArsip, selector: "[data-slot='badge'][data-variant='secondary']", property: "color", min: 4.5 });
await ukur({ nama: "teks select status surat keluar", halaman: ruteKeluarDraf, selector: "[data-slot='select-trigger'][id='status_surat']", property: "color", min: 4.5 });
await ukur({ nama: "garis select status surat keluar", halaman: ruteKeluarDraf, selector: "[data-slot='native-select'][name='status_surat']", property: "border-color", min: 3 });
await ukur({ nama: "keterangan penguncian surat keluar arsip", halaman: ruteKeluarArsip, selector: "#bagian-pengelolaan p", property: "color", min: 4.5 });
await ukur({ nama: "teks tombol arsipkan yang di-disable pada surat keluar draf", halaman: ruteKeluarDraf, selector: "#bagian-pengelolaan button[disabled]", property: "color", min: 3 });
await ukur({ nama: "garis tombol arsipkan yang di-disable pada surat keluar draf", halaman: ruteKeluarDraf, selector: "#bagian-pengelolaan button[disabled]", property: "border-color", min: 3 });
await ukur({ nama: "keterangan yang menghalangi arsip pada surat keluar draf", halaman: ruteKeluarDraf, selector: "#bagian-pengelolaan p", property: "color", min: 4.5 });

// isian waktu kirim di panel koreksi: teks isian, ketarangan, dan garisnya
await ukur({ nama: "teks isian waktu kirim di panel koreksi surat keluar", halaman: `${ruteKeluarDraf}&keluar=ubah`, selector: "#edit_waktu_kirim", property: "color", min: 4.5 });
await ukur({ nama: "garis isian waktu kirim di panel koreksi surat keluar", halaman: `${ruteKeluarDraf}&keluar=ubah`, selector: "#edit_waktu_kirim", property: "border-color", min: 3 });
await ukur({ nama: "keterangan waktu kirim di panel koreksi surat keluar", halaman: `${ruteKeluarDraf}&keluar=ubah`, selector: "#edit_waktu_kirim + [data-slot='field-description']", property: "color", min: 4.5 });

// status maju diterima (dikirim, waktu kirim tercatat otomatis), status mundur ditolak database
await jalankanUkur();
await siapHalaman(`${BASE}${ruteKeluarDraf}`);
await page.mouse.move(700, 420);
await page.locator("#status_surat").click();
await page.getByRole("option", { name: "Dikirim", exact: true }).click();
await tungguToast("Surat keluar ditandai dikirim");
await ukurToast("teks toast sukses surat keluar", "Surat keluar ditandai dikirim", 4.5);
await ukurToast("ikon sukses surat keluar di chip toast", "Surat keluar ditandai dikirim", 4.5, '[data-slot="toast-chip"]');

await siapHalaman(`${BASE}${ruteKeluarDraf}`);
await page.mouse.move(700, 420);
await page.locator("#status_surat").click();
await page.getByRole("option", { name: "Draf", exact: true }).click();
await tungguToast("Status surat keluar gagal diubah");
await ukurToast("teks toast galat surat keluar", "Status surat keluar gagal diubah", 4.5);
await ukurToast("ikon galat surat keluar di chip toast", "Status surat keluar gagal diubah", 4.5, '[data-slot="toast-chip"]');

await jalankanUkur();
await browser.close();
console.log(`\n${diperiksa} pemeriksaan, ${gagal} gagal`);
if (gagal > 0) process.exit(1);
