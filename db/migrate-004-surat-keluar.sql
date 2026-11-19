-- Migrasi 004: surat keluar.
-- Dijalankan oleh superuser postgres (aset_app tidak punya hak CREATE/ALTER):
--   psql -h <host> -p <port> -U postgres -d agenda_aset -f db/migrate-004-surat-keluar.sql
-- Berkas idempoten: boleh dijalankan berulang.

BEGIN;

-- Satu tabel klasifikasi untuk dua arah surat; surat masuk lama tetap 'masuk'.
ALTER TABLE jenis_surat
  ADD COLUMN IF NOT EXISTS arah varchar(10) NOT NULL DEFAULT 'masuk'
    CHECK (arah IN ('masuk', 'keluar'));

-- ---------- Daftar tujuan surat keluar ----------

CREATE TABLE IF NOT EXISTS master_penerima (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama       varchar(200) NOT NULL UNIQUE,
  jenis      varchar(10) NOT NULL DEFAULT 'unit'
    CHECK (jenis IN ('unit', 'orang')),
  aktif      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_penerima_aktif ON master_penerima (aktif, jenis, nama);

DROP TRIGGER IF EXISTS trg_touch_master_penerima ON master_penerima;
CREATE TRIGGER trg_touch_master_penerima
  BEFORE UPDATE ON master_penerima
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------- Penghitung nomor surat keluar ----------
-- Terpisah dari agenda_counter supaya nomor surat keluar tidak menyelingi nomor agenda surat masuk.

CREATE TABLE IF NOT EXISTS keluar_counter (
  tahun          integer PRIMARY KEY CHECK (tahun BETWEEN 2000 AND 2100),
  nomor_terakhir integer NOT NULL DEFAULT 0 CHECK (nomor_terakhir >= 0)
);

CREATE OR REPLACE FUNCTION next_nomor_keluar(p_tahun integer) RETURNS varchar AS $$
DECLARE
  v_no integer;
BEGIN
  INSERT INTO keluar_counter (tahun, nomor_terakhir)
  VALUES (p_tahun, 1)
  ON CONFLICT (tahun) DO UPDATE
  SET nomor_terakhir = keluar_counter.nomor_terakhir + 1
  RETURNING nomor_terakhir INTO v_no;
  RETURN 'KL-' || lpad(v_no::text, 3, '0') || '/' || p_tahun::text;
END;
$$ LANGUAGE plpgsql;

-- ---------- Data pokok surat keluar ----------
-- nomor_surat adalah penanda utama surat keluar (auto 'KL-001/2026', boleh dikoreksi petugas).
-- surat_asal_id menautkan surat ke surat masuk yang dibalas; surat asal boleh dihapus tanpa
-- memutus surat keluar (ON DELETE SET NULL).

CREATE TABLE IF NOT EXISTS surat_keluar (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_surat          varchar(150) NOT NULL UNIQUE,
  tanggal_surat        date NOT NULL,
  tujuan               varchar(200) NOT NULL,
  perihal              varchar(500) NOT NULL,
  isi_ringkas          text,
  jenis_surat_id       uuid REFERENCES jenis_surat (id) ON DELETE RESTRICT,
  surat_asal_id        uuid REFERENCES surat_masuk (id) ON DELETE SET NULL,
  status_surat         varchar(20) NOT NULL DEFAULT 'draf'
    CHECK (status_surat IN ('draf', 'dikirim', 'selesai', 'arsip')),
  status_sebelum_arsip varchar(20) CHECK (status_sebelum_arsip IN ('draf', 'dikirim', 'selesai')),
  tanggal_kirim        timestamptz,
  catatan              text,
  created_by           uuid REFERENCES users (id) ON DELETE RESTRICT,
  updated_by           uuid REFERENCES users (id) ON DELETE RESTRICT,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

CREATE INDEX IF NOT EXISTS idx_keluar_tanggal     ON surat_keluar (tanggal_surat DESC);
CREATE INDEX IF NOT EXISTS idx_keluar_tujuan      ON surat_keluar (tujuan);
CREATE INDEX IF NOT EXISTS idx_keluar_perihal_trgm ON surat_keluar USING gin (perihal gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_keluar_jenis       ON surat_keluar (jenis_surat_id);
CREATE INDEX IF NOT EXISTS idx_keluar_asal        ON surat_keluar (surat_asal_id);
CREATE INDEX IF NOT EXISTS idx_keluar_status      ON surat_keluar (status_surat);
CREATE INDEX IF NOT EXISTS idx_keluar_live        ON surat_keluar (tanggal_surat DESC) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_touch_keluar ON surat_keluar;
CREATE TRIGGER trg_touch_keluar
  BEFORE UPDATE ON surat_keluar
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Surat yang sudah dikirim tidak boleh kembali ke draf, dan yang sudah selesai tidak boleh
-- kembali ke dikirim. Keluar dari arsip tidak diperiksa: statusnya dipulihkan dari
-- status_sebelum_arsip oleh aplikasi.
CREATE OR REPLACE FUNCTION chk_keluar_status_maju() RETURNS trigger AS $$
BEGIN
  IF NEW.status_surat = 'draf' AND OLD.status_surat IN ('dikirim', 'selesai') THEN
    RAISE EXCEPTION 'Surat % sudah dikirim, tidak bisa kembali menjadi draf', OLD.nomor_surat;
  END IF;
  IF NEW.status_surat = 'dikirim' AND OLD.status_surat = 'selesai' THEN
    RAISE EXCEPTION 'Surat % sudah selesai, tidak bisa kembali menjadi dikirim', OLD.nomor_surat;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_keluar_status_maju ON surat_keluar;
CREATE TRIGGER trg_keluar_status_maju
  BEFORE UPDATE OF status_surat ON surat_keluar
  FOR EACH ROW EXECUTE FUNCTION chk_keluar_status_maju();

-- 'dikirim' selalu menyertai waktu kirim; bila petugas belum menuliskan waktunya, database mengisinya.
CREATE OR REPLACE FUNCTION isi_tanggal_kirim() RETURNS trigger AS $$
BEGIN
  IF NEW.status_surat = 'dikirim' AND NEW.tanggal_kirim IS NULL THEN
    NEW.tanggal_kirim := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_keluar_tanggal_kirim ON surat_keluar;
CREATE TRIGGER trg_keluar_tanggal_kirim
  BEFORE UPDATE ON surat_keluar
  FOR EACH ROW EXECUTE FUNCTION isi_tanggal_kirim();

-- ---------- Lampiran surat keluar ----------

CREATE TABLE IF NOT EXISTS lampiran_keluar (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surat_id    uuid NOT NULL REFERENCES surat_keluar (id) ON DELETE RESTRICT,
  nama_asli   varchar(255) NOT NULL,
  path_file   text NOT NULL,
  mime_type   varchar(100) NOT NULL,
  ukuran_byte bigint NOT NULL CHECK (ukuran_byte > 0 AND ukuran_byte <= 20971520),
  uploaded_by uuid REFERENCES users (id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lampiran_keluar ON lampiran_keluar (surat_id);

-- ---------- View untuk daftar, dashboard, dan rekap ----------

CREATE OR REPLACE VIEW v_surat_keluar_aktif AS
SELECT
  k.id,
  k.nomor_surat,
  k.tanggal_surat,
  EXTRACT(year FROM k.tanggal_surat) AS tahun_surat,
  k.tujuan,
  k.perihal,
  k.isi_ringkas,
  k.catatan,
  j.nama AS jenis_surat,
  k.jenis_surat_id,
  k.status_surat,
  k.status_sebelum_arsip,
  k.tanggal_kirim,
  k.surat_asal_id,
  s.nomor_agenda AS nomor_asal,
  s.perihal AS perihal_asal,
  count(l.id) AS jumlah_lampiran
FROM surat_keluar k
LEFT JOIN jenis_surat j  ON j.id = k.jenis_surat_id
LEFT JOIN surat_masuk s  ON s.id = k.surat_asal_id AND s.deleted_at IS NULL
LEFT JOIN lampiran_keluar l ON l.surat_id = k.id
WHERE k.deleted_at IS NULL
GROUP BY k.id, k.nomor_surat, k.tanggal_surat, k.tujuan, k.perihal, k.isi_ringkas, k.catatan,
         j.nama, k.jenis_surat_id, k.status_surat, k.status_sebelum_arsip, k.tanggal_kirim,
         k.surat_asal_id, s.nomor_agenda, s.perihal;

-- ---------- Hak akses akun aplikasi ----------

GRANT SELECT, INSERT, UPDATE, DELETE ON surat_keluar, lampiran_keluar, master_penerima, keluar_counter TO aset_app;
GRANT SELECT ON v_surat_keluar_aktif TO aset_app;
GRANT EXECUTE ON FUNCTION next_nomor_keluar(integer) TO aset_app;
-- DELETE khusus untuk skrip uji yang membereskan data uji; kode aplikasi tidak menghapus surat keluar.
GRANT DELETE ON surat_keluar, lampiran_keluar, master_penerima TO aset_app;

COMMIT;
