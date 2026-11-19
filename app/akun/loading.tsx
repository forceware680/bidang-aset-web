import { Shell } from "@/components/shell";
import { SkeletonForm } from "@/components/loading-states";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";

export default async function Loading() {
  const user = await requireUser();
  return (
    <Shell user={user} aktif="akun" judul="Akun Saya">
      <Card aria-label="Memuat identitas akun">
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>

      <SkeletonForm jumlah={3} judul="Memuat formulir ganti kata sandi" />
    </Shell>
  );
}
