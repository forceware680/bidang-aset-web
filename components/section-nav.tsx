"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListChecksIcon } from "lucide-react";
import { cn } from "cn";
import { pilJumlahKelas } from "@/lib/gaya-nav";
import { Button } from "@/components/ui/button";

export type BagianSurat = { id: string; label: string; jumlah?: number; nomor?: number };

/** Navigasi bagian surat yang nempel di atas halaman: klik gulung ke bagian, bagian aktif ditandai.
 *  Gulung halus hanya jika pengguna tidak meminta motion dikurangi.
 *  `langkahHref` memberi jalan ke mode langkah-demi-langkah (satu bagian per layar). */
export function SectionNav({ bagian, langkahHref }: { bagian: BagianSurat[]; langkahHref?: string }) {
  const [aktif, setAktif] = useState(bagian[0]?.id ?? "");

  useEffect(() => {
    const elemen = bagian
      .map((b) => document.getElementById(b.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elemen.length === 0) return;

    const pengamat = new IntersectionObserver(
      (daftar) => {
        const terlihat = daftar
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (terlihat.length > 0) setAktif(terlihat[0].target.id);
      },
      // bagian dianggap aktif ketika puncaknya lewat 40% jendela dan masih ada 55% ruang di bawahnya
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
    );
    for (const el of elemen) pengamat.observe(el);
    return () => pengamat.disconnect();
  }, [bagian]);

  function lompat(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const halus = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: halus ? "smooth" : "auto", block: "start" });
    el.focus({ preventScroll: true });
    setAktif(id);
    history.replaceState(null, "", `#${id}`);
  }

  return (
    <nav
      aria-label="Bagian surat ini"
      className="tanpa-cetak sticky top-0 z-20 -mx-4 flex items-center gap-1 overflow-x-auto border-b border-(--border)/50 bg-background px-4 py-2 md:flex-wrap md:overflow-visible md:-mx-6 md:px-6 md:bg-background/85 md:backdrop-blur"
    >
      {bagian.map((b) => (
        <Button
          key={b.id}
          type="button"
          size="sm"
          variant={aktif === b.id ? "default" : "ghost"}
          data-slot="nav-tab"
          data-state={aktif === b.id ? "active" : "inactive"}
          aria-current={aktif === b.id ? "location" : undefined}
          className={cn("shrink-0 gap-1.5", aktif !== b.id && "text-foreground/75 hover:bg-accent hover:text-accent-foreground")}
          onClick={() => lompat(b.id)}
        >
          {b.nomor !== undefined ? (
            <span className="num text-xs opacity-75">{b.nomor}</span>
          ) : null}
          {b.label}
          {b.jumlah !== undefined ? <span className={pilJumlahKelas(aktif === b.id)}>{b.jumlah}</span> : null}
        </Button>
      ))}

      {langkahHref ? (
        <Button asChild size="sm" variant="ghost" className="ml-auto h-11 w-11 shrink-0 justify-center gap-0 rounded-full px-0 md:h-8 md:min-w-0">
          <Link href={langkahHref} aria-label="Satu bagian per layar"><ListChecksIcon className="size-4" /></Link>
        </Button>
      ) : null}
    </nav>
  );
}
