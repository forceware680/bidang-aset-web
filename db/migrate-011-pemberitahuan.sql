-- Migrasi 011: pemberitahuan peserta (bel notifikasi di aplikasi Android).
-- Saat seseorang menambahkan peserta ke sebuah agenda dari web, satu baris dicatat di sini dengan nama
-- pembuat ("oleh"). Aplikasi Android membaca lewat /api/pemberitahuan dan menampilkan notifikasi untuk
-- akun yang namanya cocok longgar dengan nama_peserta (cocok yang sama dengan aturan `ikut` di kalender).
-- Baris dibiarkan sebagai riwayat; kalau agenda dihapus, baris pemberitahuan ikut terhapus (cascade).
-- Jalankan sebagai postgres: npm run migrate:pemberitahuan

BEGIN;

CREATE TABLE IF NOT EXISTS pemberitahuan_peserta (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rapat_id     uuid NOT NULL REFERENCES jadwal_rapat (id) ON DELETE CASCADE,
  nama_peserta varchar(200) NOT NULL,
  oleh         varchar(150) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pemberitahuan_peserta_rapat ON pemberitahuan_peserta (rapat_id);
CREATE INDEX IF NOT EXISTS idx_pemberitahuan_peserta_created ON pemberitahuan_peserta (created_at);

GRANT SELECT, INSERT ON pemberitahuan_peserta TO aset_app;

COMMIT;
