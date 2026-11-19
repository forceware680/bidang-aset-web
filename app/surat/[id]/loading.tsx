import { Shell } from "@/components/shell";
import { SkeletonForm, SkeletonTable } from "@/components/loading-states";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";

export default async function Loading() {
  const user = await requireUser();
  return (
    <Shell user={user} aktif="surat" judul="Detail surat">
      <SkeletonForm jumlah={6} judul="Memuat identitas surat" />

      <Card aria-label="Memuat dokumen surat">
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>

      <SkeletonTable kolom={5} baris={3} judul="Memuat riwayat disposisi" />
      <SkeletonForm jumlah={4} judul="Memuat data rapat" />
    </Shell>
  );
}
