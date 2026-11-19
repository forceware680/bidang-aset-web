import { Shell } from "@/components/shell";
import { SkeletonTable } from "@/components/loading-states";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";

export default async function Loading() {
  const user = await requireUser();
  return (
    <Shell user={user} aktif="rapat" judul="Kalender agenda">
      <Card aria-label="Memuat kalender agenda">
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>

      <Card aria-label="Memuat agenda yang masih akan datang">
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-56" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>

      <Card aria-label="Memuat formulir agenda">
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-9 w-full sm:col-span-2" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
        <CardFooter className="border-t border-(--border)/50 px-4 py-4">
          <Skeleton className="h-9 w-32" />
        </CardFooter>
      </Card>

      <SkeletonTable kolom={5} baris={6} judul="Memuat agenda yang sudah lewat" />
    </Shell>
  );
}
