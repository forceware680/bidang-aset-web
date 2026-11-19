import { Shell } from "@/components/shell";
import { SkeletonTabs, SkeletonTable } from "@/components/loading-states";
import { requireUser } from "@/lib/auth";

export default async function Loading() {
  const user = await requireUser();
  return (
    <Shell user={user} aktif="pengaturan" judul="Pengaturan">
      <SkeletonTabs trigger={4} judul="Memuat bagian pengaturan" />
      <SkeletonTable kolom={5} baris={6} judul="Memuat daftar akun pengguna" />
    </Shell>
  );
}
