import Link from "next/link";
import { bolehMengubah, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Shell } from "@/components/shell";
import { KeluarForm } from "@/components/keluar-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default async function KeluarBaruPage() {
  const user = await requireUser();
  const kategori = await prisma.jenis_surat.findMany({ where: { aktif: true, arah: "keluar" }, orderBy: { nama: "asc" } });
  const penerima = await prisma.master_penerima.findMany({ where: { aktif: true }, orderBy: [{ jenis: "asc" }, { nama: "asc" }] });
  // Hanya surat masuk terbaru yang bisa dipilih sebagai surat yang dibalas.
  const asal = await prisma.surat_masuk.findMany({
    where: { deleted_at: null },
    orderBy: { tanggal_terima: "desc" },
    take: 60,
    select: { id: true, nomor_agenda: true, perihal: true },
  });

  if (!bolehMengubah(user.role)) {
    return (
      <Shell user={user} aktif="keluar" judul="Tambah Surat Keluar">
        <Alert>
          <AlertDescription>
            Akun dengan peran {user.role} hanya dapat membaca catatan surat. Minta peran Petugas Agenda atau
            Administrator kepada pengelola aplikasi untuk bisa mencatat surat keluar.
          </AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <Link href="/keluar">Kembali ke daftar surat keluar</Link>
        </Button>
      </Shell>
    );
  }

  return (
    <Shell user={user} aktif="keluar" judul="Tambah Surat Keluar">
      {/* Penjelasan nomor surat sudah ada di kartu "Identitas surat keluar"; tidak diulang di header halaman. */}
      <KeluarForm kategori={kategori} penerima={penerima.map((m) => m.nama)} asal={asal} />
    </Shell>
  );
}
