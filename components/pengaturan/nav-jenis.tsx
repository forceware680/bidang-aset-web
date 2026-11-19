"use client";

import Link from "next/link";
import { cn } from "cn";
import { InboxIcon, SendIcon } from "lucide-react";

export type KunciJenis = "masuk" | "keluar";

const arah: { kunci: KunciJenis; href: string; label: string; ikon: typeof InboxIcon }[] = [
  { kunci: "masuk", href: "/pengaturan/jenis/masuk", label: "Kategori Surat Masuk", ikon: InboxIcon },
  { kunci: "keluar", href: "/pengaturan/jenis/keluar", label: "Kategori Surat Keluar", ikon: SendIcon },
];

/**
 * Navigasi dua daftar kategori surat lewat pil — hanya di desktop. Di layar kecil perpindahan
 * dilakukan lewat tombol hamburger di header (lihat MenuSubmenu), bukan pil yang harus digulir.
 */
export function NavJenis({ aktif, jumlah }: { aktif: KunciJenis | null; jumlah: Record<KunciJenis, number> }) {
  return (
    <nav
      aria-label="Kategori Surat"
      className="tanpa-cetak hidden flex-wrap gap-1 md:flex md:flex-nowrap"
    >
      {arah.map((a) => {
        const Ikon = a.ikon;
        const terpilih = a.kunci === aktif;
        return (
          <Link
            key={a.kunci}
            href={a.href}
            data-slot="nav-tab"
            data-state={terpilih ? "active" : "inactive"}
            aria-current={terpilih ? "page" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
              terpilih ? "bg-primary text-primary-foreground" : "text-foreground/75 hover:bg-accent",
            )}
          >
            <Ikon className="size-4" aria-hidden="true" />
            <span>{a.label}</span>
            <span className="num tabular-nums opacity-70" aria-hidden="true">{jumlah[a.kunci]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
