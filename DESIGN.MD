# DESIGN.md — shadcn "Amber" (preset `bJMTbSfw`) untuk Bidang Aset

Design system aplikasi Agenda Surat dan Jadwal Rapat, Bidang Aset BPKAD Kota Magelang.
Dibangun di atas shadcn/ui (basis Radix) dengan preset `bJMTbSfw` yang diadaptasi: kanvas krem hangat,
kartu putih sebagai surface naik, aksen amber burnt, plus token status khusus aplikasi.
Mode gelap mengikuti rancangan "Nova - Inter": kanvas nyaris hitam hangat, kartu satu tingkat di atasnya,
garis tipis, aksen karat. Dua mode dipilih pengguna lewat toggle di header (`next-themes`, `aset-theme`).
Stack: Next.js 16 + Tailwind v4. Semua komponen datang dari `components/ui/*`; tidak ada kelas custom generik.

## 1. Token warna (`app/globals.css`, OKLCH)

### Mode terang

| Token | Nilai | Pakai |
|---|---|---|
| `--background` | `oklch(0.975 0.012 95.277)` | kanvas krem hangat; kartu putih (`--card`) terasa naik di atasnya |
| `--card` | `oklch(1 0 0)` | surface data: form, tabel, kartu metrik |
| `--foreground` | `oklch(0.147 0.004 49.25)` | teks utama (19.76:1 di kartu) |
| `--muted-foreground` | `oklch(0.48 0.014 58.071)` | teks sekunder (6.55:1 di kanvas), placeholder (5.77:1 di isian) |
| `--border` | `oklch(0.923 0.003 48.717)` | pemisah dekoratif (separator, garis tabel, ring inset) |
| `--input` | `oklch(0.55 0.022 49.25)` | batas input/select/textarea/tombol outline (4.89:1 di kartu) |
| `--ring` | `oklch(0.5 0.155 48.998)` | focus ring 3px `ring-ring/30` |
| `--primary` | `oklch(0.5 0.155 48.998)` | aksi utama (tombol solid), link, menu aktif, fokus; teks `primary-foreground` 6.12:1 |
| `--primary-hover` | `hover:bg-primary/80` bawaan shadcn | pressed/active; `active:` menaikkan 1px lewat cva tombol |
| `--success` | `oklch(0.432 0.118 145.2)` (+ `--success-bg/-line`) | badge "disposisi berjalan/selesai", chip delta baik (6.72:1 di tint) |
| `--warning` | `oklch(0.502 0.108 62.5)` (+ `--warning-bg/-line`) | badge "dijadwalkan ulang" (5.34:1 di tint) |
| `--info` | `oklch(0.42 0.088 322.12)` (+ `--info-bg/-line`) | badge "terjadwal", penanda hari ini di kalender (17.30:1 angka hari ini) |
| `--destructive` | `oklch(0.5 0.2 27.325)` | badge "dibatalkan", tombol hapus, alert gagal (5.52:1 di tint) |
| `--sidebar-*` | latar `oklch(0.985 0.001 106.423)`, teks `oklch(0.147 0.004 49.25)` | shell kiri (18.92:1), dipisah garis bukan warna. Item aktif = `bg-sidebar-primary` + `sidebar-primary-foreground` (6.12:1); hover/pressed = `bg-foreground/8` dan `/12` |
| `--chart-1..5` | ramp cokelat hangat `oklch(0.869 0.005 56.366)` → `oklch(0.268 0.007 34.298)` | batang grafik; `--chart-3` (7.64:1 di card) untuk batang utama |
| `--chart-cat-1..6` | hue terpisah: violet 291, biru 240, hijau 145, amber 75, clay 27, teal 190 (L ~0.5) | slice donut komposisi (5.09:1 di card); "Lainnya" memakai `--chart-4` |
| `--radius` | `0.625rem` (tombol 4–6px lewat `radius-sm/md`, kartu 24px lewat `min(var(--radius-4xl),24px)`) | satu skala radius |

### Mode gelap (`.dark`)

| Token | Nilai | Pakai |
|---|---|---|
| `--background` | `oklch(0.17 0.012 42)` | kanvas nyaris hitam **hangat** (hue 42) — netral kebiruan terlihat seperti "mode gelap default" |
| `--card` | `oklch(0.215 0.012 42)` | satu tingkat di atas kanvas; teks 15.12:1 |
| `--foreground` | `oklch(0.95 0.006 95)` | bukan putih murni (0.95) — putih murni di latar gelap menyilaukan |
| `--muted-foreground` | `oklch(0.74 0.018 75)` | teks sekunder (7.58:1 di kanvas), placeholder (6.86:1 di isian) |
| `--border` | `oklch(0.32 0.016 42)` | garis tipis di gelap |
| `--input` | `oklch(0.55 0.022 45)` | batas form ≥3:1 terhadap kartu gelap (3.59:1) |
| `--primary` | `oklch(0.72 0.17 46)` (teks `oklch(0.24 0.06 44)`) | karat: kontradiksi gelap shadcn — fill terang, teks gelap di atasnya (6.34:1) |
| `--destructive` | `oklch(0.86 0.13 22)` | teks galat terang supaya lolos 4.5:1 di tint-nya (6.33:1 badge) |
| `--success/-warning/-info` | teks terang (`0.78/0.85/0.82`) di tint gelap `oklch(0.24–0.26)` | badge dan select ber-tint di gelap |
| `--sidebar-*` | latar `oklch(0.19 0.012 42)` (sedikit lebih terang dari kanvas), menu aktif karat | sama prinsipnya dengan mode terang |
| `--chart-1..5` | ramp abu hangat terang → gelap `oklch(0.86 … 75)` → `oklch(0.3 … 45)` | batang di latar gelap; `--chart-3` 3.60:1 |
| `--chart-cat-1..6` | hue sama dengan mode terang, dinaikkan ke L 0.72–0.78 | slice donut tetap berbeda hue di gelap (6.82:1) |

Tint yang dipakai: isian form `bg-input/10`, badge dan chip `bg-<token>/10`, panel isian `bg-background`
(warna kanvas, lebih gelap dari kartu di terang; lebih gelap dari kartu di gelap juga).

**Alias warna harus dihitung ulang di elemen `.dark` bersarang.** `@theme inline` membuat `--color-*` di `:root`
berisi nilai token *saat itu* — kalau halaman sedang mode terang, `--color-chart-masuk` sudah ternilai warna mode terang,
dan elemen `.dark` yang bukan `<html>` (layar monitor `/monitor` selalu gelap) tetap mewarisi nilai itu. Karena itu blok
`.dark` juga mendeklarasikan ulang alias yang dipakai di dalam layar: `--color-chart-masuk/-keluar`, `--color-chart-cat-1..6`,
dan alias status (`--color-success/-warning/-info` beserta `-bg` dan `-line`). Tanpa itu batang grafik di monitor jadi 2,30:1
dan tint badge salah warna. Aplikasi biasa tidak terpengaruh: di sana `.dark` ada di `<html>` sehingga alias sudah benar.
Font Inter (variable) — angka memakai `tabular-nums` lewat utility `num`.
Marka: logo resmi BPKAD Kota Magelang. `public/logo.png` 256px (~24 KB) untuk sidebar dan login,
`public/logo-cetak.png` 512px (~81 KB) untuk kop laporan. Sumber asli 4726px (~9 MB) tidak masuk repo;
hasil dibuat ulang dengan `npm run logo:optimize`.

## 2. Penyimpangan dari preset, dan alasannya

1. **`--input` dan `--ring` dipisah dari `--border`.** Preset memberi border sangat terang — batas form
   hanya ~1.2:1 di putih. Diturunkan ke `oklch(0.55 0.022 49.25)` → 4.89:1 di kartu terang dan 3.59:1 di kartu
   gelap; komponen form memakai `border-input`.
2. **Kanvas di-tint, bukan putih.** Preset memakai `--background` putih sama dengan `--card`, sehingga
   seluruh halaman jadi satu bidang datar dan pemisah hanya bergantung pada ring. Kanvas digeser ke
   `oklch(0.975 0.012 95.277)` (krem hangat, hue preset) supaya kartu putih menjadi surface yang
   naik tanpa bayangan keras. `@media print` mengembalikan kanvas ke putih agar laporan tidak tercetak abu-abu.
3. **`--sidebar` = kanvas.** Warna sidebar yang berbeda memecah ruang jadi "dunia sidebar" dan "dunia konten";
   garis tipis cukup.
4. **`Card variant="inset"`.** Panel isian memakai latar kanvas + `ring-border/70` tanpa bayangan, sehingga
   form tidak menjadi peer dari kartu data. Kartu data tetap putih.
5. **`--destructive` disesuaikan dua kali.** Di mode terang preset `oklch(0.577)` turun ke `oklch(0.5 0.2 27.325)`
   (teks badge di tint 10% 3.97:1 → 5.52:1); di mode gelap justru dinaikkan ke `oklch(0.86 0.13 22)` karena merah
   gelap hanya ~2.4:1 di tint-nya sendiri (6.33:1 setelah dinaikkan).
6. **`--muted-foreground` disesuaikan dua kali.** Preset `oklch(0.553)` hanya ~3.4:1 di krem; digelapkan ke
   `oklch(0.48 0.014 58.071)` (placeholder 5.77:1, keterangan 6.55:1) dan di mode gelap diangkat ke `oklch(0.74 0.018 75)`
   (7.58:1 di kanvas gelap).
7. **Tiga token status ditambahkan** (`--success`, `--warning`, `--info`) beserta tint dan garisnya. Preset hanya
   punya primary/destructive, padahal status surat, disposisi, dan rapat membawa makna berbeda; badge selalu
   berlabel teks, warna bukan satu-satunya penanda.
8. **Isian form memakai tint 10%** (`bg-input/10`) bukan 25%: tetap terbaca sebagai isian, kontras teks aman.
9. **Lebar minimum select ditentukan dari opsi terpanjang**, bukan angka tetap. Popup bawaan browser selebar
   elemen select, jadi `lebarOpsiMin()` (`lib/format.ts`) menghitung opsi terpanjang dan menulisnya sebagai `ch`
   di elemen `Field` (ikut ukuran font, tidak memotong baris lain, dan ditahan sampai lebar panel di layar sentuh).
   Nama kategori surat yang panjang ("Surat Keterangan Status Tanah") tidak terpotong di popup desktop.
10. **`Button variant="selected"` untuk pilihan aktif di toolbar** (periode dashboard, "Bulan berjalan" di rapat).
    Navigasi bulan bukan milik header halaman — ia milik kalender, jadi ia berada di dalam kartu "Kalender <bulan>"
    di atas grid kalender (`CardContent`), dan header hanya berisi judul. Di desktop barisnya rata kanan dan pil hanya
    selebar isinya; di HP pil rata penuh dengan `‹` di tepi kiri dan `›`/📅 di tepi kanan (jangkauan jempol), nama bulan
    di tengah. Bentuknya satu pil ("segmented control") — `rounded-full border-(--input) p-1` berisi `ChevronLeftIcon`, nama bulan
    sebagai teks (`namaBulan(bulan)`), `ChevronRightIcon`, garis pemisah (hanya di desktop), lalu `CalendarDaysIcon`. Tombolnya
    `variant="ghost"` (`hover:bg-accent`) supaya tidak ada tiga lingkaran border yang bersaing dengan judul; hanya bulan
    berjalan yang di-fill (`variant="selected"`). Nama tetap terbaca lewat `aria-label` ("Bulan sebelumnya", "Bulan
    berikutnya", "Bulan berjalan"). Ukuran desktop `icon-sm` (28px — minimum kontrol utama), di layar sentuh dipaksa 44px
    lewat `[data-slot="month-nav"] [data-slot="button"] { min-width: 2.75rem }` di media query 768px. Border grup memakai
    `--input` (4.89:1 di latar kartu), bukan `--border` (0.923 → 1.16:1 terhadap latar header).
    `variant="secondary"` memakai `bg-secondary` (`oklch(0.955)`) yang hanya ~1.1:1 dari kanvas (`oklch(0.975)`) —
    pilihan aktif tidak terlihat sama sekali. Tint `bg-primary/10` dan `/15` juga masih terbaca abu-abu karena
    `--primary` sangat gelap dan nyaris netral. Pilihan aktif sekarang diisi `bg-primary` dengan teks
    `primary-foreground` (6.12:1) dan garis `border-primary` terhadap latar luar (4.89:1); warna, bukan hanya
    teks tebal, yang menyatakan state. `aria-current` tetap dipasang untuk pembaca layar.
11. **Wajib ditandai, bukan ditebak.** Isian wajib tetap (`tanggal terima`, `pengirim`, `perihal`) memakai
    `required` dan tanda `*` merah dengan satu penjelasan di atas form; isian wajib kondisional (agenda dan waktu
    mulai hanya saat surat berstatus undangan) memakai `aria-required` + validasi server, karena `required` native
    memblokir submit sebelum `FieldError` per isian bisa muncul. Isian opsional tidak diberi label "(opsional)" —
    tidak punya tanda `*`.
12. **Galat per isian, bukan satu kalimat gabungan.** `buatSurat` mengembalikan `galat: Record<string,string>`;
    tiap field mendapat `aria-invalid` (garis destructive + ring) dan `FieldError` di bawah field. Alert
    `destructive` hanya untuk galat global (mis. akun hanya membaca).
13. **Satu kosakata untuk "terpilih": diisi warna primary.** Menu sidebar aktif (`data-active`) memakai tint
    `--sidebar-accent` (`oklch(0.97)`) di atas kanvas sidebar (`oklch(0.985)`) → ~1.06:1, jadi halaman yang sedang dibuka
    tidak terlihat. Sekarang item aktif diisi `bg-sidebar-primary` dengan teks `sidebar-primary-foreground`, sama
    seperti chip periode aktif di toolbar (`Button variant="selected"`). Item submenu (sub) memakai tint
    `bg-primary/12` + `text-primary` supaya hierarki sub tetap lebih tenang dari item utama. Hover dan pressed
    memakai `bg-foreground/8` dan `/12` (tint gelap tipis, bukan gray token).
14. **Pengaturan adalah rute bertingkat dengan submenu berikon di sidebar.** `/pengaturan` adalah
    ringkasan empat bagian; tiap bagian punya halaman sendiri (`/pengaturan/pengguna`, `/pengaturan/jenis`,
    `/pengaturan/nama/<daftar>`, `/pengaturan/jejak`). Sidebar memakai `SidebarMenuSub` untuk keempat bagian - menu
    dibuka lewat chevron `SidebarMenuAction` dan otomatis terbuka begitu salah satu bagiannya dibuka, jadi posisi aktif
    selalu terlihat tanpa membuka menu; tiap tautan sub diberi ikon (Users, FileText, ListChecks, History) supaya submenu
    tidak terlihat seperti daftar teks polos. Alamat lama `?tab=...` tetap dialihkan.
    Di desktop tidak ada pil navigasi bagian di dalam halaman: submenu sidebar sudah menjadi navigasinya, dan pil akan
    hanya mengulang navigasi yang sama. Di HP navigasi menjadi **bilah bawah melayang** seperti navigation bar Android
    (`fixed inset-x-0 bottom-0`, latar `background`, garis atas `--input`, safe area, `md:hidden`) dengan empat kolom -
    ikon di atas label pendek ("Akun", "Kategori", "Nama", "Jejak") plus jumlah tabular; bagian aktif ditandai pil lembut
    `bg-primary/12` + `text-primary` (6,55:1 di kanvas), nonaktif `text-muted-foreground` (6,55:1), tiap tautan >=44px.
    Jumlah isi tetap ikut di kedua navigasi karena skala bagian adalah informasi yang dibutuhkan sebelum membuka, dan
    angkanya `aria-hidden` supaya nama aksesibel tautan tetap persis labelnya. Di dalam halaman Daftar nama masih ada pil
    antar lima daftar (`nav[aria-label="Daftar nama"]`) karena submenu sidebar hanya menunjuk ke halaman daftar, bukan ke
    tiap daftar. Kategori surat juga dipisah dua halaman (`/pengaturan/jenis/masuk`, `/pengaturan/jenis/keluar`) dengan pil
    `nav[aria-label="Kategori surat"]` berikon Inbox/Send — dua daftar yang dipakai formulir berbeda tidak dicampur dalam satu
    kartu, dan arah tidak lagi dipilih lewat dropdown karena halaman sudah menentukan arahnya.
15. **Tabel tidak dipaksa masuk ponsel.** Daftar akun dan daftar nama punya versi menumpuk (`md:hidden`) dan tabel
    hanya `hidden md:block`; di 390px enam kolom keluar dari jendela dan tombol aksi terpotong. Kolom Jabatan/Bentuk/
    Status tidak dihapus di ponsel — badge `Nonaktif` muncul di sel nama hanya bila nama itu benar-benar nonaktif,
    supaya status tetap terbaca tanpa menambah kolom. AksiIkon menerima `teks` pendek untuk layar kecil ("Nonaktif",
    "Aktifkan", "Ubah") dan `label` penuh tetap jadi nama aksesibel serta tooltip desktop.
16. **Isian dan aksi memilih nilai yang benar, bukan default.** Panel ubah akun di-prefill dari akun terpilih dan
    menampilkan "Saat ini: peran …, status …" di atas select; default `pengguna[0]` + `Petugas Agenda` + `Aktif`
    membuat submit tanpa pilihan mengubah akun yang tidak disentuh.
17. **Jejak perubahan data berbahasa pengguna.** Kode audit (`login`, `update`, `surat_masuk`) dipetakan ke
    "masuk", "perubahan", "surat masuk" lewat `labelAksiAudit()`/`labelEntitasAudit()` di `lib/format.ts`; kode yang
    belum dipetakan ditampilkan dengan garis bawah diganti spasi, tidak diterjemahkan setengah.
18. **Daftar panjang dipaginasi, tidak digulir tanpa batas.** Surat, disposisi, dan jejak perubahan memakai 25
    baris per halaman dengan nomor halaman di URL (`?halaman=N`), sehingga tautan bisa dibagikan dan print hanya
    mencetak halaman yang aktif. Daftar nama memakai 10 baris per halaman di sisi klien karena filter pencariannya
    juga sisi klien; mengetik di pencarian mengembalikan ke halaman 1 supaya nama yang baru ditambahkan tidak
    tersembunyi di halaman terakhir. Teks paginasi Bahasa Indonesia ("Sebelumnya", "Berikutnya") dengan
    `aria-label`; kontrol diberi `data-slot="pagination-link"` agar target sentuh dan uji layout ikut mengukur.
19. **Satu state tidak ditampilkan dua kali.** Di tabel disposisi badge "Status" dan select "Tindak
    lanjut" menunjukkan hal yang sama; badge dihapus dan select (yang sudah di-tint sesuai makna status) menjadi satu-satunya
    kontrol — pilih nilai lalu simpan. Reader yang tidak boleh mengubah tetap melihat badge di daftar ponsel, dan halaman
    lain (surat, rapat) tetap memakai badge karena di sana memang tidak ada kontrol yang bisa diubah.
20. **Daftar panjang dibuka satu per satu.** Daftar nama resmi (pengirim, pemberi disposisi, tujuan diteruskan) tidak
    ditampilkan berdampingan sebagai tiga tabel panjang: satu kartu, tiga bagian yang dibuka bergantian lewat pemicu
    `aria-expanded` + `aria-controls`; judul bagian dan jumlah isinya selalu terlihat sebelum dibuka. Bagian yang dibuka
    dicatat di URL supaya bertahan setelah refresh dan bisa di-share. Saat dicetak semua bagian dibuka, karena cetak
    tidak bisa "klik".
21. **Kalender bisa diklik per tanggal.** Sel kalender adalah tautan (`/rapat?bulan=…&tanggal=…`) — di layar kecil
    tautan dilebarkan ke lebar sel (`w-full`; grid `min-w-[21rem]` = 7 × 48px, padding sel 0.125rem) supaya area
    sentuh 44×44px dan bukan 16px; tanggal yang sedang dibuka di-highlight (`ring-primary/45`), dan "hari ini" diberi latar `info-bg`.
    Isi sel tidak memakai badge status lagi (kata "Terjadwal" dobel dengan select status di halaman yang sama): sel
    menampilkan titik warna + jam + judul yang dipotong (judul penuh ada di atribut `title`), maksimal tiga lalu
    "+N agenda lain". Titik warna hanya pelengkap—jam dan judul tetap teks—dan angka tanggal diuji kontrasnya (6.55:1 terang, 7.58:1 gelap).
    Tautan "Bulan berjalan" selalu mengarah ke bulan sekarang menurut jadwal Jakarta; dulu ia memakai bulan yang
    sedang dilihat sehingga di Desember tombol itu tetap menampilkan Desember.
22. **Agenda boleh tidak punya surat.** Pengingat internal dan kegiatan bidang dibuat langsung di `/rapat`
    ("Buat agenda sendiri"), jadi `jadwal_rapat.surat_id` boleh kosong dan pembuatnya dicatat. Kontrol status hanya
    muncul untuk pemilik agenda (atau Administrator); milik orang lain tetap terlihat sebagai badge. Saat satu tanggal
    dibuka, daftar "masih akan datang" disembunyikan supaya agenda tidak muncul dua kali di satu halaman.
23. **Data yang belum diisi dinyatakan, bukan disembunyikan.** Tempat dan penyelenggara agenda adalah isian opsional;
    kalau masih kosong, kartu rapat menyatakan bagian mana yang kurang ("Tempat belum diisi dan Penyelenggara belum
    diisi.") alih-alih hanya menampilkan baris tanggal tanpa keterangan — pengguna tahu bahwa kolom itu ada dan bisa
    diisi di panel di bawahnya. Isian yang sudah tersimpan di-prefill lewat `defaultValue`, dan mengosongkannya
    menyimpan `null` (menghapus keterangan yang salah).
24. **Langkah disposisi bisa dikoreksi, bukan hanya ditambah.** Riwayat disposisi adalah catatan kerja: kalau salah
    ketik atau salah tujuan, langkahnya diubah dari halaman surat (form "Ubah disposisi" prefill nilai tersimpan,
    dibuka lewat `?disposisi=ubah&id=…` supaya refresh dan tautan tetap membuka form yang sama) atau dihapus
    (`?disposisi=hapus`). Nama di luar daftar resmi tetap bisa dipilih karena nilai lama selalu masuk sebagai opsi.
    Menghapus langkah tidak menyentuh langkah lain: status surat dihitung ulang dari langkah yang masih tersisa
    (nol langkah → "belum disposisi", semua selesai → "selesai", sisanya → "sudah didisposisikan"). Perubahan dan
    penghapusan masuk ke jejak perubahan data dengan kalimat Indonesia.
25. **Arsip bukan penghapusan, dan penghapusan punya syarat.** Surat selesai bisa diarsipkan (`status_surat = arsip`):
    tetap terbaca, tetap bisa difilter di daftar, tetap dihitung di rekap, dan bisa dikeluarkan lagi — statusnya saat
    keluar mengikuti langkah disposisi yang tersisa. Penghapusan permanen adalah tindakan berbeda dan tidak bisa
    dibatalkan, jadi ia dinyatakan lebih dulu: tombol arsipkan di-disable sambil hint menyebutkan apa yang belum selesai
    ("Belum bisa diarsipkan: 1 langkah disposisi belum selesai, 1 agenda rapat masih aktif."), dialog hapus menyebut
    anak yang harus dibersihkan (lampiran, langkah disposisi, agenda rapat beserta pesertanya), dan server menolak ulang
    kalau daftar itu masih terisi. Nomor agenda tidak ikut berubah saat identitas surat dikoreksi, karena nomor itu
    penanda yang sudah dipakai di laporan.
26. **Surat yang diarsipkan tertutup.** Arsip berarti "selesai dan tidak diubah lagi", jadi saat surat berstatus `arsip`
    tidak ada satu pun isian yang bisa diubah: form lampiran, disposisi, tempat/penyelenggara, status undangan, dan status
    agenda tidak dirender, dan server menolak kalau tetap dikirim ("Surat ini sudah diarsipkan. Keluarkan dari arsip dulu
    sebelum mengubah isinya."). Yang tetap ada hanya dua keputusan di kartu pengelolaan — Keluarkan dari arsip dan Hapus
    surat — supaya arsip tidak pernah jadi keadaan setengah terbuka. Karena tidak ada kontrol yang bisa diubah, status
    ditampilkan sebagai badge (bukan dropdown), termasuk di agenda surat arsip pada kalender.
27. **Agenda dari surat dihapus dari detail suratnya, bukan dari kalender.** Kalender hanya menghapus agenda tanpa surat;
    agenda yang bersumber dari surat dibersihkan di kartu "Rapat terkait surat ini" karena itu tempatnya dibuat dan
    disunting. Konfirmasi menyebut jumlah peserta yang ikut terhapus (peserta dan riwayat jadwal ikut hilang via
    `ON DELETE CASCADE`) dan menyatakan tindakan tidak bisa dibatalkan. Surat yang sedang diarsipkan tidak menawarkan
    tombol ini. Menghapus agenda tidak mengubah `status_undangan_rapat` surat: surat itu tetap mengundang rapat, hanya
    catatan agenda yang salah dibersihkan.
28. **Layar sentuh: kartu lebih tipis dan tombol boleh turun baris.** Di `max-width: 768px` spacing kartu diturunkan ke
    0.75rem dan tombol memakai `max-width: 100%` dengan `white-space: normal` — agenda panjang (mis. "Rapat Koordinasi
    Penghapusan Barang Milik ...") tidak boleh lebih lebar dari layar. Lebar minimum dropdown (`lebarOpsiMin`,
    kelonggaran 8 karakter) ditahan sampai `100%` lewat CSS `min()`: dulu select "Diteruskan ke" melebar 389px dan
    menembus tepi kartu disposisi di 375px. Konsekuensinya di HP nama pejabat yang sangat panjang bisa terpotong di
    popup (popup bawaan browser selebar select-nya), sementara di desktop nama penuh tetap muat — uji layout hanya
    mengukur popup di layar di atas 768px.
29. **Pasangan "status rapat + jadwalkan ulang" menumpuk sampai 1024px.** Di 768px dengan sidebar terbuka, lebar kartu
    424px dan kolom kiri 175px — dua kolom di dalamnya menyisakan input datetime 22px dan saling tumpang tindih. Karena
    itu pembatasnya `lg:grid-cols-2`, bukan `md:grid-cols-2`.
30. **Aksi utama di HP adalah tombol melayang, bukan tombol di header.** Header di bawah 768px hanya berisi tombol
    sidebar + judul halaman; "Tambah Surat" (`components/fab-tambah-surat.tsx`) menjadi pil `rounded-full` fill primary
    di pojok kanan bawah — selalu dalam jangkauan jempol, di atas maupun di bawah halaman — dengan shadow ber-offset
    supaya lepas dari kanvas, dan ruang konten diberi `pb-[5.5rem]` agar ia tidak menutupi kontrol terakhir. Empty-state
    dashboard tidak lagi menampilkan CTA kedua di HP.
31. **Aksi laporan terletak di kartu periode, bukan di header.** Di `/rekap`, "Ekspor Excel" dan "Cetak atau simpan
    PDF" berada di dalam kartu "Periode tahun" setelah garis pemisah — aksinya bergantung pada tahun yang dipilih, jadi
    letaknya harus bersama periode itu. Di HP keduanya pil icon 44×44 (`FileSpreadsheetIcon`, `PrinterIcon`) dengan
    `rounded-full`: icon di kotak 44px ber-radius tema 18px terlihat seperti persegi membulat yang aneh, sedangkan pil
    bulat terbaca sebagai pilihan yang disengaja. Di desktop teks penuh dengan radius tema, dan `aria-label` tetap sama
    dengan teksnya — icon tidak menggantikan nama aksi bagi pengguna desktop.
32. **Baris agenda punya toolbar yang disengaja, bukan hasil wrap.** Di kartu "Agenda pada <tanggal>" dan
    "Agenda yang masih akan datang", judul tidak boleh terjepit oleh tombol header: header memakai `flex flex-col`
    di HP (judul satu baris `text-balance`, pil "Kalender <bulan>" turun ke bawah deskripsi, berikon kalender) dan
    `md:flex-row` di desktop. Kontrol agenda di dalam baris adalah toolbar: **di HP dua baris** — baris pertama
    selektor status `w-full` (`rounded-full`) plus tombol "Simpan status" kotak ikon 44px di kanannya, baris kedua
    aksi sekunder sebagai kotak ikon 44px (`Sembunyikan/Tampilkan di layar`, `Hapus`) dan pil berteks pendek "Ubah";
    **di desktop satu baris rata kanan** — selektor `md:w-[12rem]` (radius tema), "Simpan status" berteks penuh,
    garis pemisah tipis `h-6 w-px bg-border`, lalu ikon monitor/ubah/hapus 32px. Pemisah itu membedakan aksi yang
    mengubah jadwal dari aksi yang hanya mengatur tampilan layar. Ikon monitor mengikuti aksi tombol (mata silang
    saat menyembunyikan, monitor saat menampilkan), bukan keadaan agenda. `Hapus` memakai `variant="destructive"`
    supaya aksi merusak bedanya terlihat tanpa teks.
38. **Pembuat agenda otomatis ikut sebagai peserta, dan bisa menyebut orang lain.** Agenda tanpa surat dibuat oleh
    seseorang yang biasanya hadir sendiri di rapatnya, dan pembuatnya boleh menyertakan pejabat lain sejak form pertama —
    bukan setelah agenda jadi. Isian "Pejabat/pegawai yang ikut" (`components/peserta-pilih.tsx`, dipakai dialog buat
    dan dialog ubah lewat prop `daftarPegawai`/`namaSendiri`) memakai combobox pegawai yang sama dengan peserta surat:
    nama terpilih jadi chip dan tiap chip satu isian `nama_peserta`. `buatAgendaMandiri` menulis pembuatnya
    (`user.name`) sebagai peserta pertama lalu nama yang dipilih, dengan instansi "BPKAD - Bidang Aset" ditulis sendiri;
    `ubahAgendaMandiri` **hanya menambah** peserta — yang sudah tercatat tidak hilang karena tidak dipilih ulang, dan
    penghapusan tetap lewat panel "Peserta agenda ini" di barisnya. Dialog menyebutnya di bawah isian ("Kamu (…) otomatis
    tercatat sebagai peserta") supaya pembuat tahu isian boleh kosong. API Android menerima `peserta` (daftar nama, maks
    25) dengan aturan daftar pegawai yang sama dan menulis pembuatnya otomatis (`app/api/agenda/route.ts`). Dropdown
    combobox dipatok ke wadah pil (`useComboboxAnchor()` + `anchor` di `ComboboxContent`) supaya daftar pilihan tidak
    menutupi keterangan di bawah isian saat dialog terbuka.
33. **Formulir panjang tidak menempel di bawah kalender.** "Buat agenda sendiri" adalah enam isian dan bukan isi utama
    `/rapat`, jadi ia dibuka lewat tombol dan isinya masuk dialog (`components/agenda-mandiri-dialog.tsx` +
    `components/ui/dialog.tsx`). Di HP dialognya **sheet bawah** (`inset-x-0 bottom-0`, `max-h-[86vh]`, radius atas saja,
    padding `env(safe-area-inset-bottom)`) — satu tangan, isian yang menggulir, tombol simpan selalu terjangkau; di
    desktop modal di tengah `max-w-[34rem]` dengan dua kolom. Tombolnya dua: di desktop di header halaman sejajar
    "Tambah Surat" (`size="sm"`), di HP pil melayang `rounded-full` 44px seperti FAB surat. Peran pembaca tetap
    mendapat tombol ini — membuat pengingat milik sendiri bukan aksi Administrator.
34. **Navigasi bulan sejajar judul kalender di desktop.** Di `/rapat` pill bulan tidak lagi mengambang di dalam
    `CardContent`; header kartu memakai `md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center` sehingga pill berada
    di baris yang sama dengan "Kalender <bulan>" (kolom kanan, rata kanan), sementara judul dan keterangan tetap satu
    baris penuh di bawahnya. Di HP urutan tetap judul → keterangan → pill selebar kartu (`w-full`, `md:w-auto`).
35. **Hasil perubahan disampaikan di tempat, bukan lewat URL.** Aksi yang nilainya berubah di halaman yang sama
    (status rapat, status tindak lanjut, koreksi disposisi/identitas, lampiran, peserta, arsip/pulih, toggle
    Pengaturan, hapus baris) mengembalikan `Hasil` (`lib/hasil.ts`) dan hasilnya jadi **toast** Radix
    (`components/ui/toast.tsx` + `components/ui/toaster.tsx`) di bawah header, lalu payload di-refresh dengan
    (`router.refresh()` — tidak ada reload, scroll tidak hilang, dan URL tetap pada filter/bagian yang sedang dipakai).
    Sejak pembaruan realtime (Tier 2) penyegar itu tidak lagi ditekan sendiri oleh aksi: perubahan data datang dari
    database lewat `/api/pembaruan` dan hanya halaman yang memakai tabel itu yang menyegar (`lib/pemberitahuan-rute.ts`);
    `gunakanPenyegar()` (`lib/pemberitahuan-client.ts`) tetap menyegar sebagai cadangan bila jalur pembaruan terputus.
    Yang tetap `redirect()` hanya aksi yang benar-benar meninggalkan halaman: surat masuk baru (ke detailnya), agenda
    mandiri (ke tanggalnya), hapus surat permanen (ke daftar surat), dan penjagaan sesi ke `/login`. Penolakan (validasi,
    surat terarsipkan) tampil sebagai toast galat dan **tampilan tidak berubah**: nilai optimistis dikembalikan, jadi
    pengguna tidak melihat perubahan yang tidak terjadi. Galat validasi form yang memakai `useActionState` (disposisi,
    koreksi identitas, sandi) tetap `Alert` di dalam panelnya — panel itu sendiri tempat orang sedang mengetik. Kontrol
    yang sedang mengirim diblokir lewat `data-mengirim` (`pointer-events: none` + opacity). Panel inline (ubah akun)
    ditutup lewat `padaSukses` di `AksiForm`.

36. **Mode gelap bukan mode terang yang dibalik.** Kanvas gelap memakai hue hangat (42), bukan abu kebiruan; teks
    bukan putih murni (0.95). fill primary dibalik sesuai konvensi shadcn di gelap: `--primary` karat terang
    (`0.72 0.17 46`) sebagai latar dengan teks cokelat (`0.24 0.06 44`) di atasnya. Badge dan select status memakai
    ramp status sendiri (teks terang di tint gelap), `--info` di-desaturasi (chroma 0.05) supaya penanda "hari ini"
    tidak bertabrakan dengan kanvas hangat. Toggle mode (`components/theme-toggle.tsx`, `next-themes`, `aset-theme`)
    ada di header semua halaman: satu glypher Tabler "sun" (matahari dan bulan dalam satu gambar) yang diputar 180°
    di mode lewat CSS (`dark:rotate-180` + `motion-safe:transition-transform`), bukan dua ikon yang saling sembunyi dan
    bukan nilai theme saat render, sehingga tidak ada mismatch hidrasi dan arah sinar berubah saat mode berganti.
    Cetak selalu mode terang (`@media print` mengembalikan kanvas ke putih) — monitor dan kertas tidak
    perlu seragam. Uji kontras menjalankan kedua mode pada setiap kasus.

37. **Nama peserta rapat dipilih dari daftar pegawai, bukan diketik dari ingat-ingat.** Isian peserta di bagian Rapat
    adalah isian yang menyaring daftar pegawai Bidang Aset (`master_pegawai`): mengetik tiga huruf sudah menyaring nama,
    nama yang cocok tersorot otomatis, **Tab** (atau Enter) menjadikan nama itu chip lalu isian langsung kosong untuk nama
    berikutnya — satu keyboard, tidak perlu mouse. Nama di luar daftar **tidak** dijadikan peserta: isian menahan nama
    yang diketik, pesan "Nama "…" belum ada di daftar pegawai bidang aset" muncul di bawah isian (di luar `FieldDescription`
    yang `aria-hidden`, supaya tautannya terbaca pembaca layar), dan tautan di pesan itu membuka
    Pengaturan › Daftar nama › "Pegawai bidang aset" lewat `/pengaturan/nama/pegawai?nama=<nama>` sehingga form
    "Pegawai baru" sudah terisi nama itu (dibaca dari query di `app/pengaturan/page.tsx`, diteruskan sebagai `namaAwal`).
    `tambahPeserta` juga menolak nama yang tidak ada di daftar pegawai aktif, jadi nama bebas tidak bisa masuk lewat
    jalur lain; nama yang masih diketik waktu tombol disimpan diklik ikut tersimpan hanya kalau ada di daftar, sedangkan
    yang di-Backspace sampai kosong tidak ikut. Chip punya tombol X (24px desktop, 44px HP) dan tiap chip jadi satu isian
    `nama_peserta` yang dikirim, jadi satu aksi bisa menambah banyak peserta (batas 25 per agenda, nama rangkap dengan yang
    sudah tercatat ditolak dengan pesan yang menyebut namanya). Instansi/bidang tidak lagi ditanyakan di formulir peserta —
    peserta rapat agenda ini selalu orang Bidang Aset, nilai "BPKAD - Bidang Aset" ditulis oleh aksi
    (`lib/actions/peserta.ts`), dan daftar pegawai dikelola di Pengaturan › Daftar nama › "Pegawai bidang aset"
    (`components/ui/combobox.tsx`, `components/ui/input-group.tsx`).

Diverifikasi `scripts/contrast.mjs` (warna dibaca dari browser yang sudah menyelesaikan `oklch`/`color-mix`, setiap
kasus diuji di **dua mode** dengan berpindah mode lewat toggle di header):
288 pemeriksaan (144 kasus × mode terang dan gelap) menjadi 328 (164 kasus; dua kasus lain di-SKIP kalau data contoh tidak tersedia saat itu), 0 gagal (rentang 3.43:1 – 21.00:1). Kasus mencakup teks judul dan
keterangan tabel, badge empat nada termasuk badge status surat keluar di daftar dan di detail, select status yang ditint, tombol primary (fill karat dengan teks krem di terang,
fill karat terang dengan teks cokelat di gelap), batas outline/input/select, placeholder, navigasi bagian Pengaturan
terpilih dan nonaktif, kombinasi hover, menu sidebar dan label grup, angka grafik batang dan slice donut, galat isian
form, angka hari ini dan tanggal kalender yang bisa diklik, halangan arsip dan tombol arsipkan yang di-disable, catatan
agenda terkunci, keterangan penguncian dan tombol yang di-disable pada surat keluar, dialog agenda mandiri di latar `popover`, teks + ikon chip toast di latar toastnya sendiri (sukses
dan galat, dua mode), dan isian nama peserta rapat: placeholder isian (6.10:1 / 8.26:1), garis grup isian (5.91:1 / 7.28:
1), teks chip nama (18.11:1 / 14.28:1), ikon hapus pada chip (6.00:1 / 7.16:1), nama pegawai di daftar pilihan dan yang
tersorot (16.01:1 / 12.67:1), keterangan "tidak ada nama yang cocok" (6.55:1 / 7.24:1). Chip memakai `bg-muted` dan ikon
`text-muted-foreground` — dengan `bg-input` dan `opacity-50` hanya 3.20:1 dan 2.40:1. Batas (`border-color`) diukur terhadap latar di luar elemen, bukan terhadap latar elemen sendiri —
tombol solid punya border warna sama dengan latarnya.

## 3. Tipografi

- Satu keluarga: Inter variable (`--font-sans`). 400 body, 500 label/nav/tombol, 600 judul.
- `CardTitle` = `text-base font-semibold` (16px/600) untuk judul section; judul halaman di header 16px/500.
- Label field 12px/500; keterangan `text-sm text-muted-foreground`.
- **Metrik** memakai tiga tuil sekaligus, bukan ukuran saja: label `12px/500 muted-foreground`,
  angka `30px/600 tabular-nums tracking-tight` (focal), delta `12px/500` di chip tint 10%.
- Angka agenda/nomor/tanggal/metrik memakai utility `num` (`tabular-nums`).
- Letter-spacing normal; `tracking-tight` hanya pada angka besar dan judul login. Tidak ada uppercase tracking lebar.

### Bahasa teks layar

Teks yang dibaca petugas memakai bahasa petugas, bukan bahasa developer. Nama komponen, kolom database, dan mekanisme
Tidak boleh masuk ke layar.

| Jangan muncul di layar | Pakai |
|---|---|
| modal, dialog, form, field, input, select, dropdown | formulir, isian, daftar pilihan |
| server, database, session, cache, refresh/reload, payload | "data", "login ini", "sebelum berkas disimpan" |
| `mime_type`, `folder uploads`, file | "PDF / JPG / PNG", "penyimpanan aplikasi", "berkas" |
| entitas, tabel audit, publikasi/publish | "jenis catatan", "catatan perubahan", "ditampilkan di layar monitor" |
| halaman detail, URL, tautan langsung | "halaman suratnya", "alamat" |

- "Jenis surat" dinamai **kategori surat** di layar (label, judul, kolom tabel, penyaring, galat, toast, jejak audit, ekspor Excel);
  tabel dan kolom basis data tetap `surat_jenis`/`jenis_surat`, alamat tetap `/pengaturan/jenis[/masuk|/keluar]`, id DOM dan
  flag URL tetap memakai `jenis`. "Jenis catatan" (jejak perubahan) dan "jenis berkas" (lampiran) bukan kategori surat dan tetap begitu.
- Kode MIME tidak ditampilkan; dibaca jadi jenis berkas lewat `jenisBerkas()` di `lib/format.ts` (PDF / JPG / PNG).
- Galat menjelaskan apa yang harus dilakukan, bukan mekanisme: "Pilih berkas dulu sebelum menyimpan.",
  "Waktu mulai tidak dikenali. Gunakan tanggal dan jam yang benar.", "Format email belum benar."
- Sukses menyebut akibatnya: "Lampiran dihapus dari daftar surat, berkasnya ikut terhapus.",
  "Agenda ditampilkan di layar monitor."
- Kalau server menolak (trigger/pemicu di database), pesan tetap manusiawi: "perubahan tidak bisa disimpan" sebagai
  fallback, bukan teks constraint database.
- Yang dipertahankan karena memang istilah kerja atau nama produk: arsip, draf, disposisi, agenda, lampiran, PDF, Excel,
  TV, browser, filter (kata umum), dan nama peran Petugas/Pengelola/Administrator.
- Ejaan seragam: kata untuk " diteruskan" selalu dengan huruf k. Bentuk tanpa k pernah muncul di toast daftar nama
  dan keterangan paginasi mini daftar nama — sudah disamakan dengan sisanya (`diteruskan` dipakai di form disposisi,
  pesan penerusan, dan daftar tujuan).
- Uji menyebut teks ini (`cekToast` di `scripts/click-through.mts`, nama tombol di `scripts/monitor-check.mts`), jadi
  ganti teks = ganti uji.

## 4. Radius, spacing, bayangan, motion

- Radius dari `--radius: 0.625rem`; kartu 24px efektif (`min(var(--radius-4xl),24px)`), tombol 4–6px.
  Radius bersarang dihindari: `radius luar = radius dalam + padding` (panel inset 8px di dalam kartu 24px).
  Preset `bJMTbSfw` membawa `--radius: 0` (semua tajam); rancangan rujukan dan sistem ini memakai kartu dan tombol
  membulat, jadi 0.625rem dipertahankan dan 0 tidak dipakai.
- Spacing Tailwind; kartu `--card-spacing: 20px` (sm 16px), dalam card `gap-3`, toolbar `gap-2/3 flex-wrap`,
  antar bagian halaman `gap-4` (md `gap-6`).
- Bayangan: hanya shadow komponen shadcn (`shadow-sm` + `ring-1 ring-foreground/5`); panel inset tanpa bayangan.
  Tidak ada glow atau blur dekoratif. Satu strategi depth: ring halus + shadow tipis.
- **Kombinasi state harus tetap terbaca.** Latar terpilih diisi primary, maka hover di atasnya tidak boleh
  mengubah teks jadi gelap: tab memakai `data-active:hover:text-primary-foreground` + `bg-primary/90`, menu
  sidebar memakai `data-active:hover:bg-sidebar-primary` + `text-sidebar-primary-foreground`. Hover pada kontrol
  yang tidak terpilih memakai `bg-foreground/8`. Diuji lewat kasus "saat hover" di `scripts/contrast.mjs`.
- Motion hanya feedback: `transition-[color,box-shadow] duration-200` (focus/hover), baris daftar
  `transition-colors`, accordion/alert-dialog/sidebar 200ms. Tidak ada animasi masuk dekoratif.
  `prefers-reduced-motion` menghapus transisi dan animasi.

## 5. Target sentuh & layar sempit

- ≤768px: semua kontrol (tombol, input, select, textarea, switch, checkbox, tab, pagination, menu sidebar,
  item dropdown) ≥44px lewat media query di `globals.css`.
- Desktop: kontrol utama ≥28px; kontrol padat (tab, pagination, menu sidebar) ≥24px.
- Tabel digulir horizontal dalam wrapper `overflow-x-auto` (tidak dipotong di 375px). Kalender tidak digulir di HP:
  tujuh kolom muat di dalam kartu (`min-w-[21rem]`, `lg:min-w-[40rem]`); hanya di layar di bawah 375px kalender boleh
  digulung. Toolbar filter memakai `flex-wrap`; header halaman `flex-wrap` sehingga badge + aksi tidak tumpang.
  Ruang konten `Shell` memakai `pb-[5.5rem]` di layar kecil supaya tombol melayang dan bilah bawah navigasi Pengaturan
  tidak menutupi kontrol terakhir.
- Sidebar mobile memakai `Sheet` (drawer) bawaan shadcn.
- Aksi inline di ruang sempit memakai `AksiIkon` (`components/aksi-ikon.tsx`): desktop 32px ikon saja + tooltip, layar kecil 44px ikon + teks. Ikon dikirim sebagai `children` karena komponen React tidak bisa jadi prop dari Server Component ke Client Component. `InputIkon` (`components/input-ikon.tsx`) memasang ikon hiasan di kiri isian (email, kata sandi, pencarian, kategori surat) dengan `aria-hidden`.

## 6. Komponen yang dipakai

| Komponen | Peran di aplikasi |
|---|---|
| `Sidebar` + `SidebarMenuSub` | shell kiri; menu dikelompokkan sesuai alur kerja: **Ringkasan** (Dashboard), **Surat & disposisi** (Surat Masuk, Surat Keluar, Disposisi), **Rapat & laporan** (Jadwal Rapat, Rekap dan Laporan), **Akun & pengaturan** (Pengaturan khusus admin, Akun saya); collapse ke icon rail, footer akun + Keluar |
| Dropdown footer akun | dibuka `side="top" align="start"` (4px dari pemicu, rata kiri) bukan `side="right" align="end"` yang menggantung ke atas konten; isi = email saja (nama + peran sudah ada di pemicu), satu separator, "Akun saya" bericon, "Keluar" `text-destructive` |
| `Card` | kontainer daftar, form, metrik. `variant="inset"` = panel isian berlatar kanvas |
| `Button` | aksi primer (`default`), aksi sekunder (`outline`), konfirmasi hapus (`ghost` + `text-destructive`), **pilihan aktif toolbar periode (`selected` = `bg-primary` + teks putih)** |
| Item menu sidebar aktif | `data-active` → `bg-sidebar-primary` + `sidebar-primary-foreground`; submenu → `bg-primary/12` + `text-primary`; hover/pressed → `bg-foreground/8` / `/12` |
| `MetricCard` (`components/metric-card.tsx`) | angka metrik + chip selisih periode; dipakai Dashboard (6 kartu) dan Rekap (6 kartu). `data-slot="metric-label"` / `metric-nilai` dipakai uji kontras |
| `deltaSekarang()` | selisih dengan periode sebelumnya; **nada** (baik/buruk/netral) ditentukan pemanggil, bukan oleh arah angka: surat masuk naik = netral, disposisi belum selesai naik = buruk |
| `Table` + wrapper `overflow-x-auto` | daftar surat, disposisi, rapat, akun, kategori surat, audit, jadwal ulang |
| `Badge` (sukses/warning/info/destructive/secondary) | status surat, disposisi, rapat, akun, kategori |
| `Field` + `Input` + `Textarea` + `NativeSelect` | form surat, disposisi, akun, sandi, filter; `lebarOpsiMin()` menentukan lebar minimum select; select status rapat dan tindak lanjut memakai tint status lewat `selectClassName` (prop baru di `NativeSelect`, kelas statis dari `tint()` di `lib/status.ts`) supaya tint mengikuti radius select, bukan jadi kotak di wrapper; opsi status rapat dibatasi `opsiStatusRapat()` — terjadwal hanya kalau waktunya belum tiba, lalu sudah dilaksanakan, dijadwalkan ulang, dibatalkan; "berlangsung" tidak dipilih karena diberikan sistem lewat waktu |
| `FieldSet` + `FieldLegend` + `FieldError` | grup radio "Kaitan surat dengan rapat" dan grup kondisional "Data rapat"; galat server per isian (`state.galat`) ditampilkan di bawah field dengan `aria-invalid` |
| Radio baris penuh (label membungkus input) | satu tap di teks juga memilih opsi, bukan hanya lingkaran 16px; `globals.css` memberi baris ≥44px di mobile dan `layout-check` mengukur `main label:has([data-slot='radio'])`. Radio di-sync setiap render karena browser men-reset state radio saat form di-submit |
| `form-actions` sticky (`data-slot="form-actions"`) | baris aksi di dasar jendela untuk form panjang (`SuratForm`): Simpan + Batal + catatan unggah dokumen; `layout-check` mengecualikan elemen di dalamnya dari uji tumpang tindih |
| `DotPattern` (`components/ui/dot-pattern.tsx`) | latar bertitik SVG (`aria-hidden`, `pointer-events-none`, `absolute inset-0`) untuk layar monitor: titik `fill-foreground/16` pada jarak 22px dengan `mask-image` radial yang mentransparansikan tengah, jadi tekstur hanya muncul di tepi layar dan jam besar serta angka statistik tetap bersih; warnanya token tema, bukan warna keras slate, sehingga ikut mode terang dan gelap |
| `HapusKonfirmasi` (`components/hapus-konfirmasi.tsx`) | satu konfirmasi hapus untuk daftar lampiran, daftar peserta, agenda rapat, dan hapus surat permanen; trigger `ghost` berwarna destructive (tint saat hover), bukan tombol merah solid per baris. Baris yang dihapus hilang seketika (`hapusLokal`) dan kembali bila server menolak (`galatLokal`); dialog hanya ditutup kalau penghapusan benar-benar terjadi |
| `AksiForm` / `gunakanAksi` (`components/aksi-form.tsx`) | menjalankan aksi `Hasil` tanpa berpindah: toast lalu `gunakanPenyegar()` (menyegar hanya kalau jalur pembaruan terputus — perubahan sebenarnya datang lewat `/api/pembaruan`); `data-mengirim` mengunci kontrol selama submit. Semua form perubahan di `/surat/[id]`, `/disposisi`, `Pengaturan`, lampiran, dan peserta memakai ini |
| `BarisAgenda` (`components/baris-agenda.tsx`) | baris agenda di kalender sebagai komponen client: select status diwarnai optimistis, baris agenda milik sendiri hilang saat tombol Hapus ditekan dan kembali bila server menolak; `useEffect` pada prop menyelaraskan nilai lokal dengan payload baru supaya perubahan dari akun lain, aplikasi Android, atau layar monitor ikut tampil di halaman yang sudah terbuka. Kontrolnya satu kesatuan: `StatusPilih` mengembalikan `SelectTrigger` langsung (spinner di dalam trigger) supaya ButtonGroup menyambung tepi pil dan tombol ikon; garisnya `border-input` di kedua mode, pil status di mode terang `bg-muted` + garis `--input` |
| `StatusTindakSelect` (`components/status-tindak-select.tsx`) | pengubah status tindak lanjut di daftar `/disposisi`, di kartu HP dan tabel desktop; filter (status & pencarian) dikirim lewat hidden input supaya refresh tetap pada filter yang sama |
| `Toaster` (`components/ui/toaster.tsx` + `components/ui/toast.tsx`, dipasang di `app/layout.tsx`) | umpan balik hasil aksi di bawah header: chip nada berwarna (sukses/galat/info), judul, keterangan opsional, tombol tutup, geser untuk menutup; maksimal tiga toast sekaligus. Teks dan ikon chipnya diukur uji kontras di dua mode |
| `ThemeToggle` (`components/theme-toggle.tsx`) | switch mode terang/gelap di header semua halaman (`next-themes`, `attribute="class"`, `storageKey="aset-theme"`, `defaultTheme="dark"`); satu glypher Tabler "sun" inline 18px (`Button variant="ghost" size="icon"`, 32px desktop, 44px di layar sentuh) yang diputar 180° di mode gelap lewat CSS agar tidak ada mismatch hidrasi |
| `Calendar` (rapat) | kalender bulan; **sel hari ini** diberi tint `--info-bg` + ring inset dan angka `text-info` + teks "hari ini" |
| `nav` tautan (`data-slot='nav-tab'`) | navigasi bagian Pengaturan **hanya di HP** sebagai bilah bawah melayang (`md:hidden`) - di desktop navigasi ini adalah submenu berikon di sidebar, bukan pil di dalam halaman; bagian aktif dari rute `/pengaturan/<bagian>`. Pil kedua `nav[aria-label='Daftar nama']` berpindah di antara lima daftar nama di semua lebar dan bisa digeser horizontal di layar kecil. Tautan aktif = `bg-primary` + teks terang (pil daftar nama) / `bg-primary/12` + `text-primary` (bilah bawah), nonaktif `text-foreground/75` atau `text-muted-foreground`; tiap label diikuti jumlah isi (`num`, `aria-hidden`) |
| `Pagination` | halaman daftar surat masuk, surat keluar, & disposisi |
| `ChartContainer` (recharts) | batang surat masuk dan batang surat keluar per bulan — dua grafik terpisah, bukan dua seri dalam satu grafik; seri punya token sendiri (`--chart-masuk`, `--chart-keluar`) di kedua mode, `YAxis allowDecimals={false}` karena hitungan surat/rapat bilangan bulat |
| `StatPieChart` (SVG manual) | donut komposisi kategori surat di Rekap; 6 jenis terbanyak + "Lainnya", total di tengah, legend nama/jumlah/persentase |
| `AlertDialog` | konfirmasi hapus lampiran dan peserta lewat `HapusKonfirmasi` |
| `Alert` | umpan balik yang masih datang bersama perpindahan halaman: surat masuk baru (`?ok=1`), agenda rapat dari surat (`?rapat=buat`), galat load data; juga galat inline form disposisi/koreksi identitas/sandi yang tetap di dalam panelnya |
| `Empty` | daftar kosong / filter tidak match |
| `Skeleton` (`components/loading-states.tsx`) | kerangka tiap rute, bentuknya mengikuti layout halaman; kerangka metrik mengikuti `MetricCard` (label, angka 32px, chip) |
| `Switch`, `Avatar`, `Tooltip`, `Separator` | toggle kategori surat, identitas sidebar footer, hint icon rail |
| `CetakButton` | perintah Cetak di browser untuk menyimpan PDF rekap |
| `PesertaForm` + `PesertaItem` | daftar peserta per agenda rapat; form berada di panel inset di dalam kartu rapat |
| `TombolKembali` (`components/tombol-kembali.tsx`) | tombol kembali di header detail surat masuk dan surat keluar: ikon saja tanpa bingkai 44×44 di layar kecil, tombol berbingkai berteks penuh di ≥1024px |
| `FabTambahSurat` + `LampiranForm` | keduanya menerima tujuan/aksi sebagai prop: FAB dipakai `/surat` (`/surat/baru`) dan `/keluar` (`/keluar/baru`), LampiranForm dipakai surat masuk (`unggahLampiran`) dan surat keluar (`unggahLampiranKeluar`) |
| `DialogRute` (`components/dialog-rute.tsx`) + rute intersep `app/@modal/(.)surat/baru`, `app/@modal/(.)keluar/baru` | "tambah surat" sebagai modal di atas daftar lewat *intercepting route*: alamat `/surat/baru` dan `/keluar/baru` tetap halaman penuh kalau dibuka langsung atau disalin; dialog ditutup dengan `router.back()` (tombol tutup, Escape, Batal) dan dilepas begitu alamat pindah ke halaman detail surat |

> **Catatan `FieldGroup`:** defaultnya `flex-col`, jadi isian sebaris harus ditulis
> `flex flex-row flex-wrap items-end gap-*` secara eksplisit. Lebar minimum select ditulis di elemen `Field`
> (`style={{ minWidth: lebarOpsiMin(...) }}`), bukan di `select`, supaya select tidak keluar dari kotaknya dan
> menumpuk dengan select sebelah.

> **Isian nama memakai dropdown daftar resmi.** Pengirim surat (`master_pengirim`), pemberi disposisi
> (`master_pejabat`), dan tujuan penerusan (`master_terusan`) dipilih dari daftar yang dikelola di Pengaturan →
> tab Daftar nama; setiap dropdown punya opsi "Lainnya (ketik manual)" yang memunculkan isian teks, karena lembar
> agenda lama punya lebih dari seribu nama pengirim. Nama yang dipilih tetap disimpan sebagai teks di baris surat /
> disposisi, sehingga histori tidak berubah jika daftar diubah.

> **Langkah "diteruskan"** adalah pemegang terakhir sesudah disposisi berantai: form disposisi menyebut isian ini
> "Diteruskan ke" dan "Tanggal diteruskan"; tujuan boleh kosong (surat masih menunggu disposisi berikutnya) dan
> tanggal penerusan tidak boleh mendahului tanggal disposisi.

> **Tujuan surat keluar** (`master_penerima`) juga dropdown daftar resmi dengan opsi "Lainnya (ketik manual)",
> dikelola di Pengaturan → Daftar nama → bagian "Tujuan surat keluar". Klasifikasi surat masuk dan surat keluar
> dipisah lewat kolom `jenis_surat.arah`: form surat masuk hanya menampilkan arah `masuk`, form surat keluar hanya `keluar`.

> **Seri grafik surat punya token sendiri.** Rekap menampilkan "Surat masuk per bulan" dan "Surat keluar per bulan"
> sebagai dua grafik berdiri sendiri, masing-masing dengan sumbunya (`--chart-masuk` cokelat hangat, `--chart-keluar`
> karat kemerahan), bukan dua seri dalam satu grafik — surat keluar tidak boleh tenggelam di sebelah surat masuk.
> `--chart-6` tidak pernah didefinisikan di palet, jadi sebelum token ini batang surat keluar jatuh ke hitam dan hanya
> 1,20:1 terhadap kartu gelap; sekarang 6,91:1 terang dan 7,23:1 gelap (diukur `test:kontras`).

> **Modal "tambah surat" memakai intercepting route, bukan dialog biasa.** Klik "Tambah Surat" / "Tambah Surat
> Keluar" di daftar membuka rute intersep `app/@modal/(.)surat/baru` dan `app/@modal/(.)keluar/baru` yang hanya
> memanggil form komponen yang sama — jadi tidak ada dua salinan form. Dialog ditutup dengan `router.back()`;
> `router.push()` di dalam rute intersep tidak berpindah (dokumentasi Next), jadi semua penutup memakai mundur.
> Di HP dialognya sheet bawah menempel dasar (`translate-y-0`, radius hanya atas, tinggi 92vh dengan isi yang
> digulung dan baris aksi yang tetap di dasar), di desktop dialog dua kolom. `max-w-[46rem]` harus ditulis pada
> `sm:` juga karena `DialogContent` bawaan menetapkan `sm:max-w-[34rem]` — 34rem terlalu sempit sehingga popup
> select (opsi terpanjang ±231px) tidak muat di isian dua kolom. `DialogRute` menerima `rute` dan mengembalikan
> `null` ketika alamat sudah pindah: kalau tidak, latar dialog tetap menutupi halaman detail dan seluruh tombolnya
> tidak bisa diklik. Baris aksi di dasar dialog **menempel sampai tepi bawah**: `DialogContent` diberi `pb-0` (padding
> bawah menahan `sticky bottom-0` sehingga ada sisa kosong di bawah bar) dan ruang safe-area HP berada di dalam bar,
> dengan latar solid (`bg-popover` / `bg-background`) — latar tembus `/85 + backdrop-blur` membuat teks keterangan di
> dasar bar terbaca seperti ada lubang di bawah dialog.

## 7. Layout halaman

- Shell: sidebar kiri (marca + nama instansi), header dengan trigger + judul halaman + aksi primer kanan
  (wrapping), konten dalam `SidebarInset` dengan latar kanvas dan padding responsif.
- **Dashboard:** enam kartu metrik (masuk, keluar, keluar terkirim, undangan rapat, agenda, penyelesaian disposisi) dengan selisih periode (pembanding = window yang sama digeser mundur satu
  periode dan dipotong sampai tanggal/jam yang sama, supaya tidak membandingkan sebagian dengan penuh), grafik
  batang dua seri, daftar "surat masuk terbaru", daftar "surat keluar terbaru", daftar "rapat terdekat".
- **Daftar:** toolbar filter dalam card (tab periode, pencarian, select, tombol), lalu tabel padat, pagination di footer card.
  Surat dan disposisi 25 baris per halaman dengan nomor halaman di URL (`/surat?halaman=N`, `/disposisi?halaman=N`);
  filter pencarian dan status ikut terbawa ke halaman berikutnya.
- **Tambah surat (`/surat/baru`):** dibuka sebagai modal di atas daftar ketika dipicu dari daftar, dan sebagai
  halaman penuh ketika alamatnya dibuka langsung — keduanya memakai form yang sama. Tanpa card luar; dua bagian — "Identitas surat" (dua kolom pasangan tanggal/pengirim,
  nomor/tanggal surat; `perihal` dan `ringkasan isi` dibatasi `max-w-[620px]` karena isinya satu kalimat; select kategori
  dibatasi `max-w-[340px]` dengan minimum dari opsi terpanjang) dan "Undangan rapat" (radio tiga opsi, grup kondisional
  "Data rapat" dengan `aria-live`). Catatan unggah dokumen bukan kartu peer: ia hanya penjelasan urutan kerja dan
  sekarang berada di baris aksi sticky. Di halaman penuh aksi ditempel di dasar jendela karena form tiga bagian
  panjang; di modal baris aksi berada di dasar dialog dan isi dialog yang digulung.
- **Detail surat:** kartu identitas (focal) → dokumen → panel isian inset (status undangan, tambah disposisi) →
  riwayat disposisi → rapat (jadwal + tempat/penyelenggara yang bisa dilengkapi, peserta di panel inset, riwayat geser jadwal) →
  lampiran. Bagian "Rapat terkait surat ini" hanya muncul bila surat memang terkait rapat: ada agenda yang tercatat,
  atau surat ditandai sebagai undangan rapat tapi agendanya belum dicatat — dalam keadaan terakhir itu bagian menampilkan
  formulir "Catat agenda rapat" (`components/rapat-surat-form.tsx`, aksi `catatAgendaSurat`) karena surat yang dibuat
  tanpa agenda belum punya cara mencatat agendanya. Isian tanggal-jam formulir itu berada di baris sendiri; navigasi bagian
  juga hanya menyebut "Rapat" kalau bagiannya memang ada.
- **Surat keluar (`/keluar`, `/keluar/baru`, `/keluar/[id]`):** daftar dengan toolbar filter (pencarian, tahun, kategori,
  status) dan paginasi 25; form baru dua kolom (tanggal/tujuan, nomor/kategori) lalu perihal, ringkasan isi, catatan, dan
  tautan "Balasan dari surat masuk" — nomor surat boleh dikosongkan dan sistem membuat `KL-001/2026`. Detail surat keluar
  mengikuti urutan detail surat masuk: identitas + badge status → dokumen/lampiran → panel inset status (draf → dikirim →
  selesai, maju saja) → pengelolaan (koreksi identitas, arsipkan/keluarkan dari arsip, hapus permanen). Kop cetak dipakai
  saat dicetak seperti surat masuk. Nomor surat keluar adalah penanda utama di daftar dan dashboard, bukan nomor agenda.
- **Waktu kirim surat keluar:** bukan isian di form baru — tercatat otomatis oleh pemicu di basis data saat surat ditandai
  dikirim. Petugas bisa menulis waktunya manual di panel koreksi identitas (`waktu_kirim`, isian tanggal-jam Asia/Jakarta):
  kosong hanya boleh selama surat masih draf, waktunya tidak boleh mendahului tanggal surat, dan nilai yang sudah diisi
  tidak ditimpa saat surat ditandai dikirim. Baris "Dikirim pada" di detail menambahkan "— belum ditandai dikirim" bila
  waktunya diisi manual sementara surat masih draf. Isian ini berada di baris sendiri (`sm:col-span-2`) karena lebar bawaan
  isian tanggal-jam membuat kolom dua kolom saling menumpang di 640px dan 768px.
- **Rapat:** kalender bulan (sel tanggal = tautan ke detail tanggal), kartu "Agenda pada <tanggal>" urut jam, dialog
  "Buat agenda sendiri" (pengingat internal tanpa surat, prefill tanggal yang dibuka), jadwal ulang + riwayat, daftar
  rapat sudah lewat. Agenda yang masih akan datang memakai select ber-`aria-label` dan tombol Simpan status, dan tidak
  ditampilkan saat satu tanggal sedang dibuka. Menu sidebar memakai label "Kalender Agenda".
- **Rekap:** satu baris penjelasan dasar pembanding, enam kartu metrik dengan selisih terhadap tahun sebelumnya,
  dua grafik batang yang berdiri sendiri — "Surat masuk per bulan" dan "Surat keluar per bulan" — lalu donut komposisi
  kategori dan grafik agenda rapat; keempatnya disusun dua kolom di desktop dan menumpuk di HP. Statistik surat masuk dan
  surat keluar tidak digabung dalam satu grafik: keduanya punya sumbu masing-masing supaya angka surat keluar tidak
  tenggelam di samping surat masuk. Tabel per bulan dan per kategori tetap menampilkan kolom masuk/keluar berdampingan;
  aksi cetak dan ekspor Excel. Saat cetak muncul
  kop (logo, BPKAD Kota Magelang, Bidang Aset, judul periode, nomor laporan `REKAP/ASET/{tahun}/{jumlah}`, waktu cetak).
- **Pengaturan:** navigasi tautan akun / kategori surat / daftar nama / jejak perubahan; aksi hanya untuk Administrator. Bagian aktif berasal dari query `tab`, dan aksi di bagian itu tidak berpindah halaman (toast + refresh) sehingga pengguna tetap di bagian yang sedang dipakai — termasuk bagian daftar nama yang sedang dibuka (`bagian=`). Kategori surat diberi kolom arah (`masuk`/`keluar`) sehingga klasifikasi surat masuk dan surat keluar tidak campur di form; daftar nama punya bagian keempat "Tujuan surat keluar" (`master_penerima`) dengan bentuk instansi/unit atau orang. Ubah akun dilakukan inline di baris tabel (peran/status di-prefill dari akun terpilih + tombol Batal); daftar nama punya pencarian sisi klien, chip "N aktif dari M", dan paginasi 10 baris per halaman; jejak perubahan dipaginasi 25 baris per halaman di URL; di ponsel semua daftar jadi daftar menumpuk dengan paginasi yang tetap 44px.
- **Monitor (`/monitor?t=<kunci>`):** layar TV di depan ruangan — tanpa login, tanpa sidebar, selalu mode gelap
  (`dark` dipaksa di pembungkus layar supaya tidak ikut toggle peramban). Tata letaknya diambil dari desain Pen
  (`designs/monitor.pen`; kode hasil ekspor di `designs/tmp/pen-monitor/monitor.html`), dan label bagian memakai caps
  20px dengan tracking 0,14em di desain maupun di kode. Bilah atas: logo + nama bidang + subjudul satu baris
  (`max-w-[760px]`), jam besar `clamp(2.75rem,4vw,3.6rem)` dan tanggal Jakarta di kanan; di lebar kecil header menumpuk.
  **Tidak pernah menggulir:** pembungkus `h-dvh overflow-hidden`, bilah atas/bawah `shrink-0`, tiga layar di
  `absolute inset-0` dalam satu `main` (`flex-1 min-h-0 overflow-hidden`) sehingga tinggi dokumen = tinggi jendela di TV
  1920×1080 maupun di layar kecil (1366×768, 1280×800); `IsiSkala` (`ResizeObserver`) mengecilkan isi yang lebih tinggi dari
  ruang yang tersedia (minimum 0,55) alih-alih menggulir, karena TV tidak punya scrollbar.
  **Layar agenda:** kolom kiri "AGENDA HARI INI" dengan maksimal enam baris yang mengisi tinggi ruang (`flex-1 min-h-[5.5rem]`),
  sisanya jadi baris "+ N agenda lagi hari ini"; baris diwarnai `bg-success-bg`/`bg-warning-bg` untuk sedang berlangsung atau
  "N menit lagi", dan agenda yang dibatalkan memakai lencana `bg-destructive/15 text-destructive ring-1 ring-destructive/40`
  "dibatalkan" tanpa latar tint di barisnya (tint galat di baris membuat keterangan 4,15:1 — di bawah AA) ; di panel kanan
  ditandai "· dibatalkan" berwarna `text-destructive`. Tinggi baris dibatasi `max-h-[7.5rem]` hanya di layar ≥640px: tanpa batas,
  satu agenda saja jadi blok tint setinggi layar (620px di TV) dan jamnya menggulir di tengah tanda hubung. Jam baris
  `text-[1.75rem]` dengan `whitespace-nowrap` di kolom `10,5rem`; di HP barisnya grid satu kolom (jam, judul, keterangan,
  lencana) tanpa batas tinggi. Lencana status memakai `bg-card` dengan teks dan ring berwarna status — lencana yang memakai
  tint barisnya sendiri (`bg-warning-bg`) nyaris tidak kelihatan di atas baris bertint yang sama (1,42:1 terhadap kartunya).
  Teks lencana di `bg-card`: berlangsung 9,17:1, "N menit lagi" 11,00:1, terjadwal 7,16:1, dibatalkan 9,93:1; keterangan di
  baris bertint 6,78:1 (warning) dan 7,00:1 (success), keduanya di atas ambang 4,5:1. Panel kanan "BESOK & MENDATANG" (besok jadi kelompok pertama) menampilkan maksimal lima kelompok tanggal,
  sisanya "+ N agenda lain sampai <tanggal>"; tanggal ringkasan tanpa nama hari supaya kalimat pendek tetap muat. Jam baris
  `text-[1.9rem]`, judul agenda `text-[1.6rem]`, keterangan `15px`; peserta tetap "diikuti Nama, Nama +2 lainnya".
  **Layar statistik:** judul "Statistik surat — <bulan>" dan delapan kartu (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2`)
  dengan angka `clamp(2.25rem,3.4vw,3.75rem)` dan bar penanda 10px (`data-meter`) proporsi angka terbesar di layar itu; track
  bar `bg-card` + `ring-1 ring-foreground/12` supaya warna bar diukur terhadap latar kartu (3:1), bukan `bg-muted` yang lebih terang.
  **Layar grafik:** empat panel (`grid-cols-1 md:grid-cols-2 md:grid-rows-2`) yang mengisi layar; chart dalam ruang
  `flex-1 min-h-0` dengan `tinggiKelas="h-full w-full" ukuranTick={16} kisi="kedua arah"`. `lib/monitor.ts` selalu
  menampilkan dua belas bulan (yang kosong bernilai 0) dengan nama pendek (Jan, Feb, dst.) supaya grafik berbentuk tahun
  dan label muat di sumbu; `maxBarSize` (prop `lebarBatangMaks`, 56px) menahan batang supaya bulan yang sedikit data tidak
  jadi blok lebar. Grafik "Agenda rapat per bulan" memakai satu seri `total` (semua agenda bulan itu, termasuk yang
  dibatalkan) supaya bentuknya sama dengan grafik surat masuk/keluar. Donut komposisi kategori di monitor memakai
  `susun="sebelah"` (donut kiri, legend kanan, jumlah surat di tengah) dengan legend dua kolom di layar lebar
  (`kelasLegend="grid-cols-1 md:grid-cols-2"`) sementara Rekap tetap `susun="menumpuk"` (donut di atas legend).
  Nama kategori yang panjang dipotong dengan ellipsis di dalam kolomnya: pembungkus nama diberi `w-full min-w-0 flex-1`
  dan kolom legend `minmax(min(11rem,100%),1fr)` supaya teks panjang tidak meluber keluar panel (dulu legend tumpang
  tindih saat nama kategori panjang).
  Jam diformat `en-GB` `hourCycle: h23` (`10:31`, bukan `10.31`) karena layar harus mudah dibaca cepat.
  **Di HP layar boleh menggulir:** pembungkusnya `min-h-dvh` dan `main` `overflow-y-auto` di bawah 640px (`lg:h-dvh lg:overflow-hidden`
  untuk TV), layar yang tidak aktif memakai `hidden` di HP (crossfade hanya di desktop), dan `IsiSkala` berhenti mengecilkan di bawah
  640px — dipaksa muat di layar 375px membuat nama agenda terpotong dan lencana menutupi baris berikutnya.
  **Kosong bukan polos:** tanpa agenda yang ditampilkan layar agenda jadi hero besar dengan penjelasan publik
  ("Layar ini menampilkan agenda yang masih akan berlangsung, termasuk yang sudah dibatalkan. Agenda yang sudah selesai tidak ditampilkan."); bagian kosong ("Belum ada agenda mendatang.", tiap grafik kosong, statistik seluruhnya nol) memakai panel ber-garis putus-putus yang menjelaskan.
  **Gerbang (`app/monitor/page.tsx`):** alamat tanpa kunci atau kunci salah bukan halaman kosong — `Gerbang({ judul, pesan? })`
  menampilkan kartu amber di latar bertitik (`DotPattern` bermasker) dengan lingkaran `KeyRound` ber-ring yang berdenyut pelan
  (layar menunggu kunci), eyebrow `MONITOR BIDANG ASET` caps tracking 0,22em, dan judul caps `clamp(1.75rem,6.5vw,3.4rem)`
  ("Kunci monitor tidak cocok" tanpa kalimat penjelasan; "Monitor belum siap" tetap satu kalimat panduan). Isi gerbang berada di
  dalam `main` supaya pemeriksa kontras bisa membukanya seperti halaman lain. Diukur `test:kontras`: judul 15,12:1, garis kartu
  `border-primary` 7,28:1, teks eyebrow 12,58:1, garis eyebrow `border-primary/75` 4,29:1 (sebelumnya `/55` hanya 2,90:1), ikon
  `KeyRound` 5,56:1. Ring denyut bersifat dekoratif (`aria-hidden`) dan tidak diukur.
  **Jeda/lanjut:** klik di mana saja pada konten, Spasi, atau tombol "Jeda"/"Lanjut" di footer (ikon Play/Pause,
  `bg-info-bg` saat dijeda). Footer menampilkan nama layar aktif (`aria-live`), hitung mundur ke pergantian berikutnya,
  jalur maju yang membeku saat dijeda, tiga tombol pilihan layar (44px), dan ringkasan "N agenda tampil sampai <tanggal>".
  Timer pergantian dan indeks layar disimpan sebagai satu state (`{ indeks, sisa }`) dengan updater murni: React dev memanggil
  updater dua kali, dan dulu perpindahan layar dilakukan di dalam updater jam sehingga layar bisa melompat dua langkah.
- Cetak: sidebar dan header disembunyikan
- Cetak: sidebar dan header disembunyikan, `@page` margin 16mm/14mm, kartu dan baris tabel tidak terpotong, warna
  badge/header tabel/grafik/chip delta dipaksa `print-color-adjust: exact`, kanvas dikembalikan ke putih, grafik
  disembunyikan (`tanpa-cetak`), tabel dicetak penuh tanpa scroller (`overflow: visible`, `width: 100%`, font 11px).
  Kalender rapat dilepas `min-width` saat cetak (`.kalender > div`).

## 8. Bukti penerapan

- `npx tsc --noEmit` dan `npm run build` bersih (27 rute: 18 halaman, dua intersep, tujuh alamat API — termasuk
  `/api/pembaruan` untuk pembaruan realtime).
- `npm run test:klik` → 330 PASS, 0 FAIL, 0 console error (login/exit, CRUD surat + disposisi + lampiran + peserta,
  sidebar collapse/expand, filter, ubah status rapat, koreksi dan hapus langkah disposisi, koreksi identitas + arsip +
  pulih + hapus permanen surat, penguncian surat arsip (kontrol hilang, penolakan server dengan alasan, kalender menyebut
  agenda terkunci), hapus agenda dari surat (batal, peserta ikut terhapus, penghapusan surat selesai tanpa database), kop laporan dan tombol cetak memanggil `window.print`, rekap + ekspor Excel, pengaturan + audit, ubah sandi, token primary computed-style, overflow 375px, daftar nama accordion, paginasi,
  agenda mandiri dan detail tanggal, plus daftar/form baru/detail/panel koreksi surat keluar di 375px).
  Peserta rapat diuji lewat daftar pegawai: nama tersorot di-Tab jadi chip dan isian siap untuk nama berikutnya, dua nama
  sekaligus dalam satu aksi, nama di luar daftar tidak dijadikan peserta (pesan + tautan ke bagian pegawai, dan isian
  "Pegawai baru" di Pengaturan sudah terisi dari tautan itu), instansi terisi otomatis, peserta dari daftar yang baru
  ditambah tersimpan lalu bisa dihapus,
  hapus per nama lewat barisnya (bukan nama pertama), dan bagian "Pegawai bidang aset" di Pengaturan (tambah dengan
  jabatan, nonaktifkan, nama nonaktif tidak muncul saat memilih peserta). Baris peserta ditunggu lewat
  `page.locator("div.border-b", { hasText: nama })` karena teks di chip formulir juga menyebut nama yang sama; pencarian
  pegawai diulang sampai barisnya beserta tombol "Nonaktifkan" muncul karena pesan "tidak ada yang cocok" ikut menyebut
  nama yang dicari. Pembuatan surat keluar di layar sentuh punya batas tunggu 150 detik dan kalau redirect tertinggal,
  alamat surat yang tersimpan diambil dari data (nomor uji dibersihkan sebelum dibuat supaya tidak rangkap).
  Aksi yang berubah di halaman yang sama diuji lewat toast (`cekToast()` menunggu `[data-slot="toast"]` lalu
  `networkidle`), bukan lewat flag di URL: status rapat/tindak lanjut, koreksi disposisi dan identitas, lampiran,
  peserta, arsip/pulih, toggle kategori dan daftar nama, hapus agenda dan hapus baris. Panel yang menutup sendiri dan
  perpindahan halaman diuji dengan `tungguUrl()` (di dev bisa beberapa detik sesudah toast); teks hasil
  `router.refresh()` dengan `tungguTampil()`/`tungguHilang()`; badge dengan `tungguBadge()` (`exact`); penolakan
  validasi form `useActionState` dengan galat inline (`tungguInline()`), bukan toast. Yang tetap diuji lewat URL hanya
  surat masuk baru (`?ok=1`), agenda mandiri (ke
  tanggalnya), dan hapus permanen (ke `/surat`; surat keluar ke `/keluar`). Uji metrik membaca `[data-slot='metric-nilai']`, bukan kelas ukuran.
- `npm run test:layout` → 224 kombinasi viewport × rute + modal, 0 gagal (overflow bersih, target sentuh 44px mobile /
  28–24px desktop termasuk baris radio surat, radius kartu ≥6px, opsi terpanjang select muat di popup, tidak ada
  elemen form tumpang; baris aksi sticky dikecualikan dari uji tumpang tindih; tombol hanya-icon `[data-ikon-saja]`
  diukur lebarnya 44px di HP; elemen `position: fixed` (FAB) dikecualikan dari uji tumpang tindih; detail surat dalam mode koreksi identitas ikut; rute surat keluar `/keluar`, `/keluar/baru`, dan detail `&keluar=ubah` ikut di tiap viewport;
  detail surat undangan yang belum punya agenda ikut di tiap viewport supaya formulir agenda rapatnya diukur).
  Isian nama peserta juga diukur **dalam keadaan daftar terbuka** di tiap viewport: popupnya di-portal ke body sehingga
  isinya diukur sendiri (`ukurLayout("combobox")`) dan tepi popupnya dibandingkan dengan lebar jendela; surat yang dipakai
  dicari dari data yang punya agenda (`jadwal_rapat`), karena formulir peserta hanya muncul di bagian Rapat — sebelumnya
  pemeriksaan ini memakai surat yang dibuat di uji dan bisa melewatkan surat tanpa agenda.
  Viewport 1920 ditambah karena layar monitor memang untuk TV; `/monitor?t=<kunci>` ikut diukur di semua viewport.
  Modal "tambah surat masuk" dan "tambah surat keluar" diukur di tiap viewport dengan scope `[data-slot="dialog-content"]`
  (dialognya di-portal ke body, bukan di dalam `main`) — pemicunya tautan header di desktop, FAB di HP.
  Pointer dipindahkan ke tengah konten sebelum submit supaya klik tidak nyantol ke elemen lain saat form belum selesai di-hidrasi.
- `npm run test:keluar` → 48 PASS, 0 FAIL (`scripts/keluar-check.mts`, lebih cepat karena hanya menguji satu bagian):
  nomor otomatis `KL-001/tahun`, alur maju yang dijaga pemicu database (mundur ditolak dengan pesan ramah),
  `tanggal_kirim` terisi otomatis, waktu kirim manual di panel koreksi (diisi → tampil di detail dengan "belum ditandai
  dikirim", waktu sebelum tanggal surat ditolak inline, dikosongkan saat masih draf diterima, dikosongkan setelah dikirim
  ditolak inline), lampiran (unggah, unduh berlogin, ditolak tanpa login, hapus), koreksi identitas,
  arsip yang menutup pengelolaan, pulih ke status sebelum arsip, hapus permanen, filter daftar, dashboard, rekap,
  lembar "Daftar surat keluar" di ekspor Excel, dan konsol bersih. Pembuatan surat keluar diuji dua bentuk: dari daftar
  sebagai modal (dialog di atas daftar, dialog hilang setelah tersimpan, nomor otomatis tetap dibuat) dan alamat
  `/keluar/baru` yang dibuka langsung sebagai halaman penuh tanpa dialog.
- `npm run test:monitor` → 38 PASS, 0 FAIL (`scripts/monitor-check.mts`): tanpa kunci tidak ada angka yang tampil, kunci
  salah ditolak, agenda hasil dialog agenda mandiri tampil dengan jam dan tempat, statistik bulan berjalan tampil, ketiga
  layar tidak melebar dan tidak menggulir vertikal di layar TV (tinggi dokumen sama dengan tinggi jendela) dengan judul ≥20px
  dan angka/jam ≥28px, tombol Jeda menghentikan pergantian dan layar yang dijeda tidak berpindah, tombol Lanjut melanjutkan,
  tiap layar bisa dibuka lewat tombol footer, layar grafik menampilkan panel grafik dan komposisi kategori, anak panah kiri
  berpindah layar, Spasi menjeda, layar berganti sendiri ke statistik setelah 20 detik, agenda yang disembunyikan hilang dari
  layar, dan konsol bersih. `tmp/shot-monitor-busy.mts` memasang 11 agenda uji (berlangsung, dalam 30 menit, terjadwal,
  dibatalkan, besok, lusa) dan mengukur tinggi baris (112px di 1920×1080, 68px di 1366×768 — dibatasi, tidak lagi setinggi
  layar), bahwa dokumen tidak menggulir di layar TV, dan kontras lencana/keterangan; di 375px dokumen memang menggulir.
- `npm run test:kontras` → 328 pemeriksaan (164 kasus dibaca di **mode terang dan mode gelap**, berpindah mode lewat
  toggle di header), 0 gagal (3.43:1 – 21.00:1), termasuk dua kasus ikon pada tombol mode di header (ikon yang aktif dan
  ikon saat hover, kedua mode). Layar monitor diukur pada 1920px: judul header 16.48:1, jam besar 16.48:1,
  judul bagian 8.26:1, label kartu statistik 7.58:1, angka statistik 15.12:1, keterangan footer 8.26:1, judul panel grafik dan
  keterangannya 8.26:1 / 7.58:1, label sumbu grafik 15.12:1; bar penanda besar kartu statistik diukur terhadap latar kartunya
  (`isi-color`, indikator non-teks, ambang 3:1): masuk 3.60:1, keluar 7.23:1, belum dikirim/belum didisposisikan 11.00:1,
  belum selesai dan rapat 9.17:1. Track bar memakai `bg-card` + `ring-1 ring-foreground/10`; dengan `bg-muted` sebagai track
  hanya 2.30:1. Kasus poles monitor: gerbang kunci salah (judul 15.12:1, garis kartu 7.28:1, teks eyebrow 12.58:1, garis
  eyebrow 4.29:1, ikon `KeyRound` 5.56:1) dan lencana status di baris agenda monitor (`bg-card`: berlangsung 9.17:1,
  "N menit lagi" 11.00:1, terjadwal 7.16:1, dibatalkan 9.93:1) dengan keterangan baris bertint (success 7.00:1, warning
  6.78:1). Monitor selalu gelap (kedua mode mengukur warna yang sama) karena pembungkusnya `.dark`, dan `.dark` mendeklarasikan
  ulang alias `--color-*` supaya warna grafik tidak jatuh ke nilai mode terang (lihat §1). Batang grafik surat di Rekap diukur
  terpisah: masuk 7.64:1 / 3.60:1, keluar 6.91:1 / 7.23:1. Selain semua kasus sebelumnya, isi modal "tambah surat" diukur
  (judul dialog 19.76:1 / 14.44:1, keterangan 6.55:1 / 7.24:1, ikon tutup 6.55:1 / 7.24:1, judul dan keterangan kartu
  dalam dialog, label isian, garis isian dan select 4.89:1 / 3.59:1, placeholder nomor surat dan nomor keluar
  5.77:1 / 6.86:1, teks tombol simpan 6.12:1 / 6.34:1, teks dan garis tombol Batal outline 18.41:1 / 14.44:1 dan
  4.89:1 / 3.43:1, keterangan di dasar dialog 6.55:1 / 7.24:1). Pemicu dialog untuk kasus ini tautan header di desktop
  dan FAB di HP. Kasus: teks judul/keterangan tabel dan kartu, badge empat nada, badge
  status surat keluar di daftar dan detail (draf 5.34:1 / 9.85:1, dikirim 7.79:1 / 9.03:1, selesai 6.72:1 / 8.47:1,
  arsip 14.52:1 / 12.34:1), select status surat keluar (teks 16.27:1 / 15.12:1, garis 4.56:1 / 3.92:1), keterangan
  penguncian surat keluar arsip (6.10:1 / 8.26:1), tombol arsipkan yang di-disable pada surat keluar draf (teks
  18.41:1 / 16.48:1, garis 4.56:1 / 3.92:1), toast surat keluar di kedua mode, select
  status yang ditint, tombol primary di kedua mode, batas outline/input/select (4.89:1 terang, 3.59:1 gelap),
  placeholder, navigasi bagian Pengaturan terpilih dan nonaktif, **kombinasi hover** (bagian terpilih saat hover, menu
  sidebar aktif saat hover), alert, galat isian form (`[data-slot='field-error']` 6.63:1 / 9.93:1), angka grafik batang,
  slice donut (5.09:1 / 6.82:1), label grup sidebar, label dan angka metrik, chip delta, angka hari ini (17.30:1 /
  13.83:1), angka tanggal kalender yang bisa diklik, keterangan kalender, halangan arsip, tombol arsipkan yang
  di-disable, penguncian surat arsip, catatan agenda surat arsip, teks tombol hapus agenda, dialog agenda mandiri di
  latar `popover` (batas isian 4.89:1 di popover putih dan 3.43:1 di popover gelap), dan **teks, ikon chip, dan tombol
  tutup toast** di latar toastnya sendiri (teks 19.76:1 / 14.44:1, chip sukses 6.72:1 / 8.47:1, chip galat
  6.63:1 / 9.49:1, tutup 6.55:1 / 7.24:1). Sampel badge `destructive` dibuat dengan membatalkan agenda lewat detail
  tanggalnya, lalu dibaca di daftar "sudah lewat".
- `npm run test:modal` → 17 PASS, 0 FAIL (`scripts/modal-check.mts`): modal surat masuk dan surat keluar terbuka di
  atas daftar (daftar tetap terlihat), galat validasi server tampil di dalam dialog, simpan membawa ke halaman detail
  dan dialog ikut hilang, Batal/Escape/tombol tutup kembali ke daftar tanpa menyimpan, `/surat/baru` dan
  `/keluar/baru` tetap halaman penuh kalau dibuka langsung, dialog HP adalah sheet bawah yang menempel dasar dan
  melebar selebar jendela tanpa overflow horizontal, target sentuh di dalam dialog 44px, dan konsol bersih.
- `npm run test:rapat` → 17 PASS, 0 FAIL (`scripts/rapat-surat-check.mts`): surat yang belum terkait rapat tidak
  menampilkan bagian Rapat (dan navigasi bagian tidak menyebutnya), surat yang ditandai undangan rapat menampilkan
  formulir agendanya, waktu mulai dan waktu selesai yang salah ditolak dengan pesan ramah tanpa menyimpan agenda,
  agenda yang dicatat tampil di surat dan di kalender tanggalnya beserta tempatnya, agenda yang dihapus membuat
  formulir muncul lagi selama surat masih berstatus undangan, dan status diubah menjadi bukan rapat membuat bagian
  Rapat hilang kembali.
- `npm run test:api` → 79 PASS, 0 FAIL (`scripts/api-check.mts`): enam alamat API diuji lewat `fetch` tanpa browser —
  masuk dan cabut token, kalender untuk semua peran (urut, rentang, satu tanggal, penyaring status, `sejak`), agenda milik
  sendiri (buat, koreksi, geser waktu dengan riwayat, hapus), penolakan 401/403/404 yang benar, bentuk waktu beroffset
  `+07:00`, dan jejak audit dari aplikasi Android. Data uji dibuat dan dibuang lewat Prisma, tidak menyentuh data asli.
- `npm run test:sse` → 46 PASS, 0 FAIL (`scripts/sse-check.mts`): perubahan data datang lewat `pg_notify` → jalur SSE
  → halaman yang bersangkutan. Yang diuji: hanya tabel yang benar-benar dipakai halaman yang menyegar halaman itu,
  jalur hanya terbuka untuk sesi aplikasi atau kunci monitor, isi peristiwa hanya tabel/aksi/id (tidak ada isi surat),
  halaman rapat/daftar surat/formulir surat/layar monitor berubah sendiri tanpa penyegar berkala, perubahan akun lain
  terlihat di halaman akun lain, dan satu koneksi `LISTEN` dipakai bersama (tidak menumpuk saat halaman ditutup).
- `npm run test:tampilan` (`scripts/shots.mjs`) → tangkapan layar desktop 1280 dan mobile 390 untuk semua rute +
  rekap saat cetak, disimpan di `.shots/` (tidak masuk git). Skrip menambahkan data contoh bertanda `REVIEW-UI`
  lalu menghapusnya kembali; data asli tidak berubah.

## 9. Yang belum dinilai pengguna

- Daftar peserta rapat, kop cetak rekap, dan donut komposisi kategori surat sudah jalan; tinjauan visual sudah
  dilakukan lewat `.shots/`, tapi belum dinilai oleh petugas Bidang Aset.

## 10. API untuk aplikasi Android

Aplikasi Android (belum dibuat) dipakai pejabat dan pegawai Bidang Aset untuk melihat kalender dan mencatat agenda
miliknya sendiri, dengan pengingat alarm di perangkat. Cangkang API ada di `app/api/*`; pembantu respons dan bentuk
agenda di `lib/api.ts`, token di `lib/api-auth.ts`, parsing waktu di `lib/waktu.ts`.

| Alamat | Isi | Siapa |
|---|---|---|
| `POST /api/masuk` | `email`, `password`, `perangkat` (boleh kosong) → `token`, `kedaluwarsa`, `nama`, `email`, `peran` | akun yang sama dengan aplikasi web |
| `POST /api/keluar` | mencabut token perangkat ini | pemilik token |
| `GET /api/sesi` | nama, email, peran, perangkat, batas token | perangkat memeriksa token saat dibuka |
| `GET /api/kalender` | `hari` atau `mulai`+`selesai` (bawaan hari ini sampai 30 hari), `status`, `sejak` → `agenda[]` urut waktu | semua peran yang masuk |
| `POST /api/agenda` | `agenda_rapat`, `tanggal_mulai`, `tanggal_selesai?`, `tempat?`, `penyelenggara?`, `catatan?` → 201 + agenda | pembuatnya (`created_by` = akun token) |
| `GET/PATCH/DELETE /api/agenda/<id>` | baca; koreksi dan hapus | baca semua peran; koreksi/hapus hanya pembuatnya |

- **Hanya kalender dan agenda sendiri.** Tidak ada alamat untuk surat masuk, disposisi, surat keluar, lampiran, atau
  rekap: aplikasi Android tidak membaca bagian itu. Agenda yang berasal dari surat masuk hanya terbaca — `PATCH` dan
  `DELETE` dijawab 403 "Agenda ini berasal dari surat masuk dan hanya bisa diubah dari halaman suratnya di aplikasi."
- **Token pembawa.** `Authorization: Bearer <token>`; yang tersimpan di database adalah hash SHA-256 (`api_token.token_hash`),
  token asli hanya ada di jawaban masuk dan di perangkat. Batas 90 hari diperpanjang setiap kali token dipakai, dan
  `terakhir_pakai` dicatat. Keluar dari aplikasi menghapus baris token, bukan kata sandi atau sesi web.
- **Waktu dua bentuk.** `mulai` dan `selesai` adalah jam Asia/Jakarta beroffset tetap (`2026-11-16T09:00:00+07:00`) supaya
  alarm di perangkat dijadwalkan pada jam yang dibaca petugas; `mulai_utc`/`selesai_utc` dipakai perangkat untuk
  perbandingan dengan `sejak` saat menyinkronkan ulang. Nilai masuk tanpa offset dianggap jam Jakarta, nilai beroffset/Z
  dipakai apa adanya.
- **Bahasa pesan sama dengan aplikasi web.** Galat memakai kode HTTP yang berarti: 400 isian belum benar (pesan menyebut
  contoh bentuk yang diharapkan), 401 token tidak dikenali atau kedaluwarsa, 403 bukan pembuat agenda atau akun nonaktif,
  404 agenda tidak ditemukan. Jawaban sukses selalu `ok: true` dan galat `ok: false` + `pesan`, dengan `Cache-Control: no-store`.
- **Status dan riwayat.** Agenda baru berstatus `terjadwal`. Menggeser waktu lewat API menulis riwayat jadwal rapat dan
  mengubah status jadi `dijadwalkan_ulang` (sama seperti "Jadwalkan ulang" di web) kecuali status disebut sendiri; alasan
  boleh dikirim lewat `alasan` dan bawaannya "Digeser dari aplikasi Android." jejak audit memakai kode yang sudah ada
  (`buat_agenda`, `geser_rapat`, `ubah_rapat`, `hapus_agenda`, `login`, `logout`) dengan keterangan "dari aplikasi Android".
- **Batas jawaban kalender** 300 agenda; bila `dipotong` benar, pemanggil menyempitkan rentang tanggal.
- **Jalur pembaruan bukan bagian API Android.** `GET /api/pembaruan` adalah aliran peristiwa (SSE) untuk aplikasi web
  dan layar monitor: sesi aplikasi lewat cookie, layar monitor lewat `?t=MONITOR_TOKEN`. Isinya hanya
  tabel/aksi/id dari pemicu database, jadi agenda yang dibuat atau diubah dari aplikasi Android langsung tampil di
  kalender dan layar monitor tanpa penyegar berkala; aplikasi Android sendiri tidak perlu berlangganan.
