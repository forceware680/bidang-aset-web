import { bolehMengubah, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DialogRute } from "@/components/dialog-rute";
import { DialogClose, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KeluarForm } from "@/components/keluar-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Versi modal dari /keluar/baru; alamatnya sendiri tetap merender halaman penuh saat dibuka langsung. */
export default async function KeluarBaruModalPage() {
  const user = await requireUser();
  const kategori = await prisma.jenis_surat.findMany({ where: { aktif: true, arah: "keluar" }, orderBy: { nama: "asc" } });
  const penerima = await prisma.master_penerima.findMany({ where: { aktif: true }, orderBy: [{ jenis: "asc" }, { nama: "asc" }] });
  const asal = await prisma.surat_masuk.findMany({
    where: { deleted_at: null },
    orderBy: { tanggal_terima: "desc" },
    take: 60,
    select: { id: true, nomor_agenda: true, perihal: true },
  });

  if (!bolehMengubah(user.role)) {
    return (
      <DialogRute rute="/keluar/baru">
        <DialogHeader className="pr-10">
          <DialogTitle id="judul-keluar-baru">Tambah Surat Keluar</DialogTitle>
        </DialogHeader>
        <Alert>
          <AlertDescription>
            Akun dengan peran {user.role} hanya dapat membaca catatan surat keluar. Minta peran Petugas Agenda atau
            Administrator kepada pengelola aplikasi untuk bisa mencatat surat keluar.
          </AlertDescription>
        </Alert>
        {/* Tautan tidak bekerja di dalam rute yang diintercept, jadi kembali ke daftar lewat tombol tutup. */}
        <DialogClose asChild data-slot="button">
          <Button variant="outline">Kembali ke daftar surat keluar</Button>
        </DialogClose>
      </DialogRute>
    );
  }

  return (
    <DialogRute rute="/keluar/baru">
      <DialogHeader className="pr-10">
        <DialogTitle id="judul-keluar-baru">Tambah Surat Keluar</DialogTitle>
        <DialogDescription id="keterangan-keluar-baru">
          Nomor surat dibuat otomatis bila dibiarkan kosong. Scan dan lampiran diunggah dari halaman suratnya setelah
          surat tersimpan.
        </DialogDescription>
      </DialogHeader>
      <KeluarForm kategori={kategori} penerima={penerima.map((m) => m.nama)} asal={asal} modal batalHref="/keluar" />
    </DialogRute>
  );
}
