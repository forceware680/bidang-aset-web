-- Migrasi 012: tautan unduh APK Android — tombol "Unduh APK" di pojok kiri atas halaman login.
-- Satu baris (id 'tunggal'); diatur lewat Pengaturan > Perangkat. Kalau belum ada, tombol tidak tampil.
-- Jalankan sebagai superuser: psql -h <host> -p <port> -U postgres -d agenda_aset -f db/migrate-012-apk-unduh.sql
BEGIN;

CREATE TABLE IF NOT EXISTS apk_unduh (
  id          text PRIMARY KEY DEFAULT 'tunggal',
  url         text NOT NULL,
  diubah_oleh uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_touch_apk_unduh ON apk_unduh;
CREATE TRIGGER trg_touch_apk_unduh
  BEFORE UPDATE ON apk_unduh
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON apk_unduh TO aset_app;

COMMIT;
