-- Migrasi 002: daftar nama resmi + langkah "diteruskan"
-- Dijalankan oleh superuser postgres (aset_app tidak punya hak CREATE/ALTER).
-- Idempoten: boleh dijalankan berulang.

BEGIN;

-- ---------- Daftar nama resmi ----------

CREATE TABLE IF NOT EXISTS master_pengirim (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama       varchar(200) NOT NULL UNIQUE,
  aktif      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS master_pejabat (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama       varchar(200) NOT NULL UNIQUE,
  jabatan    varchar(120),
  aktif      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS master_terusan (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama       varchar(200) NOT NULL UNIQUE,
  jenis      varchar(10) NOT NULL DEFAULT 'unit'
    CHECK (jenis IN ('unit', 'orang')),
  aktif      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_pengirimaktif ON master_pengirim (aktif, nama);
CREATE INDEX IF NOT EXISTS idx_master_pejabat_aktif ON master_pejabat (aktif, nama);
CREATE INDEX IF NOT EXISTS idx_master_terusan_aktif ON master_terusan (aktif, jenis, nama);

DROP TRIGGER IF EXISTS trg_touch_master_pengirim ON master_pengirim;
CREATE TRIGGER trg_touch_master_pengirim BEFORE UPDATE ON master_pengirim
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_master_pejabat ON master_pejabat;
CREATE TRIGGER trg_touch_master_pejabat  BEFORE UPDATE ON master_pejabat
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_master_terusan ON master_terusan;
CREATE TRIGGER trg_touch_master_terusan  BEFORE UPDATE ON master_terusan
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------- Diteruskan ----------
-- Dalam lembar agenda asli, satu surat bisa mendapat beberapa disposisi berantai.
-- Penerima hanya ada pada langkah yang meneruskan surat ke pemegang terakhir,
-- jadi penerima boleh kosong dan punya tanggal tersendiri.

ALTER TABLE disposisi ALTER COLUMN penerima_disposisi DROP NOT NULL;
ALTER TABLE disposisi ADD COLUMN IF NOT EXISTS tanggal_diteruskan date;
CREATE INDEX IF NOT EXISTS idx_disposisi_tanggal_diteruskan ON disposisi (tanggal_diteruskan DESC);

-- View disposisi ikut membawa tanggal diteruskan.
DROP VIEW IF EXISTS v_disposisi_aktif;
CREATE VIEW v_disposisi_aktif AS
SELECT
  d.id,
  d.surat_id,
  s.nomor_agenda,
  s.perihal,
  d.tanggal_disposisi,
  d.pemberi_disposisi,
  d.penerima_disposisi,
  d.tanggal_diteruskan,
  d.isi_disposisi,
  d.status_tindak_lanjut,
  d.catatan
FROM disposisi d
JOIN surat_masuk s ON s.id = d.surat_id AND s.deleted_at IS NULL;

-- ---------- Hak akses aset_app ----------
-- View dibuat ulang di atas, jadi hak SELECT view diberikan lagi.
GRANT SELECT ON v_disposisi_aktif TO aset_app;

-- Nama lama tetap tersimpan sebagai teks di disposisi/surat, jadi tabel ini
-- hanya daftar pilihan; aplikasi tidak menghapus nama (histori tidak rusak).
GRANT SELECT, INSERT, UPDATE ON master_pengirim TO aset_app;
GRANT SELECT, INSERT, UPDATE ON master_pejabat  TO aset_app;
GRANT SELECT, INSERT, UPDATE ON master_terusan  TO aset_app;

-- DELETE hanya untuk membereskan data uji di scripts/uji; kode aplikasi tidak menghapus nama.
-- Bila ingin kembali ke desain awal: REVOKE DELETE ON master_pengirim, master_pejabat, master_terusan FROM aset_app;
GRANT DELETE ON master_pengirim TO aset_app;
GRANT DELETE ON master_pejabat  TO aset_app;
GRANT DELETE ON master_terusan  TO aset_app;

COMMIT;
