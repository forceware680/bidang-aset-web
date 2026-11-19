import { Shell } from "@/components/shell";
import { SkeletonForm } from "@/components/loading-states";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";

export default async function Loading() {
  const user = await requireUser();
  return (
    <Shell user={user} aktif="keluar" judul="Detail surat keluar">
      <SkeletonForm jumlah={5} judul="Memuat identitas surat keluar" />

      <Card aria-label="Memuat dokumen surat keluar">
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    </Shell>
  );
}
