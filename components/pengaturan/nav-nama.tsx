import Link from "next/link";
import { cn } from "cn";

export type KunciNama = "pengirim" | "pejabat" | "pegawai" | "terusan" | "penerima";

export const daftarNama: { kunci: KunciNama; label: string; href: string }[] = [
  { kunci: "pengirim", label: "Pengirim Surat", href: "/pengaturan/nama/pengirim" },
  { kunci: "pejabat", label: "Pemberi Disposisi", href: "/pengaturan/nama/pejabat" },
  { kunci: "pegawai", label: "Pegawai Bidang Aset", href: "/pengaturan/nama/pegawai" },
  { kunci: "terusan", label: "Tujuan Diteruskan", href: "/pengaturan/nama/terusan" },
  { kunci: "penerima", label: "Tujuan Surat Keluar", href: "/pengaturan/nama/penerima" },
];

/**
 * Navigasi antar daftar nama lewat pil — hanya di desktop. Di layar kecil lima pil tidak muat,
 * jadi berpindah dilakukan lewat tombol hamburger di header (MenuSubmenu), bukan pil yang digulir.
 */
export function NavNama({ aktif, jumlah }: { aktif: KunciNama; jumlah: Record<KunciNama, number> }) {
  return (
    <nav
      aria-label="Daftar Nama"
      className="tanpa-cetak hidden gap-1 overflow-x-auto rounded-full border border-(--input) p-1 md:flex"
    >
      {daftarNama.map((d) => {
        const terpilih = d.kunci === aktif;
        return (
          <Link
            key={d.kunci}
            href={d.href}
            data-slot="nav-tab"
            data-state={terpilih ? "active" : "inactive"}
            aria-current={terpilih ? "page" : undefined}
            className={cn(
              "inline-flex min-h-7 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
              terpilih ? "bg-primary text-primary-foreground" : "text-foreground/75 hover:bg-accent hover:text-foreground",
            )}
          >
            {d.label}
            <span className="num text-xs tabular-nums opacity-75" aria-hidden="true">{jumlah[d.kunci]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
