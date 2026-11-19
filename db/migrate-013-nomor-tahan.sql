-- Migrasi 013: penghitung nomor agenda dan nomor surat keluar diperbaiki.
--
-- Dua masalah sekaligus:
--  1. `lpad(v_no::text, 3, '0')` MEMOTONG angka yang sudah lebih dari 3 digit: lpad('5029', 3)
--     menghasilkan '502'. Nomor agenda ke-5029 keluar sebagai "502/2026" lalu bentrok dengan data
--     hasil impor → P2002 "Unique constraint failed on the fields: (nomor_agenda)". Angka di atas
--     999 sekarang dipakai apa adanya, angka di bawah 1000 tetap tiga digit.
--  2. Data starter hasil impor (1606 surat masuk) punya nomor 502..5028 untuk tahun 2026, sementara
--     agenda_counter bisa masih di bawah angka itu karena counter tidak ikut diisi saat impor.
--     Nilai baru sekarang GREATEST(counter + 1, nomor terbesar yang ada + 1).
-- Tidak ada baris surat yang diubah atau dihapus. Jalankan sebagai postgres: npm run migrate:nomor

BEGIN;

CREATE OR REPLACE FUNCTION next_nomor_agenda(p_tahun integer) RETURNS varchar AS $$
DECLARE
  v_no integer;
  v_maks integer;
BEGIN
  -- Hanya nomor buatan sistem (bentuk 001/2026) yang ikut dihitung supaya nomor unik ketikan
  -- petugas tidak merusak nilai maksimal.
  SELECT COALESCE(max(split_part(nomor_agenda, '/', 1)::integer), 0) INTO v_maks
  FROM surat_masuk
  WHERE split_part(nomor_agenda, '/', 2) = p_tahun::text
    AND nomor_agenda ~ '^[0-9]+/[0-9]+$';

  INSERT INTO agenda_counter (tahun, nomor_terakhir)
  VALUES (p_tahun, GREATEST(v_maks + 1, 1))
  ON CONFLICT (tahun) DO UPDATE
  SET nomor_terakhir = GREATEST(agenda_counter.nomor_terakhir + 1, v_maks + 1)
  RETURNING nomor_terakhir INTO v_no;

  RETURN CASE WHEN v_no < 1000 THEN lpad(v_no::text, 3, '0') ELSE v_no::text END || '/' || p_tahun::text;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION next_nomor_keluar(p_tahun integer) RETURNS varchar AS $$
DECLARE
  v_no integer;
  v_maks integer;
BEGIN
  SELECT COALESCE(max(split_part(split_part(nomor_surat, '/', 1), '-', 2)::integer), 0) INTO v_maks
  FROM surat_keluar
  WHERE split_part(nomor_surat, '/', 2) = p_tahun::text
    AND nomor_surat ~ '^KL-[0-9]+/[0-9]+$';

  INSERT INTO keluar_counter (tahun, nomor_terakhir)
  VALUES (p_tahun, GREATEST(v_maks + 1, 1))
  ON CONFLICT (tahun) DO UPDATE
  SET nomor_terakhir = GREATEST(keluar_counter.nomor_terakhir + 1, v_maks + 1)
  RETURNING nomor_terakhir INTO v_no;

  RETURN 'KL-' || CASE WHEN v_no < 1000 THEN lpad(v_no::text, 3, '0') ELSE v_no::text END || '/' || p_tahun::text;
END;
$$ LANGUAGE plpgsql;

COMMIT;
