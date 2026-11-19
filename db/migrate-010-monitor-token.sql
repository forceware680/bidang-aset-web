-- Migrasi 010: kunci layar monitor bisa dibalik dari Pengaturan.
-- Selama ini kunci hanya berasal dari MONITOR_TOKEN di .env dan tidak bisa diubah dari aplikasi.
-- Tabel ini menyimpan kunci aktif; kalau kunci dibalik, kunci lama berhenti berlaku seketika dan
-- layar di ruang rapat harus memakai alamat baru (/monitor?t=kunci-baru).
-- Kalau tabel masih kosong, aplikasi tetap memakai MONITOR_TOKEN dari .env sebagai kunci awal.
-- Hanya satu baris boleh aktif (indeks unik sebagian). Baris lama disimpan sebagai riwayat.
-- Jalankan sebagai postgres: npm run migrate:monitor-token

BEGIN;

CREATE TABLE IF NOT EXISTS monitor_token (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text NOT NULL UNIQUE,
  aktif       boolean NOT NULL DEFAULT true,
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  dibuat_oleh uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monitor_token_aktif ON monitor_token (aktif) WHERE aktif;

CREATE TRIGGER trg_touch_monitor_token
  BEFORE UPDATE ON monitor_token
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON monitor_token TO aset_app;

COMMIT;
