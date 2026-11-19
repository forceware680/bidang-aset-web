import { Shell } from "@/components/shell";
import { SkeletonCards, SkeletonChart, SkeletonFilter, SkeletonPieChart, SkeletonTable } from "@/components/loading-states";
import { requireUser } from "@/lib/auth";

export default async function Loading() {
  const user = await requireUser();
  return (
    <Shell user={user} aktif="rekap" judul="Rekap dan Laporan">
      <SkeletonFilter jumlah={1} judul="Memuat pilihan periode" />
      <SkeletonCards />

      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonChart judul="Memuat grafik surat masuk per bulan" />
        <SkeletonChart judul="Memuat grafik surat keluar per bulan" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonPieChart judul="Memuat komposisi kategori surat" />
        <SkeletonChart judul="Memuat grafik agenda per bulan" />
      </div>
      <SkeletonTable kolom={9} baris={6} judul="Memuat rekap per bulan" />
      <SkeletonTable kolom={2} baris={5} judul="Memuat surat per kategori" />
    </Shell>
  );
}
