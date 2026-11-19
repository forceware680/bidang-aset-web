import { Shell } from "@/components/shell";
import { SkeletonFilter, SkeletonTable } from "@/components/loading-states";
import { requireUser } from "@/lib/auth";

export default async function Loading() {
  const user = await requireUser();
  return (
    <Shell user={user} aktif="keluar" judul="Agenda Surat Keluar">
      <SkeletonFilter jumlah={4} judul="Memuat penyaring surat keluar" />
      <SkeletonTable kolom={9} baris={10} judul="Memuat daftar surat keluar" />
    </Shell>
  );
}
