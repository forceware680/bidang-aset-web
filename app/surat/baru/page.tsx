import Link from "next/link";
import { bolehMengubah, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Shell } from "@/components/shell";
import { SuratForm } from "@/components/surat-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default async function SuratBaruPage() {
  const user = await requireUser();
  const kategori = await prisma.jenis_surat.findMany({ where: { aktif: true }, orderBy: { nama: "asc" } });
  const pengirim = await prisma.master_pengirim.findMany({ where: { aktif: true }, orderBy: { nama: "asc" } });

  if (!bolehMengubah(user.role)) {
    return (
      <Shell user={user} aktif="surat" judul="Tambah Surat">
        <Alert>
          <AlertDescription>
            Akun dengan peran {user.role} hanya dapat membaca catatan surat. Minta peran Petugas Agenda atau
            Administrator kepada pengelola aplikasi untuk bisa mencatat surat.
          </AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <Link href="/surat">Kembali ke daftar surat</Link>
        </Button>
      </Shell>
    );
  }

  return (
    <Shell user={user} aktif="surat" judul="Tambah Surat Masuk">
      {/* Penjelasan nomor agenda sudah ada di kartu "Identitas surat"; tidak diulang di header halaman. */}
      <SuratForm kategori={kategori} pengirim={pengirim.map((m) => m.nama)} />
    </Shell>
  );
}
