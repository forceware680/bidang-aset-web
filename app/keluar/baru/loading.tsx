import { Shell } from "@/components/shell";
import { SkeletonForm } from "@/components/loading-states";
import { requireUser } from "@/lib/auth";

export default async function Loading() {
  const user = await requireUser();
  return (
    <Shell user={user} aktif="keluar" judul="Tambah Surat Keluar">
      <SkeletonForm jumlah={7} judul="Memuat formulir surat keluar" />
    </Shell>
  );
}
