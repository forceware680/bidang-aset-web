import { headers } from "next/headers";
import { requireUser, bolehMengubah } from "@/lib/auth";
import { keteranganKunciMonitor } from "@/lib/monitor-token";
import { Shell } from "@/components/shell";
import { BagianMonitor } from "@/components/pengaturan/bagian-monitor";
import { NavBagian } from "@/components/pengaturan/nav-bagian";
import { jamText } from "@/lib/format";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PengaturanMonitorPage() {
  const user = await requireUser();
  const kunci = await keteranganKunciMonitor();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const url = host ? `${proto}://${host}/monitor?t=${kunci.token}` : `/monitor?t=${kunci.token}`;

  const [jumlahPenggunaAktif, jumlahJenisAktif, jumlahNama, jumlahAudit] = await Promise.all([
    prisma.users.count({ where: { is_active: true } }),
    prisma.jenis_surat.count({ where: { aktif: true } }),
    Promise.all([
      prisma.master_pengirim.count(),
      prisma.master_pejabat.count(),
      prisma.master_pegawai.count(),
      prisma.master_terusan.count(),
      prisma.master_penerima.count(),
    ]).then((a) => a.reduce((x, y) => x + y, 0)),
    prisma.audit_logs.count(),
  ]);

  return (
    <Shell user={user} aktif="pengaturan" judul="Pengaturan">
      <NavBagian
        aktif="monitor"
        jumlah={{ pengguna: jumlahPenggunaAktif, jenis: jumlahJenisAktif, nama: jumlahNama, jejak: jumlahAudit, monitor: 1 }}
      />

      <BagianMonitor
        token={kunci.token}
        url={url}
        dibuatPada={kunci.dibuatPada ? jamText(kunci.dibuatPada) : null}
        oleh={kunci.oleh}
        dariEnv={kunci.dariEnv}
        bolehUbah={user.role === "Administrator"}
      />
    </Shell>
  );
}
