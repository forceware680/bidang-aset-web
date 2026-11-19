import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SiteHeader({ judul, aksi }: { judul: string; aksi?: React.ReactNode }) {
  return (
    <header className="site-header flex min-h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-x-1 gap-y-2 px-4 lg:gap-x-2 lg:px-6">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Separator
          orientation="vertical"
          className="mx-2 hidden shrink-0 md:block data-[orientation=vertical]:h-4"
        />
        {/* Satu baris: judul mengambil sisa ruang dan dipotong dua baris di HP (satu baris truncate
          menyisakan ~24 karakter), di desktop satu baris truncate. */}
        <h1 className="line-clamp-2 min-w-0 flex-1 text-base font-medium leading-snug md:line-clamp-none md:truncate">{judul}</h1>
        {/* Slot kanan: hanya aksi halaman (tombol kembali, hamburger submenu di HP). Tombol mode
          gelap/terang tidak lagi di sini — ia pindah ke samping avatar di nav sidebar. */}
        <div className="flex shrink-0 items-center gap-2">{aksi}</div>
      </div>
    </header>
  );
}
