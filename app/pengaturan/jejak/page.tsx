import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { NavBagian } from "@/components/pengaturan/nav-bagian";
import { BagianJejak } from "@/components/pengaturan/bagian-jejak";

export const dynamic = "force-dynamic";

export default async function JejakPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const entitas = sp.entitas ? String(sp.entitas) : "";
  const totalAudit = await prisma.audit_logs.count();

  const [audit, entitasAudit, jumlahPenggunaAktif, jumlahJenisAktif] = await Promise.all([
    // Semua baris dikirim ke client: BagianJejak mempaginasi di browser supaya klik halaman
    // instan seperti daftar pengaturan, bukan navigasi server tiap klik.
    prisma.audit_logs.findMany({
      include: { users: { select: { name: true } } },
      orderBy: { created_at: "desc" },
    }),
    prisma.$queryRaw<{ entitas: string }[]>`SELECT DISTINCT entity_type AS entitas FROM audit_logs ORDER BY entity_type ASC`,
    prisma.users.count({ where: { is_active: true } }),
    prisma.jenis_surat.count({ where: { aktif: true } }),
  ]);
  const jumlahNama =
    (await prisma.master_pengirim.count()) +
    (await prisma.master_pejabat.count()) +
    (await prisma.master_pegawai.count()) +
    (await prisma.master_terusan.count()) +
    (await prisma.master_penerima.count());

  const daftarAudit = audit.map((a) => ({
    id: a.id,
    created_at: a.created_at.toISOString(),
    nama_user: a.users?.name ?? null,
    action: a.action,
    entity_type: a.entity_type,
    description: a.description ?? null,
  }));

  return (
    <Shell user={user} aktif="pengaturan/jejak" judul="History">
      <NavBagian aktif="jejak" jumlah={{ pengguna: jumlahPenggunaAktif, jenis: jumlahJenisAktif, nama: jumlahNama, jejak: totalAudit, monitor: 1 }} />
      <BagianJejak
        audit={daftarAudit}
        entitasAwal={entitas}
        entitasAudit={entitasAudit.map((e) => e.entitas)}
      />
    </Shell>
  );
}
