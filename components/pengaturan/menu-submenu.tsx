"use client";

import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "cn";

export type ItemMenu = { href: string; label: string; jumlah?: number; aktif?: boolean };

/**
 * Tombol hamburger untuk submenu sebuah halaman, hanya di layar kecil: menggantikan tempat tombol
 * mode di header. Daftar submenu dibuka sebagai popover — sama seperti menu aplikasi, bukan pil
 * yang harus digulir. Di desktop submenu tetap pil biasa (NavNama / NavJenis) atau sidebar.
 */
export function MenuSubmenu({ judul, items }: { judul: string; items: ItemMenu[] }) {
  const aktif = items.find((i) => i.aktif);
  return (
    <div className="tanpa-cetak md:hidden">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={`Buka menu ${judul} — saat ini ${aktif?.label ?? judul}`}
          >
            <MenuIcon className="size-5" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={6} className="w-[min(20rem,calc(100vw-2rem))] p-2">
          <div className="flex flex-col gap-1">
            {items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                aria-current={i.aktif ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center justify-between gap-2 rounded-lg px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
                  i.aktif ? "bg-primary text-primary-foreground" : "text-foreground/75 hover:bg-accent hover:text-foreground",
                )}
              >
                <span className="truncate">{i.label}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {i.jumlah != null ? <span className="num text-xs tabular-nums opacity-75" aria-hidden="true">{i.jumlah}</span> : null}
                </span>
              </Link>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
