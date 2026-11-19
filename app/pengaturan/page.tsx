import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { NavBagian } from "@/components/pengaturan/nav-bagian";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileTextIcon, HistoryIcon, ListChecksIcon, MonitorIcon, SmartphoneIcon, UsersIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const ruteBagian: Record<string, string> = {
  akun: "/pengaturan/pengguna",
  pengguna: "/pengaturan/pengguna",
  jenis: "/pengaturan/jenis",
  nama: "/pengaturan/nama",
  audit: "/pengaturan/jejak",
  sesi: "/pengaturan/sesi",
};

const bagianNama = ["pengirim", "pejabat", "pegawai", "terusan", "penerima"];

export default async function PengaturanPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  // Alamat lama dengan query (?tab=..., ?bagian=..., ?nama=..., ?entitas=..., ?halaman=...) masih dipakai
  // tautan lama dan catatan lama; dipindah ke halaman bagian yang sekarang.
  const tab = String(sp.tab ?? "");
  if (tab) {
    if (tab === "nama") {
      const bagian = bagianNama.includes(String(sp.bagian ?? "")) ? String(sp.bagian) : "pengirim";
      const nama = sp.nama ? `?nama=${encodeURIComponent(String(sp.nama))}` : "";
      redirect(`/pengaturan/nama/${bagian}${nama}`);
    }
    const tujuan = ruteBagian[tab] ?? "/pengaturan/pengguna";
    if (tab === "audit") {
      const q = new URLSearchParams();
      if (sp.halaman) q.set("halaman", String(sp.halaman));
      if (sp.entitas) q.set("entitas", String(sp.entitas));
      const query = q.toString();
      redirect(`/pengaturan/jejak${query ? `?${query}` : ""}`);
    }
    redirect(tujuan);
  }

  const [jumlahPengguna, jumlahPenggunaAktif, jumlahJenis, jumlahJenisAktif, jumlahAudit, jumlahPerangkatAktif] = await Promise.all([
    prisma.users.count(),
    prisma.users.count({ where: { is_active: true } }),
    prisma.jenis_surat.count(),
    prisma.jenis_surat.count({ where: { aktif: true } }),
    prisma.audit_logs.count(),
    prisma.api_token.count({ where: { expires_at: { gt: new Date() } } }),
  ]);
  const jumlahNama =
    (await prisma.master_pengirim.count()) +
    (await prisma.master_pejabat.count()) +
    (await prisma.master_pegawai.count()) +
    (await prisma.master_terusan.count()) +
    (await prisma.master_penerima.count());

  const bagian = [
    {
      href: "/pengaturan/pengguna",
      label: "Akun pengguna",
      ikon: UsersIcon,
      jumlah: `${jumlahPenggunaAktif} aktif dari ${jumlahPengguna}`,
      ket: "Daftar akun, peran, dan status. Buat akun baru untuk petugas atau pimpinan.",
    },
    {
      href: "/pengaturan/jenis",
      label: "Kategori surat",
      ikon: FileTextIcon,
      jumlah: `${jumlahJenisAktif} aktif dari ${jumlahJenis}`,
      ket: "Klasifikasi surat masuk dan surat keluar. Yang dinonaktifkan tidak muncul di formulir.",
    },
    {
      href: "/pengaturan/nama",
      label: "Daftar nama",
      ikon: ListChecksIcon,
      jumlah: `${jumlahNama} nama`,
      ket: "Pengirim surat, pemberi disposisi, pegawai peserta agenda, tujuan diteruskan, dan tujuan surat keluar.",
    },
    {
      href: "/pengaturan/jejak",
      label: "Jejak perubahan data",
      ikon: HistoryIcon,
      jumlah: `${jumlahAudit} catatan`,
      ket: "Catatan perubahan hanya ditulis dan dibaca — tidak bisa diubah atau dihapus.",
    },
    {
      href: "/pengaturan/monitor",
      label: "Kunci layar monitor",
      ikon: MonitorIcon,
      jumlah: "1 layar",
      ket: "Alamat layar /monitor untuk ruang rapat. Kunci bisa dibalik; kunci lama berhenti berlaku seketika.",
    },
    {
      href: "/pengaturan/sesi",
      label: "Perangkat masuk Android",
      ikon: SmartphoneIcon,
      jumlah: `${jumlahPerangkatAktif} perangkat aktif`,
      ket: "HP yang masuk lewat aplikasi Android: nama, email, perangkat, dan waktu terakhir dipakai. Administrator bisa mencabut token sehingga perangkat logout dari jauh.",
    },
  ];

  return (
    <Shell user={user} aktif="pengaturan" judul="Pengaturan">
      <p className="max-w-[62ch] text-sm text-muted-foreground">
        Bagian pengaturan akun pengguna, kategori surat masuk dan keluar, daftar nama resmi, jejak perubahan data,
        kunci layar monitor, dan perangkat yang masuk lewat aplikasi Android. Hanya Administrator yang bisa menulis di bagian ini.
      </p>

      <NavBagian
        aktif={null}
        jumlah={{ pengguna: jumlahPenggunaAktif, jenis: jumlahJenisAktif, nama: jumlahNama, jejak: jumlahAudit, monitor: 1 }}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {bagian.map((b) => (
          <Card key={b.href} className="transition-colors hover:bg-accent/40">
            <CardHeader>
              <CardTitle id={b.href.slice(1)} className="flex flex-wrap items-center gap-2">
                <Link href={b.href} className="flex items-center gap-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 rounded-md">
                  <b.ikon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {b.label}
                </Link>
                <Badge variant="secondary" className="num ml-auto">{b.jumlah}</Badge>
              </CardTitle>
              <CardDescription>{b.ket}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={b.href} className="text-sm text-primary outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 rounded-md">
                Buka bagian ini
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </Shell>
  );
}
