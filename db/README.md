# Database: `agenda_aset`

Server: `<server>:<port>` — PostgreSQL 18.4 (dipakai bersama beberapa aplikasi lain, hanya database ini yang milik aplikasi Agenda Surat & Jadwal Rapat).

## Akun aplikasi

Akun khusus `aset_app` dibuat agar aplikasi tidak memakai superuser `postgres`.

```
DATABASE_URL=postgres://aset_app:<kata sandi aset_app>@<server>:<port>/agenda_aset
```

Kata sandi asli tidak ditulis di dokumen ini; ambil dari `.env` di komputer development.

Hak akses `aset_app`:
- `SELECT, INSERT, UPDATE, DELETE` pada seluruh tabel
- `audit_logs` `INSERT`, `SELECT`, dan `DELETE` → log tidak diedit aplikasi; `DELETE` diberikan supaya skrip uji
  (`scripts/click-through.mts`, `layout-check.mjs`, `contrast.mjs`) bisa membereskan data uji. Kode aplikasi
  tidak pernah menghapus log. Bila ingin mengembalikan ke desain awal: `REVOKE DELETE ON audit_logs FROM aset_app;`
- `EXECUTE` fungsi `next_nomor_agenda(year)`
- `DELETE` juga diberikan pada `master_pengirim`, `master_pejabat`, `master_terusan` → sama seperti `audit_logs`, hanya
  supaya skrip uji membereskan data uji; kode aplikasi tidak menghapus nama. Untuk kembali ke desain awal:
  `REVOKE DELETE ON master_pengirim, master_pejabat, master_terusan FROM aset_app;`
- `timezone` dan `search_path` diset pada level database (`Asia/Jakarta`, `public`)

Simpan kredensial di `.env`, jangan di repositori publik.

## Migrasi 002: daftar nama resmi + langkah diteruskan

Tabel `master_*`, kolom `disposisi.tanggal_diteruskan`, `penerima_disposisi` yang boleh kosong, dan view
`v_disposisi_aktif` yang diperbarui dibuat oleh superuser `postgres` (`aset_app` tidak punya hak CREATE/ALTER):

```bash
psql -h <host> -p <port> -U postgres -d agenda_aset -f db/migrate-002-master-nama.sql
psql -h <host> -p <port> -U postgres -d agenda_aset -f db/seed-002-nama.sql
```

Kedua berkas idempoten. `db/seed-002-nama.sql` mengisi daftar awal dari lembar agenda lama; nama lain bisa
ditambahkan lewat Pengaturan → tab Daftar nama. Bila membangun database dari nol, `db/schema.sql` sudah memuat
objek yang sama — cukup jalankan seed-nya saja.

## Migrasi 003: agenda mandiri

`jadwal_rapat.surat_id` dibuat boleh kosong sehingga bidang bisa membuat pengingat atau kegiatan internal tanpa surat
masuk (`db/migrate-003-agenda-mandiri.sql`, dijalankan oleh superuser `postgres`):

```bash
psql -h <host> -p <port> -U postgres -d agenda_aset -f db/migrate-003-agenda-mandiri.sql
```

Trigger `chk_rapat_sumber_undangan` hanya memeriksa sumber surat kalau `surat_id` terisi; `created_by` dipakai sebagai
pemilik agenda mandiri dan diberi index. Bila membangun database dari nol, `db/schema.sql` sudah memuat bentuk yang sama.

## Migrasi 004: surat keluar

Tabel `surat_keluar`, `lampiran_keluar`, `master_penerima`, `keluar_counter`, kolom `jenis_surat.arah`, fungsi
`next_nomor_keluar(year)` (format `KL-001/2026`), trigger alur status maju, dan view `v_surat_keluar_aktif` dibuat oleh
superuser `postgres` (`aset_app` tidak punya hak CREATE/ALTER):

```bash
psql -h <host> -p <port> -U postgres -d agenda_aset -f db/migrate-004-surat-keluar.sql
psql -h <host> -p <port> -U postgres -d agenda_aset -f db/seed-003-surat-keluar.sql
```

Bila laptop tidak punya `psql` (kondisi di laptop dev ini), jalankan lewat Node dengan akun `postgres` yang ada di
`DATABASE_URL`: `npm run migrate:keluar`. Pemeriksa bagiannya: `npm run test:keluar`.

Kedua berkas idempoten. `db/seed-003-surat-keluar.sql` mengisi klasifikasi surat keluar dan daftar tujuan resmi; tujuan
lain bisa ditambahkan lewat Pengaturan → tab Daftar nama → bagian "Tujuan surat keluar". Bila membangun database dari
nol, `db/schema.sql` sudah memuat objek yang sama — cukup jalankan seed-nya saja.

## Migrasi 005: publikasi agenda ke monitor

Kolom `jadwal_rapat.terbit` (`boolean NOT NULL DEFAULT true`), index parsial `idx_rapat_terbit`, dan view
`v_agenda_monitor` (agenda `terbit` dengan status `terjadwal`/`berlangsung`/`dijadwalkan_ulang`, berikut nomor agenda,
perihal, pengirim, dan pemberi disposisi terakhir) dibuat oleh superuser `postgres`:

```bash
psql -h <host> -p <port> -U postgres -d agenda_aset -f db/migrate-005-monitor-publish.sql
```

Tanpa `psql`: `npm run migrate:monitor` (jalan lewat Node dengan akun `postgres` di `DATABASE_URL`). Pemeriksa layarnya:
`npm run test:monitor`.

Hak `aset_app` atas layar ini dibatasi: hanya `SELECT` pada `v_agenda_monitor` dan `UPDATE` pada kolom `terbit` — aplikasi
tidak bisa mengubah kolom lain lewat jalur publikasi. Default `true` dipilih supaya agenda yang sudah ada tetap tampil di
layar ketika migrasi masuk; agenda internal kemudian disembunyikan dari halaman rapat.

## Migrasi 007: token aplikasi Android

Tabel `api_token` (hash SHA-256 token, `perangkat`, `terakhir_pakai`, `expires_at`) dibuat oleh superuser `postgres`
dan diberi hak penuh kepada `aset_app` karena token dibuat, diperpanjang, dan dicabut oleh aplikasi sendiri:

```bash
psql -h <host> -p <port> -U postgres -d agenda_aset -f db/migrate-007-api-token.sql
```

Tanpa `psql`: `npm run migrate:api` (lewat Node dengan akun `postgres` di `DATABASE_URL`). Pemeriksa API-nya:
`npm run test:api`.

Token dibuat lewat `POST /api/masuk` dengan email + kata sandi yang sama dengan aplikasi web; yang tersimpan hanya
hash-nya, dan batas 90 hari diperpanjang setiap kali token dipakai. Menghapus pengguna ikut menghapus token miliknya
(`ON DELETE CASCADE`). Akun yang dinonaktifkan tidak lagi bisa memakai token yang sudah dibuat. Bila membangun
database dari nol, `db/schema.sql` sudah memuat tabel yang sama.

## Migrasi 008: pemicu pemberitahuan perubahan

Pemicu `trg_memberi_<tabel>` pada 15 tabel yang berubah oleh aplikasi (`surat_masuk`, `disposisi`, `lampiran_surat`,
`jadwal_rapat`, `peserta_rapat`, `riwayat_jadwal_rapat`, `surat_keluar`, `lampiran_keluar`, `jenis_surat`,
`master_pengirim`, `master_pejabat`, `master_terusan`, `master_penerima`, `master_pegawai`, `users`) memanggil
`beri_tahu_perubahan()`, yang mengirim `pg_notify('aset_perubahan', '{"tabel":...,"aksi":...,"id":...}')` — hanya
nama tabel, aksinya, dan id barisnya, tidak ada isi surat. Server aplikasi mendengarkan kanal itu dan menyampaikannya
ke peramban lewat `/api/pembaruan`, jadi daftar, kalender, dan layar monitor ikut berubah di tempatnya tanpa penyegar
berkala.

```bash
psql -h <host> -p <port> -U postgres -d agenda_aset -f db/migrate-008-memberi.sql
```

Tanpa `psql`: `npm run migrate:memberi`. Pemicu dibuat oleh superuser `postgres`; `aset_app` hanya diberi `EXECUTE`
atas `beri_tahu_perubahan()`. Pemicu tidak menulis apa pun ke tabel — kalau tidak ada yang mendengarkan kanal itu,
pesan hanya dibuang oleh database. Pemeriksanya: `npm run test:sse`.

## Migrasi 010: kunci layar monitor bisa dibalik

Selama ini kunci layar monitor hanya berasal dari `MONITOR_TOKEN` di `.env` dan tidak bisa diubah dari aplikasi.
Tabel `monitor_token` menyimpan kunci aktif (`db/migrate-010-monitor-token.sql`, dijalankan oleh superuser `postgres`):

```bash
psql -h <host> -p <port> -U postgres -d agenda_aset -f db/migrate-010-monitor-token.sql
```

Tanpa `psql`: `npm run migrate:monitor-token`. Hanya satu baris yang boleh aktif (indeks unik sebagian pada
`aktif`); baris lama tetap disimpan sebagai riwayat dengan `aktif = false`. Administrator membalas kunci di
Pengaturan → Kunci layar monitor; kunci lama berhenti berlaku seketika dan alamat layar di ruang rapat harus
diganti dengan alamat yang ditampilkan di halaman itu. Selama tabel masih kosong, aplikasi memakai
`MONITOR_TOKEN` dari `.env` sebagai kunci awal — setelah rotasi pertama, database yang jadi sumber kebenaran.

## Reapply skema

```bash
psql -d agenda_aset -f db/schema.sql
```

`schema.sql` idempotent terhadap extension saja; jika ingin membangun ulang dari nol:

```bash
psql -c "DROP DATABASE agenda_aset" && psql -c "CREATE DATABASE agenda_aset"
psql -c "ALTER DATABASE agenda_aset SET timezone = 'Asia/Jakarta'"
psql -d agenda_aset -f db/schema.sql
```

## Objek

| Tabel | Fungsi |
|---|---|
| `roles` | 3 peran: Administrator, Petugas Agenda, Pembaca/Pimpinan |
| `users` | Akun login, hash kata sandi di aplikasi |
| `jenis_surat` | Kategori surat (7 nilai awal) |
| `agenda_counter` | Penghitung nomor agenda per tahun |
| `surat_masuk` | Data pokok surat, soft delete lewat `deleted_at` |
| `lampiran_surat` | File scan/lampiran, `path_file` privat, maks 20 MB |
| `disposisi` | Riwayat instruksi, banyak disposisi per surat |
| `jadwal_rapat` | Agenda rapat/kegiatan; `surat_id` kosong berarti agenda mandiri buatan sendiri (`created_by` = pemilik); `terbit` menandai agenda yang boleh tampil di monitor |
| `riwayat_jadwal_rapat` | Jejak perubahan waktu rapat |
| `peserta_rapat` | Peserta per agenda |
| `master_pengirim` | Daftar instansi/pihak pengirim surat (dropdown form surat) |
| `master_pejabat` | Daftar pejabat pemberi disposisi (dropdown form disposisi) |
| `master_terusan` | Daftar tujuan penerusan setelah disposisi terakhir (subid atau orang) |
| `surat_keluar` | Surat yang dikirim Bidang Aset; nomor sendiri dari `keluar_counter`, alur maju `draf → dikirim → selesai` dijaga trigger |
| `lampiran_keluar` | Lampiran surat keluar |
| `master_penerima` | Daftar tujuan surat keluar (instansi/unit atau orang) |
| `keluar_counter` | Penghitung nomor surat keluar per tahun (`KL-001/2026`) |
| `audit_logs` | Log aktivitas append-only |
| `api_token` | Token aplikasi Android; `token_hash` adalah hash SHA-256 token, `expires_at` diperpanjang setiap pemakaian |

View siap pakai untuk dashboard dan rekap:

- `v_surat_aktif` — surat aktif beserta jumlah disposisi, disposisi belum selesai, jumlah rapat, tanggal rapat terdekat, `tahun_terima`
- `v_surat_belum_disposisi` — surat yang belum mendapat disposisi
- `v_disposisi_aktif` — disposisi beserta nomor agenda, perihal surat, tujuan diteruskan, dan tanggal diteruskan
- `v_rapat_aktif` — rapat aktif beserta surat sumber, tidak termasuk yang dibatalkan
- `v_surat_keluar_aktif` — surat keluar aktif beserta jenis, status, tanggal kirim, dan surat asal yang dibalas
- `v_agenda_monitor` — agenda yang dipublish untuk layar monitor: hanya `terbit` dan status aktif (`terjadwal`, `berlangsung`, `dijadwalkan_ulang`)

## Aturan yang dijaga database

- `nomor_agenda` unik; dibuat oleh `next_nomor_agenda(2026)` → `001/2026`, bukan dari jumlah baris
- Rapat bersurat hanya boleh dari surat dengan `status_undangan_rapat = 'ya'` (trigger menolak sisanya); agenda mandiri
  (`surat_id` kosong) tidak diperiksa trigger ini
- Surat yang masih punya rapat aktif tidak bisa diubah menjadi `tidak`
- `tanggal_selesai >= tanggal_mulai` untuk rapat
- `updated_at` otomatis diperbarui oleh trigger
- Penghapusan anak surat (`lampiran`, `disposisi`, `jadwal_rapat`) ditolak → gunakan soft delete

Nilai status:

- `status_undangan_rapat`: `belum`, `ya`, `tidak`
- `status_surat`: `belum_disposisi`, `didisposisikan`, `selesai`, `arsip`
- `status_tindak_lanjut`: `belum`, `proses`, `selesai`, `tidak_perlu`
- `status_rapat`: `terjadwal`, `berlangsung`, `selesai`, `dibatalkan`, `dijadwalkan_ulang`

Makna status surat di aplikasi: `arsip` adalah keputusan petugas (surat sudah selesai tapi tetap terbaca dan tetap
 dihitung di rekap), bukan hasil hitungan — `pulihkan` mengembalikan status ke nilai yang dihitung dari langkah disposisi
 yang tersisa. Surat berstatus `arsip` tertutup di lapisan aplikasi: lampiran, disposisi, peserta, status undangan, dan
 status agenda surat itu ditolak oleh server action sampai surat dikeluarkan dari arsip (tidak ada constraint khusus di
 database).

Penghapusan `jadwal_rapat` ikut menghapus `peserta_rapat` dan `riwayat_jadwal_rapat` (`ON DELETE CASCADE`). Agenda yang
bersumber dari surat dihapus dari detail surat (`hapusAgendaDariSurat`); kalender hanya menghapus agenda tanpa surat.
Menghapus agenda tidak mengubah `status_undangan_rapat` surat sumber. Penghapusan permanen surat membuang baris `surat_masuk`; karena `disposisi.surat_id`,
 `lampiran_surat.surat_id`, dan `jadwal_rapat.surat_id` memakai `ON DELETE RESTRICT`, anak-anak itu harus dibuang dulu
 (peserta dan riwayat rapat ikut terhapus lewat `ON DELETE CASCADE`). Kolom `deleted_at` (soft delete) belum dipakai UI;
 semua view (`v_surat_aktif`, `v_disposisi_aktif`, rapat) menyaring `deleted_at IS NULL`.

Pencarian teks cepat memakai indeks GIN `pg_trgm` pada `perihal` dan `agenda_rapat`.

## Nomor agenda dan nomor surat keluar

Nomor dibuat oleh fungsi di database (`next_nomor_agenda`, `next_nomor_keluar`) yang mengambil nilai dari
`agenda_counter` / `keluar_counter`. Dua cacat diperbaiki di `db/migrate-013-nomor-tahan.sql` (`npm run migrate:nomor`,
superuser `postgres`):

- `lpad(v_no::text, 3, '0')` memotong angka yang sudah 4 digit: `lpad('5029', 3)` = `'502'`, jadi surat ke-5029
  keluar sebagai `502/2026` dan bentrok dengan data hasil impor (`P2002` pada `nomor_agenda`). Angka di atas 999
  sekarang dipakai apa adanya; angka di bawah 1000 tetap tiga digit.
- Data starter hasil impor punya nomor 502..5028 untuk 2026 sementara counter bisa masih di bawah itu. Nilai baru
  sekarang `GREATEST(counter + 1, nomor terbesar yang ada + 1)`, jadi nomor baru selalu di atas semua nomor yang ada.

Tidak ada baris surat yang diubah atau dihapus oleh migrasi ini. Nomor surat keluar tetap berbentuk `KL-001/2026`;
nomor unik yang diketik petugas (bukan bentuk itu) tidak ikut dihitung sebagai maksimal.
