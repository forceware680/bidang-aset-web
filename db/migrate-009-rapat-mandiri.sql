-- Migrasi 009: agenda mandiri ikut dihitung dalam statistik rapat.
--
-- `v_rapat_aktif` dulu memakai JOIN surat_masuk, jadi agenda rapat yang dibuat sendiri (tanpa surat,
-- kolom surat_id kosong) tidak masuk ke "rapat bulan ini" di layar monitor maupun ke grafik rapat per
-- bulan di Rekap. LEFT JOIN membuat agenda tanpa surat tetap terhitung, dan surat yang sudah dihapus
-- tidak lagi ikut terbaca.

CREATE OR REPLACE VIEW v_rapat_aktif AS
SELECT
  r.id,
  r.surat_id,
  s.nomor_agenda,
  s.pengirim AS sumber_surat,
  r.agenda_rapat,
  r.penyelenggara,
  r.tanggal_mulai,
  r.tanggal_selesai,
  r.tempat,
  r.tautan_rapat,
  r.status_rapat,
  count(p.id) AS jumlah_peserta
FROM jadwal_rapat r
LEFT JOIN surat_masuk s ON s.id = r.surat_id AND s.deleted_at IS NULL
LEFT JOIN peserta_rapat p ON p.rapat_id = r.id
WHERE r.status_rapat <> 'dibatalkan'
GROUP BY r.id, r.surat_id, s.nomor_agenda, s.pengirim, r.agenda_rapat,
         r.penyelenggara, r.tanggal_mulai, r.tanggal_selesai, r.tempat,
         r.tautan_rapat, r.status_rapat;

GRANT SELECT ON v_rapat_aktif TO aset_app;

-- Agenda yang dibatalkan tetap boleh dibaca monitor (yang disembunyikan dan yang sudah selesai tetap luar).
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
  AND r.status_rapat IN ('terjadwal', 'berlangsung', 'dijadwalkan_ulang', 'dibatalkan');

GRANT SELECT ON v_agenda_monitor TO aset_app;
