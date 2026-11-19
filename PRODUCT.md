# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Petugas Bidang Aset BPKAD Kota Magelang** (peran Administrator) — pemegang harian: mencatat surat masuk, membuat disposisi, meneruskan, menjadwalkan rapat, menambah peserta, mengunggah lampiran, mengelola akun/kategori surat/daftar nama.
- **Pejabat dan pimpinan** (peran Pembaca) — datang untuk membaca: surat apa yang masuk, disposisi siapa ke siapa, agenda rapat terdekat, dan angka statistik. Tidak menulis (hanya ubah kata sandi sendiri lewat `/akun`).
- **Audiens publik pasif** — orang yang lewat di depan Bidang Aset: layar TV `/monitor` menampilkan agenda yang dipublish
  dan statistik surat bulan berjalan. Layarnya sudah jalan (tanpa login, kunci dari env, selalu mode gelap); perangkat TV-nya
  belum dipasang, sampai dipasang audiens ini belum nyata.

Pembakaian mayoritas desktop kantor; ponsel dipakai sesekali (bukan skenario utama, tapi harus tetap bisa dipakai).

## Product Purpose

Mengganti lembar agenda Excel lama ("Agenda Surat Masuk Bidang Aset") dengan satu catatan yang bisa dibaca, dihitung, dan dipantau. Tujuannya, menurut pimpinan:

- punya **data statistik surat masuk** — jumlah surat yang sudah masuk dan komposisi per kategori surat;
- punya **kalender agenda rapat yang bisa dipantau**, dan memberi tahu pejabat kapan rapat/agenda akan tiba;
- data itu nanti **disajikan di monitor publik** di depan pintu Bidang Aset.

Sukses = angka di dashboard/rekap dipercaya karena berasal dari catatan yang sama dengan daftar surat dan jadwal rapat, bukan dari spreadsheet yang diketik ulang.

## Positioning

Satu surat masuk adalah satu record yang tidak bercabang: nomor agenda diberikan otomatis per tahun oleh database, disposisi berantai dicatat termasuk langkah terakhir "diteruskan ke", jadwal rapat tertaut ke suratnya, dan setiap perubahan tercatat di jejak perubahan data. Statistik, kalender, ekspor, dan daftar semuanya dihitung dari record yang sama — sesuatu yang tidak bisa dilakukan lembar Excel tunggal tanpa mengetik ulang angka.

## Operating Context

- Alur kerja harian: surat masuk → disposisi (pemberi disposisi dari daftar pejabat resmi) → diteruskan ke tujuan → ditindaklanjuti → agenda rapat dijadwalkan → peserta rapat dicatat. Agenda juga bisa dibuat tanpa surat (pengingat internal/pribadi); pemiliknya dicatat dan hanya ia — atau Administrator — yang bisa mengubah statusnya.
- Nama pengirim, pemberi disposisi, dan tujuan penerusan dipilih dari daftar nama resmi (`master_pengirim`, `master_pejabat`, `master_terusan`); opsi "Lainnya (ketik manual)" tetap ada untuk nama di luar daftar. Nama tersimpan sebagai teks bebas, jadi mengubah daftar tidak merusak histori.
- Laporan per periode dibuat lewat halaman Rekap: kartu angka, grafik surat masuk per bulan, donut komposisi kategori surat, tabel daftar, ekspor Excel, dan cetak kop surat.
- Lampiran surat: PDF/JPG/PNG sampai 20 MB.
- Jejak perubahan data dibaca di Pengaturan (100 catatan terakhir ditampilkan; tabel hanya bisa diubah/dihapus oleh akun aplikasi).
- Bahasa seluruh antarmuka: Bahasa Indonesia, gaya formal pemerintah.

## Capabilities and Constraints

- Next.js 16 + PostgreSQL 18 remote (DB `agenda_aset` saja di server itu; DB lain tidak disentuh), Prisma, shadcn/ui, Tailwind v4. Deploy di **Coolify** (Dockerfile, `output: standalone`) sebagai platform tetap; PostgreSQL remote adalah database tetap.
- Autentikasi cookie HMAC (14 hari), dua peran: Administrator (bisa menulis) dan Pembaca (baca + ubah sandi sendiri).
- Tanggal tanpa jam disimpan sebagai tengah malam UTC supaya kolom `date` tidak bergeser mundur satu hari.
- **Ekspor Excel cukup berisi angka rekap.** Format lembar agenda lama tidak harus dipertahankan; kalau suatu saat butuh rincian per surat, itu fitur baru bernama "Excel Rinci" (belum dibangun).
- **Cetakan kop surat bukan dokumen resmi** — hanya laporan internal, dipasang sebagai antisipasi bila kelak dipakai. Tampilannya harus rapi, tapi tidak terikat aturan arsip.
- Batas unggah 20 MB; lampiran disimpan di `UPLOAD_DIR` (volume `/app/uploads` di produksi).
- Riwayat bisa dikoreksi: identitas surat (nomor agenda tetap) dan satu langkah disposisi bisa diubah atau dihapus;
  status surat dihitung ulang dari langkah yang tersisa. Agenda rapat yang salah dicatat dihapus dari detail suratnya
  (peserta dan riwayat jadwal ikut hilang); agenda tanpa surat dihapus dari kalender. Surat selesai boleh diarsipkan
  (tetap terbaca, tetap terhitung
  di rekap, bisa dikeluarkan lagi) — saat diarsipkan surat tertutup, tidak ada isian yang bisa diubah sampai dikeluarkan.
  Penghapusan surat permanen hanya setelah lampiran, langkah disposisi, dan agenda
  rapatnya dibersihkan — penolakan dijelaskan ke pengguna dalam bahasa Indonesia.
- Uji otomatis (`test:klik`, `test:layout`, `test:kontras`, `test:tampilan`) menghapus `surat_masuk`, sehingga hanya boleh dijalankan di DB uji/staging — DB produksi berisi data asli.
- **Pengingat ke pejabat belum selesai**: agenda rapat sudah ada dan bisa dipantau, dan kepala bidang sudah bisa
  mencatat pengingat miliknya sendiri di kalender ("Buat agenda sendiri" di `/rapat`, agenda tanpa surat masuk),
  tapi mekanisme pemberitahuan (monitor publik, dan/atau kanal lain) belum diputuskan.
- **Monitor publik depan pintu**: permukaannya sudah dirancang dan jalan — `/monitor?t=<kunci>`, layar non-interaktif
  1920×1080 selalu mode gelap, berganti sendiri antara agenda (hari ini, besok, tujuh hari ke depan) dan statistik bulan
  berjalan, jam berdetak, data disegarkan tiap 30 detik. Yang belum: TV-nya belum dipasang dan layoutnya belum dinilai
  orang di ruangan.

## Brand Commitments

- Marka resmi BPKAD Kota Magelang dipakai di sidebar dan login (`public/logo.png` 256px) dan kop laporan (`public/logo-cetak.png` 512px). Sumber asli 4726px (~9 MB) sengaja di luar repo; hasil dibuat ulang dengan `npm run logo:optimize`.
- Nama produk: **Agenda Surat dan Jadwal Rapat — Bidang Aset BPKAD Kota Magelang**.
- Sistem visual yang sudah diikat dan harus dipertahankan: preset shadcn `b6ae1bGaW` ("rhea", mauve) dengan token OKLCH kustom, plus token status aplikasi (`--success`, `--warning`, `--info`, `--destructive`) yang membawa makna bisnis. Detail di `DESIGN.md`.

## Evidence on Hand

- Lembar agenda lama `0 Agenda Surat Masuk Bidang Aset.xlsx` (~18.934 baris) sebagai referensi struktur data; di-gitignore, tidak diimpor ke database.
- Daftar nama awal dari lembar lama: `db/seed-002-nama.sql` (6 pejabat, 15 tujuan terusan, 31 pengirim).
- Skema dan migrasi nyata: `db/schema.sql`, `db/migrate-002-master-nama.sql`, `db/migrate-003-agenda-mandiri.sql`,
  `db/migrate-004-surat-keluar.sql`, `db/migrate-005-monitor-publish.sql`.
- Uji yang berjalan dan hijau: `scripts/click-through.mts` (298 PASS), `scripts/layout-check.mjs` (175 kombinasi),
  `scripts/contrast.mjs` (244 pemeriksaan), `scripts/keluar-check.mts` (39 PASS), `scripts/modal-check.mts` (17 PASS),
  `scripts/monitor-check.mts` (17 PASS).
- Yang **belum** ada dan tidak boleh dikarang: testimoni, pengguna lain, benchmark, angka publikasi, hardware monitor, dan fitur notifikasi.

## Product Principles

1. Satu catatan, banyak pembacaan — statistik, kalender, daftar, dan ekspor berasal dari record yang sama, tidak dari salinan.
2. Angka yang tampil harus bisa ditelusuri ke suratnya; jejak perubahan data adalah bagian dari kepercayaan, bukan hiasan.
3. Pemantauan lebih penting daripada pengetikan: desktop adalah skenario utama, dan layar harus bisa dibaca dari jarak ruang kantor.
4. Status bisnis (disposisi, tindak lanjut, jadwal rapat) membawa makna dan selalu berlabel teks; warna bukan satu-satunya penanda.
5. Fitur antisipasi (cetak kop, ekspor) boleh ada, tapi tidak boleh mengorbankan alur harian petugas.

## Accessibility & Inclusion

Ikut peraturan yang berlaku untuk layanan publik: WCAG AA sebagai standar wajib (teks ≥4,5:1, batas form ≥3:1, fokus ≥3:1), target sentuh ≥44px di layar ≤768px. Diukur oleh `scripts/contrast.mjs` dan `scripts/layout-check.mjs`, bukan diasumsikan.

## Keputusan yang belum diambil

- Mekanisme pengingat rapat ke pejabat (monitor publik, dan/atau kanal lain) — undecided.
- Permukaan monitor publik — sudah dirancang dan jalan (`/monitor`), tinggal dipasang di TV dan dinilai orang di ruangan.
  Layar monitor sudah menampilkan tiga layar (agenda, statistik bulan berjalan, grafik setahun masuk/keluar/agenda + komposisi
kategori surat) dan bisa dijeda supaya pengunjung bisa membaca satu layar; apakah layar perlu menampilkan hal lain (misalnya
peserta rapat atau daftar surat yang belum selesai) belum diputuskan.
- "Excel Rinci" ( ekspor daftar rinci per surat) — belum dibangun.
- Backup rutin `agenda_aset` belum dijadwalkan di server.
