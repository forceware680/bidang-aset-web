-- Seed daftar nama resmi (dari lembar agenda lama, nama yang berulang disatukan).
-- INSERT ... ON CONFLICT DO NOTHING: boleh dijalankan berulang.

INSERT INTO master_pejabat (nama, jabatan) VALUES
  ('Wali Kota', 'Wali Kota Magelang'),
  ('Wakil Wali Kota', 'Wakil Wali Kota Magelang'),
  ('Sekretaris Daerah', 'Sekretaris Daerah Magelang'),
  ('Kepala BPKAD', 'Kepala BPKAD Kota Magelang'),
  ('Sekretaris BPKAD', 'Sekretaris BPKAD Kota Magelang'),
  ('Kabid Aset', 'Kepala Bidang Aset')
ON CONFLICT (nama) DO NOTHING;

INSERT INTO master_terusan (nama, jenis) VALUES
  ('Subid Penatausahaan Aset', 'unit'),
  ('Subid Perencanaan & Penghapusan Aset', 'unit'),
  ('Arsip', 'unit'),
  ('Emilia Nugraheni', 'orang'),
  ('Yudha Karyadi D', 'orang'),
  ('Dimas Prasetyo A', 'orang'),
  ('M. Wahyu Widodo', 'orang'),
  ('Redika Titiana P', 'orang'),
  ('Heru', 'orang'),
  ('Herman', 'orang'),
  ('Irwan', 'orang'),
  ('Nugroho', 'orang'),
  ('Ikhsan', 'orang'),
  ('Aji', 'orang'),
  ('Wisnu', 'orang')
ON CONFLICT (nama) DO NOTHING;

INSERT INTO master_pengirim (nama) VALUES
  ('BPKAD'),
  ('Sekretariat Daerah'),
  ('Sekretariat DPRD'),
  ('DPUPR'),
  ('Disperkim'),
  ('Disporapar'),
  ('DLH'),
  ('BKPSDM'),
  ('Diskominsta'),
  ('DPPKUM'),
  ('Dinas Perhubungan'),
  ('Dinas Sosial'),
  ('Disdukcapil'),
  ('Disdikbud'),
  ('BPBD'),
  ('DPMPTSP'),
  ('Dinas Kesehatan'),
  ('Inspektorat Daerah'),
  ('DP4KB'),
  ('DPMP4KB'),
  ('DKK'),
  ('Badan Kesbangpol'),
  ('Kecamatan Magelang Selatan'),
  ('Kecamatan Magelang Utara'),
  ('Kecamatan Magelang Tengah'),
  ('Disnaker'),
  ('Satpol PP'),
  ('Disperpa'),
  ('Dinas Perpustakaan'),
  ('Bapperida'),
  ('Polres Magelang Kota')
ON CONFLICT (nama) DO NOTHING;
