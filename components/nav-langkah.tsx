import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "lucide-react";

export type TujuanLangkah = { href: string; label: string };

/**
 * Bagian surat berada di tengah kolom, dan pinggir kiri/kanannya dipakai untuk Sebelumnya / Berikutnya.
 * Di layar kecil kedua tombol turun ke baris di bawah bagian karena tidak ada ruang di pinggir.
 */
export function NavLangkah({
  sebelum,
  berikutnya,
  selesai,
  children,
}: {
  sebelum?: TujuanLangkah;
  berikutnya?: TujuanLangkah;
  selesai?: TujuanLangkah;
  children: ReactNode;
}) {
  return (
    <div className="kronologi-scope">
      {sebelum ? (
        <Button asChild variant="outline" className="kronologi-sisi h-11 min-w-11 md:h-9">
          <Link href={sebelum.href} rel="prev" aria-label="Langkah sebelumnya">
            <ArrowLeftIcon className="size-4" />
            <span className="hidden lg:inline">Sebelumnya</span>
          </Link>
        </Button>
      ) : null}

      <div className="kronologi-wadah">{children}</div>

      {berikutnya ? (
        <Button asChild className="kronologi-sisi h-11 min-w-11 md:h-9">
          <Link href={berikutnya.href} rel="next" aria-label="Langkah berikutnya">
            <span className="hidden lg:inline">Berikutnya</span>
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      ) : selesai ? (
        <Button asChild className="kronologi-sisi h-11 min-w-11 md:h-9">
          <Link href={selesai.href} aria-label={selesai.label}>
            <span className="hidden lg:inline">{selesai.label}</span>
            <CheckIcon className="size-4" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
