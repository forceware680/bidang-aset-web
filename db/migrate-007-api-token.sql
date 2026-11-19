-- Migrasi 007: token untuk aplikasi Android (API kalender + agenda sendiri).
-- Aplikasi Android masuk dengan email + kata sandi yang sama dengan aplikasi web, lalu menyimpan token
-- pembawa (Bearer). Token disimpan sebagai hash SHA-256, bukan aslinya: yang bocor dari perangkat bukan
-- kata sandi dan bukan token yang bisa dipakai ulang kalau hash-nya diketahui.
-- Hanya kalender dan agenda milik sendiri yang dibaca/diubah lewat API — surat, disposisi, surat keluar,
-- lampiran, dan rekap tetap hanya lewat aplikasi web.
-- Jalankan sebagai postgres: npm run migrate:api

BEGIN;

CREATE TABLE IF NOT EXISTS api_token (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash     text NOT NULL UNIQUE,
  perangkat      varchar(60),
  created_at     timestamptz NOT NULL DEFAULT now(),
  terakhir_pakai timestamptz,
  expires_at     timestamptz NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_token_user ON api_token (user_id, expires_at);

CREATE TRIGGER trg_touch_api_token
  BEFORE UPDATE ON api_token
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON api_token TO aset_app;

COMMIT;
