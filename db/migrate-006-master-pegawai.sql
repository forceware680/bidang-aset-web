-- Migrasi 006: daftar pegawai Bidang Aset untuk autocomplete nama peserta rapat.
-- Nama peserta rapat dulu diketik bebas dari satu isian; sekarang petugas memilih dari daftar pegawai
-- dan bisa menambahkan beberapa nama sekaligus. Isian "instansi atau bidang" dihapus dari formulir karena
-- peserta dari daftar ini selalu milik BPKAD - Bidang Aset.
-- Jalankan sebagai postgres: npm run migrate:pegawai

BEGIN;

CREATE TABLE IF NOT EXISTS master_pegawai (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama       varchar(200) NOT NULL UNIQUE,
  jabatan    varchar(120),
  aktif      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_pegawai_aktif ON master_pegawai (aktif, nama);

CREATE TRIGGER trg_touch_master_pegawai
  BEFORE UPDATE ON master_pegawai
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON master_pegawai TO aset_app;

-- Isi awal diambil dari daftar pemberi disposisi supaya autocomplete langsung punya nama.
INSERT INTO master_pegawai (nama, jabatan)
SELECT p.nama, p.jabatan FROM master_pejabat p
ON CONFLICT (nama) DO NOTHING;

COMMIT;
