import Link from "next/link";
import { cn } from "cn";
import { prisma } from "@/lib/db";
import { FileTextIcon, HistoryIcon, ListChecksIcon, MonitorIcon, SmartphoneIcon, UsersIcon } from "lucide-react";

export type KunciBagian = "pengguna" | "jenis" | "nama" | "jejak" | "monitor" | "sesi";

const bagian: { kunci: KunciBagian; href: string; label: string; pendek: string; ikon: typeof UsersIcon }[] = [
  { kunci: "pengguna", href: "/pengaturan/pengguna", label: "Akun Pengguna", pendek: "Akun", ikon: UsersIcon },
  { kunci: "jenis", href: "/pengaturan/jenis", label: "Kategori Surat", pendek: "Kategori", ikon: FileTextIcon },
  { kunci: "nama", href: "/pengaturan/nama", label: "Daftar Nama", pendek: "Nama", ikon: ListChecksIcon },
  { kunci: "jejak", href: "/pengaturan/jejak", label: "History", pendek: "Jejak", ikon: HistoryIcon },
  { kunci: "monitor", href: "/pengaturan/monitor", label: "Token Monitor", pendek: "Monitor", ikon: MonitorIcon },
  { kunci: "sesi", href: "/pengaturan/sesi", label: "Perangkat", pendek: "Perangkat", ikon: SmartphoneIcon },
];

/// Jumlah tiap bagian untuk bilah bawah; jumlah perangkat yang masuk dihitung sendiri oleh NavBagian.
export type JumlahBagian = Record<Exclude<KunciBagian, "sesi">, number>;

export const ruteBagian: Record<KunciBagian, string> = {
  pengguna: "/pengaturan/pengguna",
  jenis: "/pengaturan/jenis",
  nama: "/pengaturan/nama",
  jejak: "/pengaturan/jejak",
  monitor: "/pengaturan/monitor",
  sesi: "/pengaturan/sesi",
};

/**
 * Navigasi antar bagian Pengaturan di layar kecil: bilah bawah melayang (navigasi seperti app Android).
 * Di desktop tidak ada pil lagi — submenu Pengaturan di sidebar sudah jadi navigasinya, jadi pil akan
 * jadi dua navigasi yang sama. Daftar nama tetap punya pil sendiri di dalam halamannya.
 */
export async function NavBagian({ aktif, jumlah }: { aktif: KunciBagian | null; jumlah: JumlahBagian }) {
  const perangkatAktif = await prisma.api_token.count({ where: { expires_at: { gt: new Date() } } });
  const nilai: Record<KunciBagian, number> = { ...jumlah, sesi: perangkatAktif };
  return (
    <nav
      aria-label="Bagian pengaturan (bilah bawah)"
      className="tanpa-cetak fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-(--input) bg-background px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
    >
      {bagian.map((b) => {
        const Ikon = b.ikon;
        const terpilih = b.kunci === aktif;
        return (
          <Link
            key={b.kunci}
            href={b.href}
            data-slot="nav-tab"
            data-state={terpilih ? "active" : "inactive"}
            aria-current={terpilih ? "page" : undefined}
            className={cn(
              "flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-1.5 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
              terpilih ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className={cn("flex size-8 items-center justify-center rounded-full", terpilih && "bg-primary/12")}>
              <Ikon className="size-5" aria-hidden="true" />
            </span>
            <span className="flex items-center gap-1 text-[0.62rem] leading-none">
              <span className={cn(terpilih && "font-semibold")}>{b.pendek}</span>
              <span className="num tabular-nums opacity-70" aria-hidden="true">{nilai[b.kunci]}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
