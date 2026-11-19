-- Migrasi 005: publikasi monitor (layar di depan ruangan Bidang Aset).
-- Agenda bisa dipilih mana yang boleh tampil di monitor lewat kolom `terbit`; statistik angka selalu otomatis
-- (tidak ada surat yang "dipublish" terpisah — yang dihitung adalah yang bukan arsip).
-- Jalankan sebagai postgres: npm run migrate:monitor

BEGIN;

ALTER TABLE jadwal_rapat ADD COLUMN IF NOT EXISTS terbit boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_rapat_terbit
  ON jadwal_rapat (tanggal_mulai)
  WHERE terbit AND status_rapat IN ('terjadwal', 'berlangsung', 'dijadwalkan_ulang');

-- Agenda yang layak tampil di monitor: yang dipublish dan masih aktif (yang dibatalkan tidak muncul).
CREATE OR REPLACE VIEW v_agenda_monitor AS
SELECT
  r.id,
  r.agenda_rapat,
  r.penyelenggara,
  r.tanggal_mulai,
  r.tanggal_selesai,
  r.tempat,
  r.status_rapat,
  r.surat_id,
  s.nomor_agenda,
  s.perihal,
  s.pengirim,
  d.pemberi_disposisi
FROM jadwal_rapat r
LEFT JOIN surat_masuk s ON s.id = r.surat_id
LEFT JOIN disposisi d
  ON d.id = (SELECT dd.id FROM disposisi dd WHERE dd.surat_id = r.surat_id ORDER BY dd.tanggal_disposisi DESC LIMIT 1)
WHERE r.terbit
  AND r.status_rapat IN ('terjadwal', 'berlangsung', 'dijadwalkan_ulang');

GRANT SELECT ON v_agenda_monitor TO aset_app;
-- Hanya kolom terbit yang boleh diubah akun aplikasi; kolom lain tetap lewat aksi biasa.
GRANT UPDATE (terbit) ON jadwal_rapat TO aset_app;

COMMIT;
