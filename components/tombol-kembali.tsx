import Link from "next/link";
import { Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Aksi kembali di header halaman: satu ikon panah melengkung (Undo2) tanpa teks dan tanpa garis;
 * label hanya jadi aria-label. Tap target tetap 44px supaya nyaman di ponsel.
 */
export function TombolKembali({ href, label }: { href: string; label: string }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      asChild
      aria-label={label}
      className="h-11 w-11 justify-center gap-0 rounded-full px-0"
    >
      <Link href={href}>
        <Undo2Icon className="size-5" />
      </Link>
    </Button>
  );
}
