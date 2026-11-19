import { Shell } from "@/components/shell";
import { SkeletonFilter, SkeletonTable } from "@/components/loading-states";
import { requireUser } from "@/lib/auth";

export default async function Loading() {
  const user = await requireUser();
  return (
    <Shell user={user} aktif="surat" judul="Agenda Surat Masuk">
      <SkeletonFilter jumlah={5} judul="Memuat penyaring surat masuk" />
      <SkeletonTable kolom={8} baris={10} judul="Memuat daftar surat masuk" />
    </Shell>
  );
}
