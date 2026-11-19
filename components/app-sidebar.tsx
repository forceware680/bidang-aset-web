"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import {
  CalendarDays,
  ChartColumn,
  CircleUser,
  ChevronRight,
  FileText,
  History,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Monitor,
  ArrowRightLeft,
  Send,
  Settings,
  Smartphone,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import type { AktifUser } from "@/lib/auth";

const grup: { label: string; item: { href: string; kunci: string; label: string; icon: typeof Settings; khususAdmin?: boolean; sub?: { href: string; label: string; icon: typeof Settings }[] }[] }[] = [
  {
    label: "Ringkasan",
    item: [{ href: "/dashboard", kunci: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Surat & Disposisi",
    item: [
      { href: "/surat", kunci: "surat", label: "Surat Masuk", icon: Inbox },
      { href: "/keluar", kunci: "keluar", label: "Surat Keluar", icon: Send },
      { href: "/disposisi", kunci: "disposisi", label: "Disposisi", icon: ArrowRightLeft },
    ],
  },
  {
    label: "Agenda & Laporan",
    item: [
      { href: "/rapat", kunci: "rapat", label: "Kalender Agenda", icon: CalendarDays },
      { href: "/rekap", kunci: "rekap", label: "Rekap dan Laporan", icon: ChartColumn },
    ],
  },
  {
    label: "Akun & pengaturan",
    item: [
      {
        href: "/pengaturan",
        kunci: "pengaturan",
        label: "Pengaturan",
        icon: Settings,
        khususAdmin: true,
        sub: [
          { href: "/pengaturan/pengguna", label: "Akun Pengguna", icon: Users },
          { href: "/pengaturan/jenis", label: "Kategori Surat", icon: FileText },
          { href: "/pengaturan/nama", label: "Daftar Nama", icon: ListChecks },
          { href: "/pengaturan/jejak", label: "History", icon: History },
          { href: "/pengaturan/monitor", label: "Token Monitor", icon: Monitor },
          { href: "/pengaturan/sesi", label: "Perangkat", icon: Smartphone },
        ],
      },
      { href: "/akun", kunci: "akun", label: "Akun Saya", icon: CircleUser },
    ],
  },
];

function inisial(nama: string): string {
  return nama
    .split(/\s+/)
    .slice(0, 2)
    .map((k) => k[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppSidebar({
  user,
  aktif,
  keluarAction,
}: {
  user: AktifUser;
  aktif: string;
  keluarAction: () => Promise<void>;
}) {
  const { isMobile } = useSidebar();
  const keluarForm = React.useRef<HTMLFormElement>(null);
  // Submenu Pengaturan dibuka sendiri oleh petugas; otomatis terbuka begitu salah satu bagiannya dibuka,
  // supaya jelas bagian mana sedang aktif tanpa harus membuka menu dulu.
  const diPengaturan = aktif === "pengaturan" || aktif.startsWith("pengaturan/");
  const [subPengaturan, setSubPengaturan] = React.useState(diPengaturan);
  React.useEffect(() => {
    if (diPengaturan) setSubPengaturan(true);
  }, [diPengaturan]);

  return (
    <Sidebar variant="inset" collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <img src="/logo.svg" alt="" className="size-8 shrink-0" />
                <div className="grid flex-1 text-left leading-snug">
                  <span className="truncate font-medium">Bidang Aset BPKAD</span>
                  <span className="truncate text-xs text-muted-foreground">Kota Magelang</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {grup.map((g) => {
          const item = g.item.filter((m) => !m.khususAdmin || user.role === "Administrator");
          if (item.length === 0) return null;
          return (
            <SidebarGroup key={g.label}>
              <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {item.map((m) => {
                    const aktifnya = m.kunci === aktif || aktif.startsWith(`${m.kunci}/`);
                    return (
                      <SidebarMenuItem key={m.kunci}>
                        <SidebarMenuButton asChild isActive={aktifnya} tooltip={m.label}>
                          <Link href={m.href} aria-current={aktifnya ? "page" : undefined}>
                            <m.icon />
                            <span>{m.label}</span>
                          </Link>
                        </SidebarMenuButton>
                        {m.sub ? (
                          <>
                            <SidebarMenuAction
                              aria-label={subPengaturan ? "Tutup bagian pengaturan" : "Buka bagian pengaturan"}
                              aria-expanded={subPengaturan}
                              showOnHover={!subPengaturan}
                              onClick={() => setSubPengaturan((v) => !v)}
                              className={cn(subPengaturan && "opacity-100")}
                            >
                              <ChevronRight className={cn("transition-transform duration-150", subPengaturan && "rotate-90")} />
                            </SidebarMenuAction>
                            {subPengaturan ? (
                              <SidebarMenuSub>
                                {m.sub.map((s) => (
                                  <SidebarMenuSubItem key={s.href}>
                                    <SidebarMenuSubButton
                                      asChild
                                      size="sm"
                                      isActive={aktif === s.href.slice(1) || aktif.startsWith(`${s.href.slice(1)}/`)}
                                    >
                                      <Link href={s.href} aria-current={aktif === s.href.slice(1) ? "page" : undefined}>
                                        <s.icon />
                                        <span>{s.label}</span>
                                      </Link>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                              </SidebarMenuSub>
                            ) : null}
                          </>
                        ) : null}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {/* Tombol mode gelap/terang sekarang di samping avatar akun — bukan di header lagi. */}
          <SidebarMenuItem className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg text-xs">{inisial(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate font-medium">{user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{user.role}</span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "top"}
                align="start"
                sideOffset={4}
              >
                {/* Trigger sudah menampilkan nama + peran; menu hanya menambahkan email supaya tidak
                    mengulang identitas dan tidak jadi tiga baris besar. */}
                <DropdownMenuLabel className="px-1 text-xs font-normal text-muted-foreground">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/akun">
                    <CircleUser />
                    Akun Saya
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => keluarForm.current?.requestSubmit()}>
                  <LogOut />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <ThemeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
        <form ref={keluarForm} action={keluarAction} className="sr-only">
          <button type="submit" className="sr-only">
            Keluar
          </button>
        </form>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
