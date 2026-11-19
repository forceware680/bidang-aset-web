# Deploy ke Coolify

## Konfigurasi app di Coolify

| Setelan | Nilai |
|---|---|
| Source | repositori GitHub ini |
| Build method | Dockerfile (path `Dockerfile`, base directory root) |
| Port internal | 3000 |
| Domain | isi domain kamu, misalnya `agenda.asetmagelang.id` |

**Environment variables yang wajib diisi di Coolify:**

```
DATABASE_URL=postgres://aset_app:<kata sandi>@<host>:<port>/agenda_aset
SESSION_SECRET=<string acak panjang, buat sendiri>
MONITOR_TOKEN=<string acak panjang, kunci alamat layar monitor>
```

`MONITOR_TOKEN` dipakai halaman `/monitor` — layar yang dipasang di TV di depan ruangan Bidang Aset. Alamat layarnya
`https://<domain>/monitor?t=<kunci>`; tanpa kunci hanya gerbang yang tampil, tidak ada angka surat. Env ini hanya jadi
kunci awal: setelah migrasi `db/migrate-010-monitor-token.sql` (`npm run migrate:monitor-token` sebagai superuser),
Administrator bisa membalas kunci dari Pengaturan → Kunci layar monitor, dan kunci aktif berasal dari tabel
`monitor_token`. Setelah kunci dibalik, alamat TV harus diganti dengan alamat baru yang ditampilkan di halaman itu;
kunci lama berhenti berlaku seketika. Tanpa env dan tanpa baris di tabel, layar menyatakan "Monitor belum dikonfigurasi".

`.env` tidak ikut ke dalam image (`.dockerignore` mengecualikannya), jadi kredensial hanya berasal dari environment Coolify.

**Volume yang wajib dipetakan:** `/app/uploads`. Folder ini menyimpan berkas lampiran surat. Tanpa volume, semua lampiran hilang setiap kali image di-rebuild.

**Aset statis:** logo ada di `public/logo.png` dan `public/logo-cetak.png`. Next standalone tidak menyalin folder `public`, jadi Dockerfile menyalinnya terpisah — jangan dihapus dari `.dockerignore`/Dockerfile.

Health check memakai `GET /login` (halaman ini selalu 200 tanpa login).

**Versi Prisma:** Dockerfile menjalankan `npx prisma generate` sebelum build. CLI Prisma harus tetap **6.19.3** (sama dengan
`@prisma/client`): Prisma 7 menolak `url` di blok `datasource` pada `prisma/schema.prisma` (error P1012) sehingga build
Docker gagal. Kalau suatu saat perlu naik ke Prisma 7, skema harus diubah (generator `prisma-client`, URL pindah ke
`prisma.config.ts`, `lib/db.ts` memakai adapter).

## Database

Dua pilihan, keduanya kompatibel dengan aplikasi:

1. **PostgreSQL yang sekarang** di `<server>:<port>`, database `agenda_aset`, akun `aset_app`. Coolify hanya menjalankan aplikasi, database tetap di sana.
2. **PostgreSQL service di Coolify.** Setelah service jalan, terapkan skema lalu buat akun pertama (perintah di bawah dijalankan dari dalam container aplikasi karena image punya `psql`).

```bash
# Terapkan skema sekali saja pada database kosong.
psql "$DATABASE_URL" -f db/schema.sql

# Buat akun administrator pertama. Perhatikan tanda kutip pada --role.
node scripts/add-user.mjs --email=petugas@magelang.go.id --name="Petugas Aset" --password="kata sandi minimal 8 karakter" --role="Administrator"
```

`db/schema.sql` bukan skrip yang bisa dijalankan berulang: tabel dibuat dengan `IF NOT EXISTS`, tetapi view dibuat dengan `CREATE VIEW` biasa dan fungsi/trigger dibuat sekali. Untuk database yang sudah pernah diisi skema, jangan jalankan ulang file itu; kalau perlu meregenerasi view, drop view dulu (`DROP VIEW v_surat_aktif;` lalu jalankan bagian view saja). Timezone `Asia/Jakarta` dan `search_path` diset pada level database `agenda_aset` oleh skema.

Database yang sudah ada sebelum fitur daftar nama perlu migrasi sekali (jalankan sebagai `postgres`, bukan `aset_app`):

```bash
psql "postgres://postgres:<kata sandi postgres>@<host>:<port>/agenda_aset" -f db/migrate-002-master-nama.sql
psql "$DATABASE_URL" -f db/seed-002-nama.sql
```

Migrasi ini menambah tabel `master_pengirim`/`master_pejabat`/`master_terusan`, kolom `disposisi.tanggal_diteruskan`,
membuat ulang `v_disposisi_aktif`, dan memberi hak akses ke `aset_app`. Seed memakai `ON CONFLICT DO NOTHING` sehingga
aman diulang; database baru dari `db/schema.sql` hanya perlu seed.

Dua migrasi berikutnya juga dijalankan sekali sebagai `postgres` (idempoten, boleh diulang):

```bash
psql "postgres://postgres:<kata sandi postgres>@<host>:<port>/agenda_aset" -f db/migrate-003-agenda-mandiri.sql
psql "postgres://postgres:<kata sandi postgres>@<host>:<port>/agenda_aset" -f db/migrate-004-surat-keluar.sql
psql "$DATABASE_URL" -f db/seed-003-surat-keluar.sql
```

Migrasi 003 membuat `jadwal_rapat.surat_id` boleh kosong (agenda mandiri). Migrasi 004 menambah surat keluar:
tabel `surat_keluar`, `lampiran_keluar`, `master_penerima`, `keluar_counter`, kolom `jenis_surat.arah`, fungsi
`next_nomor_keluar()` (nomor `KL-001/2026`), trigger alur status maju, view `v_surat_keluar_aktif`, dan hak akses
`aset_app`. Tanpa migrasi 004, halaman `/keluar` gagal dengan "table does not exist".

## Verifikasi yang sudah dilakukan

- `npm run build` dengan `output: "standalone"` menghasilkan `.next/standalone/server.js` yang bisa dijalankan sendiri: `/login` mengembalikan 200, `/` mengembalikan 307 ke `/login`.
- **`npm run start` tidak bisa dipakai untuk uji lokal** karena proyek memakai `output: "standalone"` (Next mencetak peringatan
  `"next start" does not work with "output: standalone"`). Di mode itu server actions tidak mengarahkan ulang halaman: surat
  tersimpan di database tapi URL tetap di `/surat/baru`. Untuk meniru container di laptop: `npm run build` lalu
  `cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public && node .next/standalone/server.js`
  — dengan itu submit surat mengarah ke `/surat/[id]?ok=1` dan uji klik berjalan bersih.
- `scripts/add-user.mjs` dijalankan tanpa `.env` (kredensial dari environment) berhasil membuat akun — ini pola yang dipakai di container.
- Build Docker belum dijalankan di laptop ini karena Docker tidak terpasang di sini; image pertama kali akan dibuild oleh Coolify. Kalau ada kegagalan build, periksa log build Coolify dan kirimkan pesan errornya ke saya.
- Build pertama di Coolify gagal karena base image ditulis `node:24-slim-bookworm` — tag itu tidak ada di Docker Hub. Yang benar `node:24-bookworm-slim` (sudah diperbaiki di `Dockerfile`, kedua stage). Tag resmi node 24: `24`, `24-slim`, `24-bookworm`, `24-bookworm-slim`, `24-trixie`, `24-trixie-slim`, `24-alpine`.

## Catatan runtime

- Lampiran dibatasi PDF/JPG/PNG sampai 20 MB; batas body server action sudah dinaikkan ke 25 MB di `next.config.ts`.
- Aplikasi tidak memakai Redis atau queue; hanya Next server tunggal dan PostgreSQL.
- Kalau Coolify menempatkan aplikasi di belakang proxy dengan path prefix, `HOSTNAME=0.0.0.0` sudah diset di image; tidak ada konfigurasi base path yang dibutuhkan saat ini.

## Rantai sertifikat TLS (penting untuk aplikasi Android)

`https://<domain-anda>` sekarang menyajikan sertifikat Let's Encrypt yang berakar **ISRG Root YR**. Peramban
desktop menerima rantai itu, tetapi daftar CA Android 14 hanya berisi ISRG Root X1 dan X2 — aplikasi Android
awalnya gagal konek dengan "Koneksi ke server <domain-anda> gagal" meskipun situs hidup. Cek dari laptop:

```bash
echo | openssl s_client -connect <domain-anda>:443 -servername <domain-anda> -showcerts 2>/dev/null \
  | grep -E "^ [0-9] s:|Verify return code"
```

Kalau rantai terakhir masih `CN=Root YR`, minta rantai berakar **ISRG Root X1** (mis. `--preferred-chain "ISRG Root
X1"` pada penerbit sertifikat, atau CA lain seperti ZeroSSL). Sementara itu aplikasi Android sudah memuat akar YR
tambahan (`lib/root_yr.dart` di repo `bidang-aset-android`), jadi HP tetap bisa dipakai. Setelah rantai X1 terpasang,
akar tambahan itu boleh dihapus dari aplikasi.
