import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Placeholder sementara saat halaman dimuat. Bentuknya mengikuti layout halaman asli,
 *  bukan hanya kotak abu-abu, supaya posisi konten tidak melompat saat data datang. */

export function SkeletonCards({ jumlah = 4 }: { jumlah?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Memuat ringkasan">
      {Array.from({ length: jumlah }).map((_, i) => (
        <Card key={i}>
          <CardContent>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-2 h-8 w-16" />
            <Skeleton className="mt-3 h-6 w-32 rounded-md" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SkeletonChart({ tinggi = "h-[220px]", judul }: { tinggi?: string; judul: string }) {
  return (
    <Card aria-label={judul}>
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent>
        <Skeleton className={`${tinggi} w-full`} />
      </CardContent>
    </Card>
  );
}

/** Donut + legend: bentuknya sama dengan StatPieChart (kotak donut lalu daftar). */
export function SkeletonPieChart({ judul }: { judul: string }) {
  return (
    <Card aria-label={judul}>
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-80" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="mx-auto h-[140px] w-full max-w-[220px] rounded-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

/** Baris filter (select/input + tombol) di atas daftar. */
export function SkeletonFilter({ jumlah = 3, judul }: { jumlah?: number; judul: string }) {
  return (
    <Card aria-label={judul}>
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3">
          {Array.from({ length: jumlah }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-40" />
            </div>
          ))}
          <Skeleton className="h-9 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SkeletonTable({
  kolom = 3,
  baris = 8,
  judul,
}: {
  kolom?: number;
  baris?: number;
  judul: string;
}) {
  return (
    <Card aria-label={judul}>
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-52" />
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: kolom }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-3 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: baris }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: kolom }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <p className="sr-only">Data sedang dimuat.</p>
    </Card>
  );
}

/** Isian form dua kolom, mengikuti FieldGroup pada form surat / sandi. */
export function SkeletonForm({ jumlah = 6, judul }: { jumlah?: number; judul: string }) {
  return (
    <Card aria-label={judul}>
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: jumlah }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-4 h-9 w-32" />
      </CardContent>
    </Card>
  );
}

export function SkeletonTabs({ trigger = 4, judul }: { trigger?: number; judul: string }) {
  return (
    <div aria-label={judul} className="flex w-full flex-wrap gap-1 rounded-2xl border border-(--border)/40 bg-muted/50 p-1">
      {Array.from({ length: trigger }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-28 rounded-xl" />
      ))}
    </div>
  );
}
