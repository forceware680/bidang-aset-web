import { Shell } from "@/components/shell";
import { SkeletonFilter, SkeletonTable } from "@/components/loading-states";
import { requireUser } from "@/lib/auth";

export default async function Loading() {
  const user = await requireUser();
  return (
    <Shell user={user} aktif="disposisi" judul="Disposisi dan tindak lanjut">
      <SkeletonFilter jumlah={4} judul="Memuat penyaring disposisi" />
      <SkeletonTable kolom={8} baris={8} judul="Memuat daftar disposisi" />
    </Shell>
  );
}
