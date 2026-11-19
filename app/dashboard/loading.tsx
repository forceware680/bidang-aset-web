import { Shell } from "@/components/shell";
import { SkeletonCards, SkeletonChart, SkeletonTable } from "@/components/loading-states";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";

export default async function Loading() {
  const user = await requireUser();
  return (
    <Shell user={user} aktif="dashboard" judul="Dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-5 w-72" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
      </div>

      <SkeletonCards />
      <SkeletonChart judul="Memuat grafik surat masuk per bulan" />
      <SkeletonTable kolom={5} baris={5} judul="Memuat surat masuk terbaru" />

      <Card aria-label="Memuat agenda terdekat">
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-8 w-36" />
        </CardFooter>
      </Card>
    </Shell>
  );
}
