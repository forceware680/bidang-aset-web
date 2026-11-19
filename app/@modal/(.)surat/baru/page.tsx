import { bolehMengubah, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DialogRute } from "@/components/dialog-rute";
import { DialogClose, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SuratForm } from "@/components/surat-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Versi modal dari /surat/baru, dibuka lewat intercepting route saat tautan "Tambah Surat" diklik
 * dari daftar. Alamat /surat/baru sendiri tetap merender halaman penuh kalau dibuka langsung atau
 * di-refresh (docs Next: intercepting routes).
 */
export default async function SuratBaruModalPage() {
  const user = await requireUser();
  const kategori = await prisma.jenis_surat.findMany({ where: { aktif: true }, orderBy: { nama: "asc" } });
  const pengirim = await prisma.master_pengirim.findMany({ where: { aktif: true }, orderBy: { nama: "asc" } });

  if (!bolehMengubah(user.role)) {
    return (
      <DialogRute rute="/surat/baru">
        <DialogHeader className="pr-10">
          <DialogTitle id="judul-surat-baru">Tambah Surat Masuk</DialogTitle>
        </DialogHeader>
        <Alert>
          <AlertDescription>
            Akun dengan peran {user.role} hanya dapat membaca catatan surat. Minta peran Petugas Agenda atau
            Administrator kepada pengelola aplikasi untuk bisa mencatat surat.
          </AlertDescription>
        </Alert>
        {/* Tautan tidak bekerja di dalam rute yang diintercept, jadi kembali ke daftar lewat tombol tutup. */}
        <DialogClose asChild data-slot="button">
          <Button variant="outline">Kembali ke daftar surat</Button>
        </DialogClose>
      </DialogRute>
    );
  }

  return (
    <DialogRute rute="/surat/baru">
      <DialogHeader className="pr-10">
        <DialogTitle id="judul-surat-baru">Tambah Surat Masuk</DialogTitle>
        <DialogDescription id="keterangan-surat-baru">
          Surat dicatat di sini; scan dan lampiran diunggah dari halaman suratnya setelah surat tersimpan.
        </DialogDescription>
      </DialogHeader>
      <SuratForm kategori={kategori} pengirim={pengirim.map((m) => m.nama)} modal batalHref="/surat" />
    </DialogRute>
  );
}
