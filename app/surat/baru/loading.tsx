import { Shell } from "@/components/shell";
import { SkeletonForm } from "@/components/loading-states";
import { requireUser } from "@/lib/auth";

export default async function Loading() {
  const user = await requireUser();
  return (
    <Shell user={user} aktif="surat" judul="Tambah Surat Masuk">
      <SkeletonForm jumlah={6} judul="Memuat formulir surat masuk" />
    </Shell>
  );
}
