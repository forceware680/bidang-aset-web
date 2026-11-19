import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { logout } from "@/lib/actions/auth";
import type { AktifUser } from "@/lib/auth";

export function Shell({
  user,
  aktif,
  judul,
  aksi,
  children,
}: {
  user: AktifUser;
  aktif: string;
  judul: string;
  aksi?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={user} aktif={aktif} keluarAction={logout} />
      <SidebarInset>
        <SiteHeader judul={judul} aksi={aksi} />
        <div className="flex flex-1 flex-col">
          {/* pb besar di layar kecil: tombol melayang dan bilah bawah navigasi Pengaturan berada di atas halaman. */}
          <div className="@container/main flex flex-1 flex-col gap-4 px-4 pt-4 pb-[5.5rem] md:gap-6 md:px-6 md:py-6">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
