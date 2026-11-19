-- Pemberitahuan realtime: setiap perubahan data dikirim ke kanal pg_notify.
-- Fungsi dan pemicunya dibuat oleh superuser `postgres`; `aset_app` hanya memicu lewat INSERT/UPDATE/DELETE biasa.
-- Isi pesan kecil: tabel, aksi, id baris — halaman yang menerima memutuskan apakah ia perlu menyegar dirinya.
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

-- Setiap tabel yang dibaca halaman: surat masuk dan bagiannya, surat keluar dan bagiannya, daftar nama, jenis surat, akun.
-- Agenda (jadwal_rapat) ikut, karena kalender dan layar monitor berubah saat agenda dibuat, digeser, atau dihapus.
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
