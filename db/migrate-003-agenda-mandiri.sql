-- Migrasi 003: agenda bisa dibuat tanpa surat masuk (pengingat pribadi pejabat).
-- Jalankan sebagai superuser: psql -h <server> -p <port> -U postgres -d agenda_aset -f db/migrate-003-agenda-mandiri.sql

BEGIN;

-- Agenda mandiri: tidak punya surat sumber.
ALTER TABLE jadwal_rapat ALTER COLUMN surat_id DROP NOT NULL;

-- Trigger hanya memeriksa surat sumber kalau surat_id memang diisi.
CREATE OR REPLACE FUNCTION chk_rapat_sumber_undangan() RETURNS trigger AS $$
DECLARE
  v_status varchar(20);
BEGIN
  IF NEW.surat_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status_undangan_rapat INTO v_status FROM surat_masuk WHERE id = NEW.surat_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Surat sumber % tidak ditemukan atau sudah dihapus', NEW.surat_id;
  ELSIF v_status <> 'ya' THEN
    RAISE EXCEPTION 'Surat sumber belum berstatus undangan rapat (status: %)', v_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Pemegang agenda (untuk hak mengubah/menghapus miliknya sendiri).
CREATE INDEX IF NOT EXISTS idx_rapat_created_by ON jadwal_rapat (created_by);

COMMIT;
