-- Aplikasi Agenda Surat & Jadwal Rapat — Bidang Aset BPKAD Kota Magelang
-- Skema PostgreSQL 18. Jalankan: psql -d agenda_aset -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ---------- Peran & pengguna ----------

CREATE TABLE roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(50) NOT NULL UNIQUE,
  description text
);

CREATE TABLE users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         varchar(150) NOT NULL,
  email        varchar(190) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role_id      uuid NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users (role_id);

-- ---------- Referensi kategori surat ----------

CREATE TABLE jenis_surat (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama  varchar(100) NOT NULL UNIQUE,
  arah  varchar(10) NOT NULL DEFAULT 'masuk'
    CHECK (arah IN ('masuk', 'keluar')),
  aktif boolean NOT NULL DEFAULT true
);

-- Daftar nama resmi agar petugas tidak mengetik ulang: pengirim surat, pejabat
-- pemberi disposisi, dan tujuan penerusan setelah disposisi terakhir.
-- Nilai yang sudah tersimpan di surat/disposisi tetap teks bebas, jadi mengganti
-- daftar tidak mengubah histori.
CREATE TABLE master_pengirim (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama       varchar(200) NOT NULL UNIQUE,
  aktif      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE master_pejabat (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama       varchar(200) NOT NULL UNIQUE,
  jabatan    varchar(120),
  aktif      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE master_terusan (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama       varchar(200) NOT NULL UNIQUE,
  jenis      varchar(10) NOT NULL DEFAULT 'unit'
    CHECK (jenis IN ('unit', 'orang')),
  aktif      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_master_pengirim_aktif ON master_pengirim (aktif, nama);
CREATE INDEX idx_master_pejabat_aktif  ON master_pejabat (aktif, nama);
CREATE INDEX idx_master_terusan_aktif  ON master_terusan (aktif, jenis, nama);

-- Tujuan surat keluar: dropdown tujuan pada form surat keluar.
CREATE TABLE master_penerima (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama       varchar(200) NOT NULL UNIQUE,
  jenis      varchar(10) NOT NULL DEFAULT 'unit'
    CHECK (jenis IN ('unit', 'orang')),
  aktif      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_master_penerima_aktif ON master_penerima (aktif, jenis, nama);

-- Pegawai Bidang Aset: daftar yang dipakai autocomplete nama peserta rapat.
CREATE TABLE master_pegawai (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama       varchar(200) NOT NULL UNIQUE,
  jabatan    varchar(120),
  aktif      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_master_pegawai_aktif ON master_pegawai (aktif, nama);

-- Penghitung nomor agenda per tahun. Nomor agenda tidak boleh bergantung
-- pada jumlah baris yang sedang ditampilkan.
CREATE TABLE agenda_counter (
  tahun         integer PRIMARY KEY CHECK (tahun BETWEEN 2000 AND 2100),
  nomor_terakhir integer NOT NULL DEFAULT 0 CHECK (nomor_terakhir >= 0)
);

-- Penghitung nomor surat keluar, terpisah dari surat masuk supaya nomor keduanya tidak
-- saling menyelingi.
CREATE TABLE keluar_counter (
  tahun          integer PRIMARY KEY CHECK (tahun BETWEEN 2000 AND 2100),
  nomor_terakhir integer NOT NULL DEFAULT 0 CHECK (nomor_terakhir >= 0)
);

-- Nomor agenda buatan sistem: 001/2026 sampai 999/2026 memakai tiga digit; di atas itu angka penuh
-- dipakai (lpad truncates: lpad('5029', 3) = '502', jadi nomor 4 digit tidak boleh di-lpad).
-- Nilai baru selalu di atas nomor terbesar yang sudah ada di tabel, supaya data hasil impor dengan
-- nomor 502..5028 tidak bentrok dengan counter yang masih kecil.
CREATE FUNCTION next_nomor_agenda(p_tahun integer) RETURNS varchar AS $$
DECLARE
  v_no integer;
  v_maks integer;
BEGIN
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

CREATE FUNCTION next_nomor_keluar(p_tahun integer) RETURNS varchar AS $$
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

-- ---------- Surat masuk ----------

CREATE TABLE surat_masuk (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_agenda         varchar(50) NOT NULL UNIQUE,
  tanggal_terima       date NOT NULL,
  pengirim             varchar(200) NOT NULL,
  nomor_surat          varchar(150),
  tanggal_surat        date,
  perihal              varchar(500) NOT NULL,
  isi_ringkas          text,
  jenis_surat_id       uuid REFERENCES jenis_surat (id) ON DELETE RESTRICT,
  status_undangan_rapat varchar(20) NOT NULL DEFAULT 'belum'
    CHECK (status_undangan_rapat IN ('belum', 'ya', 'tidak')),
  status_surat         varchar(30) NOT NULL DEFAULT 'belum_disposisi'
    CHECK (status_surat IN ('belum_disposisi', 'didisposisikan', 'selesai', 'arsip')),
  created_by           uuid REFERENCES users (id) ON DELETE RESTRICT,
  updated_by           uuid REFERENCES users (id) ON DELETE RESTRICT,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

CREATE INDEX idx_surat_tanggal_terima ON surat_masuk (tanggal_terima DESC);
CREATE INDEX idx_surat_tanggal_surat  ON surat_masuk (tanggal_surat);
CREATE INDEX idx_surat_pengirim       ON surat_masuk (pengirim);
CREATE INDEX idx_surat_nomor_surat    ON surat_masuk (nomor_surat);
CREATE INDEX idx_surat_perihal_trgm   ON surat_masuk USING gin (perihal gin_trgm_ops);
CREATE INDEX idx_surat_jenis          ON surat_masuk (jenis_surat_id);
CREATE INDEX idx_surat_status         ON surat_masuk (status_surat, status_undangan_rapat);
CREATE INDEX idx_surat_live           ON surat_masuk (tanggal_terima DESC) WHERE deleted_at IS NULL;

-- ---------- Surat keluar ----------
-- nomor_surat adalah penanda utama surat keluar: dibuat otomatis sebagai KL-001/2026 dan boleh
-- dikoreksi petugas. surat_asal_id menautkan surat ke surat masuk yang dibalas.

CREATE TABLE surat_keluar (
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
  status_sebelum_arsip varchar(20)
    CHECK (status_sebelum_arsip IN ('draf', 'dikirim', 'selesai')),
  tanggal_kirim        timestamptz,
  catatan              text,
  created_by           uuid REFERENCES users (id) ON DELETE RESTRICT,
  updated_by           uuid REFERENCES users (id) ON DELETE RESTRICT,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

CREATE INDEX idx_keluar_tanggal      ON surat_keluar (tanggal_surat DESC);
CREATE INDEX idx_keluar_tujuan       ON surat_keluar (tujuan);
CREATE INDEX idx_keluar_perihal_trgm ON surat_keluar USING gin (perihal gin_trgm_ops);
CREATE INDEX idx_keluar_jenis        ON surat_keluar (jenis_surat_id);
CREATE INDEX idx_keluar_asal         ON surat_keluar (surat_asal_id);
CREATE INDEX idx_keluar_status       ON surat_keluar (status_surat);
CREATE INDEX idx_keluar_live         ON surat_keluar (tanggal_surat DESC) WHERE deleted_at IS NULL;

-- ---------- Lampiran ----------

CREATE TABLE lampiran_surat (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surat_id    uuid NOT NULL REFERENCES surat_masuk (id) ON DELETE RESTRICT,
  nama_asli   varchar(255) NOT NULL,
  path_file   text NOT NULL,
  mime_type   varchar(100) NOT NULL,
  ukuran_byte bigint NOT NULL CHECK (ukuran_byte > 0 AND ukuran_byte <= 20971520),
  uploaded_by uuid REFERENCES users (id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lampiran_surat ON lampiran_surat (surat_id);

CREATE TABLE lampiran_keluar (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surat_id    uuid NOT NULL REFERENCES surat_keluar (id) ON DELETE RESTRICT,
  nama_asli   varchar(255) NOT NULL,
  path_file   text NOT NULL,
  mime_type   varchar(100) NOT NULL,
  ukuran_byte bigint NOT NULL CHECK (ukuran_byte > 0 AND ukuran_byte <= 20971520),
  uploaded_by uuid REFERENCES users (id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lampiran_keluar ON lampiran_keluar (surat_id);

-- ---------- Disposisi ----------

CREATE TABLE disposisi (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surat_id             uuid NOT NULL REFERENCES surat_masuk (id) ON DELETE RESTRICT,
  tanggal_disposisi    date NOT NULL,
  pemberi_disposisi    varchar(200) NOT NULL,
  -- Kosong berarti surat belum diteruskan; disposisi berantai tidak setiap langkah meneruskan.
  penerima_disposisi   varchar(200),
  tanggal_diteruskan   date,
  isi_disposisi        text NOT NULL,
  status_tindak_lanjut varchar(40) NOT NULL DEFAULT 'belum'
    CHECK (status_tindak_lanjut IN ('belum', 'proses', 'selesai', 'tidak_perlu')),
  catatan              text,
  created_by           uuid REFERENCES users (id) ON DELETE RESTRICT,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_disposisi_surat    ON disposisi (surat_id);
CREATE INDEX idx_disposisi_tanggal  ON disposisi (tanggal_disposisi DESC);
CREATE INDEX idx_disposisi_status   ON disposisi (status_tindak_lanjut);
CREATE INDEX idx_disposisi_penerima ON disposisi (penerima_disposisi);
CREATE INDEX idx_disposisi_tanggal_diteruskan ON disposisi (tanggal_diteruskan DESC);

-- ---------- Jadwal rapat ----------

CREATE TABLE jadwal_rapat (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surat_id       uuid REFERENCES surat_masuk (id) ON DELETE RESTRICT,
  agenda_rapat   varchar(300) NOT NULL,
  penyelenggara  varchar(200),
  tanggal_mulai  timestamptz NOT NULL,
  tanggal_selesai timestamptz,
  tempat         varchar(300),
  tautan_rapat   text,
  catatan        text,
  status_rapat   varchar(30) NOT NULL DEFAULT 'terjadwal'
    CHECK (status_rapat IN ('terjadwal', 'berlangsung', 'selesai', 'dibatalkan', 'dijadwalkan_ulang')),
  -- `terbit` = agenda boleh ditampilkan di monitor di depan ruangan. Default true supaya agenda yang
  -- sudah ada tidak hilang dari layar; petugas bisa menyembunyikan agenda internal dari halaman rapat.
  terbit         boolean NOT NULL DEFAULT true,
  created_by     uuid REFERENCES users (id) ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_rapat_durasi CHECK (tanggal_selesai IS NULL OR tanggal_selesai >= tanggal_mulai)
);

CREATE INDEX idx_rapat_mulai       ON jadwal_rapat (tanggal_mulai);
CREATE INDEX idx_rapat_status      ON jadwal_rapat (status_rapat);
CREATE INDEX idx_rapat_surat       ON jadwal_rapat (surat_id);
CREATE INDEX idx_rapat_agenda_trgm ON jadwal_rapat USING gin (agenda_rapat gin_trgm_ops);
CREATE INDEX idx_rapat_created_by  ON jadwal_rapat (created_by);
CREATE INDEX idx_rapat_aktif       ON jadwal_rapat (tanggal_mulai)
  WHERE status_rapat IN ('terjadwal', 'berlangsung', 'dijadwalkan_ulang');
CREATE INDEX idx_rapat_terbit      ON jadwal_rapat (tanggal_mulai)
  WHERE terbit AND status_rapat IN ('terjadwal', 'berlangsung', 'dijadwalkan_ulang');

CREATE TABLE riwayat_jadwal_rapat (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rapat_id              uuid NOT NULL REFERENCES jadwal_rapat (id) ON DELETE CASCADE,
  tanggal_mulai_lama    timestamptz NOT NULL,
  tanggal_selesai_lama  timestamptz,
  tanggal_mulai_baru    timestamptz NOT NULL,
  tanggal_selesai_baru  timestamptz,
  alasan_perubahan      text,
  changed_by            uuid REFERENCES users (id) ON DELETE RESTRICT,
  changed_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_riwayat_rapat ON riwayat_jadwal_rapat (rapat_id, changed_at DESC);

CREATE TABLE peserta_rapat (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rapat_id       uuid NOT NULL REFERENCES jadwal_rapat (id) ON DELETE CASCADE,
  nama_peserta   varchar(200) NOT NULL,
  instansi_bidang varchar(200),
  keterangan     text
);

CREATE INDEX idx_peserta_rapat ON peserta_rapat (rapat_id);

-- ---------- Aturan bisnis pada level database ----------

-- Rapat bersumber dari surat hanya boleh memakai surat yang bertanda undangan = 'ya'.
-- surat_id NULL = agenda mandiri (pengingat yang dibuat pejabat sendiri, tanpa surat masuk).
CREATE FUNCTION chk_rapat_sumber_undangan() RETURNS trigger AS $$
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

CREATE TRIGGER trg_rapat_sumber_undangan
  BEFORE INSERT OR UPDATE OF surat_id ON jadwal_rapat
  FOR EACH ROW EXECUTE FUNCTION chk_rapat_sumber_undangan();

-- Surat yang sudah punya rapat aktif tidak boleh diubah menjadi nonrapat.
CREATE FUNCTION chk_surat_undangan_kebalikan() RETURNS trigger AS $$
BEGIN
  IF NEW.status_undangan_rapat = 'tidak'
     AND EXISTS (SELECT 1 FROM jadwal_rapat
                 WHERE surat_id = OLD.id AND status_rapat <> 'dibatalkan') THEN
    RAISE EXCEPTION 'Surat % masih memiliki agenda rapat aktif', OLD.nomor_agenda;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_surat_undangan_kebalikan
  BEFORE UPDATE OF status_undangan_rapat ON surat_masuk
  FOR EACH ROW EXECUTE FUNCTION chk_surat_undangan_kebalikan();

-- Surat keluar bergerak maju saja: dikirim tidak kembali ke draf, selesai tidak kembali ke dikirim.
-- Keluar dari arsip tidak diperiksa di sini; aplikasi memulihkan status dari status_sebelum_arsip.
CREATE FUNCTION chk_keluar_status_maju() RETURNS trigger AS $$
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

CREATE TRIGGER trg_keluar_status_maju
  BEFORE UPDATE OF status_surat ON surat_keluar
  FOR EACH ROW EXECUTE FUNCTION chk_keluar_status_maju();

-- Status 'dikirim' selalu menyertai waktu kirim; bila petugas tidak menuliskan waktunya, database mengisinya.
CREATE FUNCTION isi_tanggal_kirim() RETURNS trigger AS $$
BEGIN
  IF NEW.status_surat = 'dikirim' AND NEW.tanggal_kirim IS NULL THEN
    NEW.tanggal_kirim := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_keluar_tanggal_kirim
  BEFORE UPDATE ON surat_keluar
  FOR EACH ROW EXECUTE FUNCTION isi_tanggal_kirim();

-- updated_at dijaga oleh database agar tetap akurat.
CREATE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_touch_surat      BEFORE UPDATE ON surat_masuk  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_touch_disposisi  BEFORE UPDATE ON disposisi    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_touch_rapat      BEFORE UPDATE ON jadwal_rapat FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_touch_users      BEFORE UPDATE ON users        FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_touch_master_pengirim BEFORE UPDATE ON master_pengirim FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_touch_master_pejabat  BEFORE UPDATE ON master_pejabat  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_touch_master_terusan  BEFORE UPDATE ON master_terusan  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_touch_master_penerima BEFORE UPDATE ON master_penerima FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_touch_master_pegawai BEFORE UPDATE ON master_pegawai FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_touch_keluar         BEFORE UPDATE ON surat_keluar     FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------- Audit log ----------

CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users (id) ON DELETE SET NULL,
  action      varchar(50) NOT NULL,
  entity_type varchar(100) NOT NULL,
  entity_id   uuid,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_user   ON audit_logs (user_id, created_at DESC);

-- ---------- Token aplikasi Android ----------

-- Aplikasi Android masuk dengan email + kata sandi yang sama, lalu memakai token pembawa (Bearer).
-- Yang tersimpan hanya hash SHA-256 token; token diperpanjang setiap kali dipakai sampai 90 hari.
CREATE TABLE api_token (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash     text NOT NULL UNIQUE,
  perangkat      varchar(60),
  created_at     timestamptz NOT NULL DEFAULT now(),
  terakhir_pakai timestamptz,
  expires_at     timestamptz NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_token_user ON api_token (user_id, expires_at);

CREATE TRIGGER trg_touch_api_token
  BEFORE UPDATE ON api_token
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON api_token TO aset_app;
GRANT SELECT ON v_rapat_aktif TO aset_app;
CREATE INDEX idx_audit_time   ON audit_logs (created_at DESC);

-- ---------- Pemberitahuan realtime ----------

-- Setiap perubahan di tabel mana pun dikirim ke kanal 'aset_perubahan' sebagai JSON kecil
-- {tabel, aksi, id}. Alamat /api/pembaruan membaca kanal ini dan mengirimnya ke peramban, jadi
-- daftar, kalender, dan layar monitor ikut diperbarui tanpa menunggu penyegar berkala. Pemicunya
-- dibuat oleh superuser `postgres`; aplikasi hanya memicu lewat INSERT/UPDATE/DELETE biasa.
-- db/migrate-008-memberi.sql berisi pernyataan yang sama untuk database yang sudah ada.
CREATE OR REPLACE FUNCTION beri_tahu_perubahan() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify(
    'aset_perubahan',
    jsonb_build_object('tabel', TG_TABLE_NAME, 'aksi', TG_OP, 'id', COALESCE(NEW.id, OLD.id))::text
  );
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_memberi_surat_masuk AFTER INSERT OR UPDATE OR DELETE ON surat_masuk
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
CREATE OR REPLACE TRIGGER trg_memberi_disposisi AFTER INSERT OR UPDATE OR DELETE ON disposisi
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
CREATE OR REPLACE TRIGGER trg_memberi_lampiran_surat AFTER INSERT OR UPDATE OR DELETE ON lampiran_surat
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
CREATE OR REPLACE TRIGGER trg_memberi_jadwal_rapat AFTER INSERT OR UPDATE OR DELETE ON jadwal_rapat
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
CREATE OR REPLACE TRIGGER trg_memberi_peserta_rapat AFTER INSERT OR UPDATE OR DELETE ON peserta_rapat
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
CREATE OR REPLACE TRIGGER trg_memberi_riwayat_jadwal AFTER INSERT OR UPDATE OR DELETE ON riwayat_jadwal_rapat
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
CREATE OR REPLACE TRIGGER trg_memberi_surat_keluar AFTER INSERT OR UPDATE OR DELETE ON surat_keluar
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
CREATE OR REPLACE TRIGGER trg_memberi_lampiran_keluar AFTER INSERT OR UPDATE OR DELETE ON lampiran_keluar
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
CREATE OR REPLACE TRIGGER trg_memberi_jenis_surat AFTER INSERT OR UPDATE OR DELETE ON jenis_surat
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
CREATE OR REPLACE TRIGGER trg_memberi_master_pengirim AFTER INSERT OR UPDATE OR DELETE ON master_pengirim
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
CREATE OR REPLACE TRIGGER trg_memberi_master_pejabat AFTER INSERT OR UPDATE OR DELETE ON master_pejabat
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
CREATE OR REPLACE TRIGGER trg_memberi_master_terusan AFTER INSERT OR UPDATE OR DELETE ON master_terusan
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
CREATE OR REPLACE TRIGGER trg_memberi_master_penerima AFTER INSERT OR UPDATE OR DELETE ON master_penerima
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
CREATE OR REPLACE TRIGGER trg_memberi_master_pegawai AFTER INSERT OR UPDATE OR DELETE ON master_pegawai
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
CREATE OR REPLACE TRIGGER trg_memberi_users AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();

-- ---------- View untuk dashboard dan rekap ----------

CREATE VIEW v_surat_aktif AS
SELECT
  s.id,
  s.nomor_agenda,
  s.tanggal_terima,
  EXTRACT(year FROM s.tanggal_terima) AS tahun_terima,
  s.pengirim,
  s.nomor_surat,
  s.tanggal_surat,
  s.perihal,
  s.isi_ringkas,
  j.nama AS jenis_surat,
  s.status_undangan_rapat,
  s.status_surat,
  count(d.id) AS jumlah_disposisi,
  count(d.id) FILTER (WHERE d.status_tindak_lanjut IN ('belum', 'proses')) AS disposisi_belum_selesai,
  count(r.id) AS jumlah_rapat,
  min(r.tanggal_mulai) AS rapat_terdekat
FROM surat_masuk s
LEFT JOIN jenis_surat j ON j.id = s.jenis_surat_id
LEFT JOIN disposisi d   ON d.surat_id = s.id
LEFT JOIN jadwal_rapat r  ON r.surat_id = s.id AND r.status_rapat <> 'dibatalkan'
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.nomor_agenda, s.tanggal_terima, s.pengirim, s.nomor_surat,
         s.tanggal_surat, s.perihal, s.isi_ringkas, j.nama,
         s.status_undangan_rapat, s.status_surat;

-- Surat yang belum pernah mendapat disposisi sama sekali.
CREATE VIEW v_surat_belum_disposisi AS
SELECT id, nomor_agenda, tanggal_terima, pengirim, perihal
FROM v_surat_aktif
WHERE jumlah_disposisi = 0;

-- Daftar surat keluar beserta tujuan, jenis, jumlah lampiran, dan surat asal yang dibalas.
CREATE VIEW v_surat_keluar_aktif AS
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
LEFT JOIN jenis_surat j       ON j.id = k.jenis_surat_id
LEFT JOIN surat_masuk s       ON s.id = k.surat_asal_id AND s.deleted_at IS NULL
LEFT JOIN lampiran_keluar l   ON l.surat_id = k.id
WHERE k.deleted_at IS NULL
GROUP BY k.id, k.nomor_surat, k.tanggal_surat, k.tujuan, k.perihal, k.isi_ringkas, k.catatan,
         j.nama, k.jenis_surat_id, k.status_surat, k.status_sebelum_arsip, k.tanggal_kirim,
         k.surat_asal_id, s.nomor_agenda, s.perihal;

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

CREATE VIEW v_rapat_aktif AS
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

-- Agenda yang layak tampil di monitor: dipublish dan masih aktif. Yang dibatalkan tidak ikut,
-- dan surat asal boleh dihapus (agenda mandiri tidak punya surat).
CREATE VIEW v_agenda_monitor AS
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

-- ---------- Data awal ----------

INSERT INTO roles (name, description) VALUES
  ('Administrator', 'Mengelola akun, peran, kategori surat, dan konfigurasi aplikasi'),
  ('Petugas Agenda', 'Mencatat surat, disposisi, dan jadwal rapat'),
  ('Pembaca/Pimpinan', 'Melihat surat, disposisi, jadwal rapat, dan laporan tanpa mengubah data');

INSERT INTO jenis_surat (nama) VALUES
  ('Undangan'),
  ('Permohonan'),
  ('Pemberitahuan'),
  ('Laporan'),
  ('Surat Pengantar'),
  ('Nota Dinas'),
  ('Lainnya');

-- Klasifikasi surat keluar (arah 'keluar'). Daftar tujuan resmi diisi oleh db/seed-003-surat-keluar.sql.
INSERT INTO jenis_surat (nama, arah) VALUES
  ('Surat Balasan', 'keluar'),
  ('Surat Undangan Keluar', 'keluar'),
  ('Surat Pengantar Keluar', 'keluar'),
  ('Nota Dinas Keluar', 'keluar'),
  ('Permohonan Keluar', 'keluar'),
  ('Lainnya (keluar)', 'keluar')
ON CONFLICT (nama) DO NOTHING;

-- ── Migrasi 010: kunci layar monitor bisa dibalik dari Pengaturan ──────────────
CREATE TABLE IF NOT EXISTS monitor_token (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text NOT NULL UNIQUE,
  aktif       boolean NOT NULL DEFAULT true,
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  dibuat_oleh uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_monitor_token_aktif ON monitor_token (aktif) WHERE aktif;
CREATE TRIGGER IF NOT EXISTS trg_touch_monitor_token
  BEFORE UPDATE ON monitor_token
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON monitor_token TO aset_app;

-- ── Migrasi 011: pemberitahuan peserta (bel notifikasi di aplikasi Android) ────
CREATE TABLE IF NOT EXISTS pemberitahuan_peserta (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rapat_id     uuid NOT NULL REFERENCES jadwal_rapat (id) ON DELETE CASCADE,
  nama_peserta varchar(200) NOT NULL,
  oleh         varchar(150) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pemberitahuan_peserta_rapat ON pemberitahuan_peserta (rapat_id);
CREATE INDEX IF NOT EXISTS idx_pemberitahuan_peserta_created ON pemberitahuan_peserta (created_at);
GRANT SELECT, INSERT ON pemberitahuan_peserta TO aset_app;

-- ── Migrasi 012: tautan unduh APK Android (tombol "Unduh APK" di pojok kiri atas login) ──
CREATE TABLE IF NOT EXISTS apk_unduh (
  id          text PRIMARY KEY DEFAULT 'tunggal',
  url         text NOT NULL,
  diubah_oleh uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_touch_apk_unduh
  BEFORE UPDATE ON apk_unduh
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON apk_unduh TO aset_app;
