-- Seed surat keluar: klasifikasi surat keluar dan daftar tujuan resmi.
-- INSERT ... ON CONFLICT DO NOTHING: boleh dijalankan berulang, boleh oleh aset_app.

INSERT INTO jenis_surat (nama, arah) VALUES
  ('Surat Balasan', 'keluar'),
  ('Surat Undangan Keluar', 'keluar'),
  ('Surat Pengantar Keluar', 'keluar'),
  ('Nota Dinas Keluar', 'keluar'),
  ('Permohonan Keluar', 'keluar'),
  ('Lainnya (keluar)', 'keluar')
ON CONFLICT (nama) DO NOTHING;

-- Tujuan surat keluar: SKPD yang sering dibalas + pihak eksternal. Nama lain ditambahkan lewat
-- Pengaturan -> Daftar nama -> Daftar tujuan surat keluar.
INSERT INTO master_penerima (nama, jenis) VALUES
  ('Wali Kota Magelang', 'unit'),
  ('Wakil Wali Kota Magelang', 'unit'),
  ('Sekretaris Daerah Kota Magelang', 'unit'),
  ('Sekretariat Daerah', 'unit'),
  ('Sekretariat DPRD', 'unit'),
  ('Kepala BPKAD Kota Magelang', 'unit'),
  ('BPKAD Provinsi Jawa Tengah', 'unit'),
  ('Bapperida', 'unit'),
  ('BKPSDM', 'unit'),
  ('BPKAD', 'unit'),
  ('Badan Kesbangpol', 'unit'),
  ('BPBD', 'unit'),
  ('DKK', 'unit'),
  ('Disdikbud', 'unit'),
  ('Disdukcapil', 'unit'),
  ('Disperkim', 'unit'),
  ('Disporapar', 'unit'),
  ('Disperpa', 'unit'),
  ('Dinas Perpustakaan', 'unit'),
  ('Dinas Kesehatan', 'unit'),
  ('Dinas Sosial', 'unit'),
  ('Dinas Perhubungan', 'unit'),
  ('Disnaker', 'unit'),
  ('Diskominsta', 'unit'),
  ('DLH', 'unit'),
  ('DP4KB', 'unit'),
  ('DPMP4KB', 'unit'),
  ('DPUPR', 'unit'),
  ('DPMPTSP', 'unit'),
  ('DPPKUM', 'unit'),
  ('Inspektorat Daerah', 'unit'),
  ('Kecamatan Magelang Selatan', 'unit'),
  ('Kecamatan Magelang Utara', 'unit'),
  ('Kecamatan Magelang Tengah', 'unit'),
  ('Polres Magelang Kota', 'unit'),
  ('Satpol PP', 'unit'),
  ('KPKNL Yogyakarta', 'unit'),
  ('Emilia Nugraheni', 'orang'),
  ('Yudha Karyadi D', 'orang'),
  ('M. Wahyu Widodo', 'orang')
ON CONFLICT (nama) DO NOTHING;
