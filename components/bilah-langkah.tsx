"use client";

import { useEffect } from "react";
import Link from "next/link";
import { LayoutDashboardIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { pilJumlahKelas } from "@/lib/gaya-nav";

export type LangkahInfo = { id: string; label: string; jumlah?: number; href: string };

/**
 * Navigator langkah surat: satu bagian tampil sekarang. Berikutnya / Sebelumnya memindahkan langkah,
 * nomor langkah bisa dilompat langsung (skip), dan panah kiri/kanan pada keyboard juga memindah
 * langkah selama pengguna tidak sedang mengetik di isian.
 */
export function BilahLangkah({ daftar, aktif, hrefSemua }: { daftar: LangkahInfo[]; aktif: number; hrefSemua: string }) {
  const router = useRouter();
  const total = daftar.length;

  useEffect(() => {
    function ditekan(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (e.key === "ArrowRight" && aktif < total) {
        e.preventDefault();
        router.push(daftar[aktif].href);
      } else if (e.key === "ArrowLeft" && aktif > 1) {
        e.preventDefault();
        router.push(daftar[aktif - 2].href);
      }
    }
    window.addEventListener("keydown", ditekan);
    return () => window.removeEventListener("keydown", ditekan);
  }, [aktif, total, daftar, router]);

  const kelasTombol = "h-11 min-w-11 shrink-0 md:h-8 md:min-w-0";

  return (
    <nav
      aria-label="Langkah surat ini"
      className="tanpa-cetak sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-1 border-b border-(--border)/50 bg-background px-4 py-2 md:-mx-6 md:px-6 md:bg-background/85 md:backdrop-blur"
    >
      <span className="num shrink-0 text-xs text-muted-foreground">
        Langkah {aktif} dari {total}
      </span>

      {/* Nomor langkah: di layar kecil menjadi baris kedua yang bisa digulung, di desktop satu baris.
          Previous/next tidak di sini — mereka berada di bawah bagian yang sedang dibuka. */}
      <div className="order-last flex basis-full flex-wrap items-center gap-1 overflow-x-auto md:order-none md:basis-auto md:overflow-visible">
        {daftar.map((l, i) => (
          <Button
            key={l.id}
            asChild
            size="sm"
            variant={aktif === i + 1 ? "default" : "ghost"}
            data-slot="nav-tab"
            data-state={aktif === i + 1 ? "active" : "inactive"}
            className={cn(kelasTombol, "gap-1.5", aktif !== i + 1 && "text-foreground/75 hover:bg-accent hover:text-accent-foreground")}
          >
            <Link href={l.href} aria-current={aktif === i + 1 ? "location" : undefined}>
              <span className="num text-xs opacity-75">{i + 1}</span>
              <span className="hidden md:inline">{l.label}</span>
              {/* Jumlah jadi pil kecil supaya terbaca sebagai hitungan, bukan bagian dari nama bagian. */}
              {l.jumlah !== undefined ? <span className={pilJumlahKelas(aktif === i + 1)}>{l.jumlah}</span> : null}
            </Link>
          </Button>
        ))}
      </div>

      <Button asChild size="sm" variant="ghost" className={cn(kelasTombol, "ml-auto")}>
        <Link href={hrefSemua} aria-label="Tampilkan semua bagian"><LayoutDashboardIcon className="size-4" /></Link>
      </Button>
    </nav>
  );
}
