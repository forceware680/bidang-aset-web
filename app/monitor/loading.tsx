import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="dark flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex flex-col gap-4 border-b border-border px-8 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-2xl sm:size-14" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-72 rounded-xl sm:h-7" />
            <Skeleton className="h-4 w-56 rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-10 w-32 rounded-xl sm:h-12" />
      </header>
      <main className="relative grid flex-1 items-start px-8 py-8">
        <div className="col-start-1 row-start-1 grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-72 w-full rounded-3xl" />
          <Skeleton className="h-72 w-full rounded-3xl" />
          <Skeleton className="h-72 w-full rounded-3xl" />
          <Skeleton className="h-72 w-full rounded-3xl" />
        </div>
      </main>
      <footer className="flex items-center gap-4 border-t border-border px-8 py-4">
        <Skeleton className="h-11 w-28 rounded-full" />
        <Skeleton className="h-4 w-64 rounded-xl" />
        <Skeleton className="h-11 w-64 rounded-full" />
      </footer>
    </div>
  );
}
