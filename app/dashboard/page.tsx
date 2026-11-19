import Link from "next/link";
import { ExternalLinkIcon, InboxIcon, PlusIcon } from "lucide-react";
import { bolehMengubah, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Shell } from "@/components/shell";
import { StatBarChart } from "@/components/stat-chart";
import { FabTambahSurat } from "@/components/fab-tambah-surat";
import { MetricCard, deltaSekarang } from "@/components/metric-card";
import type { ChartConfig } from "@/components/ui/chart";
import type { VariantProps } from "class-variance-authority";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { labelStatusSurat, labelStatusSuratKeluar, labelUndangan, tone } from "@/lib/status";
import { namaBulan, tanggal, tanggalJamText } from "@/lib/format";
import { rekapPerBulan } from "@/lib/rekap";
import { sinkronkanRapatLewatWaktu } from "@/lib/rapat-waktu";

const periode = [
  { key: "hari", label: "Hari ini" },
  { key: "bulan", label: "Bulan ini" },
  { key: "tahun", label: "Tahun ini" },
  { key: "semua", label: "Semua" },
];

const konfigurasiSurat = {
  surat: { label: "Surat masuk", color: "var(--color-chart-masuk)" },
  keluar: { label: "Surat keluar", color: "var(--color-chart-keluar)" },
} satisfies ChartConfig;

function rentang(key: string): { mulai: Date | null; akhir: Date | null } {
  const sekarang = new Date();
  if (key === "hari") {
    const awal = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate());
    return { mulai: awal, akhir: new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate(), 23, 59, 59) };
  }
  if (key === "bulan") {
    return { mulai: new Date(sekarang.getFullYear(), sekarang.getMonth(), 1), akhir: null };
  }
  if (key === "tahun") {
    return { mulai: new Date(sekarang.getFullYear(), 0, 1), akhir: null };
  }
  return { mulai: null, akhir: null };
}

/**
 * Pembanding: window yang sama digeser mundur satu periode dan dipotong sampai tanggal/jam yang
 * sama, supaya "naik 3" berarti seperti-untuk-seperti (sebagian vs penuh akan menyesatkan).
 */
function rentangSebelum(key: string): { mulai: Date; akhir: Date; acuan: string } | null {
  const sekarang = new Date();
  if (key === "hari") {
    const kemarin = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate() - 1);
    return {
      mulai: kemarin,
      akhir: new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate() - 1, sekarang.getHours(), sekarang.getMinutes()),
      acuan: "kemarin",
    };
  }
  if (key === "bulan") {
    const hariPembanding = Math.min(sekarang.getDate(), new Date(sekarang.getFullYear(), sekarang.getMonth(), 0).getDate());
    return {
      mulai: new Date(sekarang.getFullYear(), sekarang.getMonth() - 1, 1),
      akhir: new Date(sekarang.getFullYear(), sekarang.getMonth() - 1, hariPembanding, sekarang.getHours(), sekarang.getMinutes()),
      acuan: "bulan lalu",
    };
  }
  if (key === "tahun") {
    return {
      mulai: new Date(sekarang.getFullYear() - 1, 0, 1),
      akhir: new Date(sekarang.getFullYear() - 1, sekarang.getMonth(), sekarang.getDate(), sekarang.getHours(), sekarang.getMinutes()),
      acuan: "tahun lalu",
    };
  }
  return null;
}

type Statistik = {
  surat: bigint;
  belum_disposisi: bigint;
  undangan: bigint;
  belum_selesai: bigint;
  rapat_mendatang: bigint;
  keluar: bigint;
  keluar_belum_kirim: bigint;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  await sinkronkanRapatLewatWaktu();
  const sp = await searchParams;
  const pilih = periode.some((p) => p.key === sp.periode) ? String(sp.periode) : "bulan";
  const { mulai, akhir } = rentang(pilih);
  const pembanding = rentangSebelum(pilih);

  let statistik: Statistik | null = null;
  let statistikSebelum: Statistik | null = null;
  let suratTerbaru: { id: string; nomor_agenda: string; tanggal_terima: Date; pengirim: string; perihal: string; status_surat: string; status_undangan_rapat: string }[] = [];
  let keluarTerbaru: { id: string; nomor_surat: string; tanggal_surat: Date; tujuan: string; perihal: string; status_surat: string }[] = [];
  let rapatTerdekat: { id: string; nomor_agenda: string; agenda_rapat: string; tanggal_mulai: Date; tempat: string | null; status_rapat: string }[] = [];
  let perBulan: { label: string; surat: number; keluar: number }[] = [];
  let galat = "";

  const tahunIni = new Date().getFullYear();

  try {
    const statistikBaris = await prisma.$queryRaw<Statistik[]>`
      SELECT
        count(*) AS surat,
        count(*) FILTER (WHERE jumlah_disposisi = 0) AS belum_disposisi,
        count(*) FILTER (WHERE status_undangan_rapat = 'ya') AS undangan,
        (SELECT count(*) FROM v_disposisi_aktif WHERE status_tindak_lanjut IN ('belum','proses') AND (${mulai}::date IS NULL OR tanggal_disposisi >= ${mulai}::date) AND (${akhir}::date IS NULL OR tanggal_disposisi <= ${akhir}::date)) AS belum_selesai,
        (SELECT count(*) FROM v_rapat_aktif WHERE tanggal_mulai >= now()) AS rapat_mendatang,
        (SELECT count(*) FROM v_surat_keluar_aktif WHERE (${mulai}::date IS NULL OR tanggal_surat >= ${mulai}::date) AND (${akhir}::date IS NULL OR tanggal_surat <= ${akhir}::date)) AS keluar,
        (SELECT count(*) FROM v_surat_keluar_aktif WHERE status_surat = 'draf' AND (${mulai}::date IS NULL OR tanggal_surat >= ${mulai}::date) AND (${akhir}::date IS NULL OR tanggal_surat <= ${akhir}::date)) AS keluar_belum_kirim
      FROM v_surat_aktif
      WHERE (${mulai}::date IS NULL OR tanggal_terima >= ${mulai}::date)
        AND (${akhir}::date IS NULL OR tanggal_terima <= ${akhir}::date)
    `;
    statistik = statistikBaris[0] ?? null;

    if (pembanding) {
      const barisSebelum = await prisma.$queryRaw<Statistik[]>`
      SELECT
        count(*) AS surat,
        count(*) FILTER (WHERE jumlah_disposisi = 0) AS belum_disposisi,
        count(*) FILTER (WHERE status_undangan_rapat = 'ya') AS undangan,
        (SELECT count(*) FROM v_disposisi_aktif WHERE status_tindak_lanjut IN ('belum','proses') AND tanggal_disposisi >= ${pembanding.mulai}::date AND tanggal_disposisi <= ${pembanding.akhir}::date) AS belum_selesai,
        (SELECT count(*) FROM v_rapat_aktif WHERE tanggal_mulai >= now()) AS rapat_mendatang,
        (SELECT count(*) FROM v_surat_keluar_aktif WHERE tanggal_surat >= ${pembanding.mulai}::date AND tanggal_surat <= ${pembanding.akhir}::date) AS keluar,
        (SELECT count(*) FROM v_surat_keluar_aktif WHERE status_surat = 'draf') AS keluar_belum_kirim
      FROM v_surat_aktif
      WHERE tanggal_terima >= ${pembanding.mulai}::date AND tanggal_terima <= ${pembanding.akhir}::date
    `;
      statistikSebelum = barisSebelum[0] ?? null;
    }

    suratTerbaru = await prisma.$queryRaw<{
      id: string;
      nomor_agenda: string;
      tanggal_terima: Date;
      pengirim: string;
      perihal: string;
      status_surat: string;
      status_undangan_rapat: string;
    }[]>`
      SELECT id, nomor_agenda, tanggal_terima, pengirim, perihal, status_surat, status_undangan_rapat
      FROM v_surat_aktif
      ORDER BY tanggal_terima DESC
      LIMIT 10
    `;

    rapatTerdekat = await prisma.$queryRaw<{
      id: string;
      nomor_agenda: string;
      agenda_rapat: string;
      tanggal_mulai: Date;
      tempat: string | null;
      status_rapat: string;
    }[]>`
      SELECT id, nomor_agenda, agenda_rapat, tanggal_mulai, tempat, status_rapat
      FROM v_rapat_aktif
      WHERE tanggal_mulai >= now()
      ORDER BY tanggal_mulai
      LIMIT 5
    `;

    keluarTerbaru = await prisma.$queryRaw<{
      id: string;
      nomor_surat: string;
      tanggal_surat: Date;
      tujuan: string;
      perihal: string;
      status_surat: string;
    }[]>`
      SELECT id, nomor_surat, tanggal_surat, tujuan, perihal, status_surat
      FROM v_surat_keluar_aktif
      ORDER BY tanggal_surat DESC
      LIMIT 6
    `;

    perBulan = (await rekapPerBulan(new Date(`${tahunIni}-01-01T00:00:00Z`), new Date(`${tahunIni}-12-31T23:59:59Z`))).map(
      (b) => ({ label: namaBulan(b.bulan), surat: b.surat, keluar: b.keluar }),
    );
  } catch (e) {
    galat = e instanceof Error ? e.message : "Server data belum bisa dihubungi.";
  }

  const acuan = pembanding?.acuan ?? null;
  const nilaiSekarang = (k: keyof Statistik) => Number(statistik?.[k] ?? 0);
  const nilaiSebelum = (k: keyof Statistik) => (statistikSebelum ? Number(statistikSebelum[k]) : null);

  const kartu = statistik
    ? [
        {
          label: "Surat masuk",
          nilai: statistik.surat.toString(),
          delta: acuan ? deltaSekarang(nilaiSekarang("surat"), nilaiSebelum("surat"), acuan, "netral") : null,
          catatan: labelPeriode(pilih),
        },
        {
          label: "Surat keluar",
          nilai: statistik.keluar.toString(),
          delta: acuan ? deltaSekarang(nilaiSekarang("keluar"), nilaiSebelum("keluar"), acuan, "netral") : null,
          catatan: labelPeriode(pilih),
        },
        {
          label: "Surat keluar belum dikirim",
          nilai: statistik.keluar_belum_kirim.toString(),
          delta: null,
          catatan: "Draf yang menunggu tanda tangan",
        },
        {
          label: "Belum didisposisikan",
          nilai: statistik.belum_disposisi.toString(),
          delta: acuan ? deltaSekarang(nilaiSekarang("belum_disposisi"), nilaiSebelum("belum_disposisi"), acuan, "buruk") : null,
          catatan: "Surat tanpa disposisi",
        },
        {
          label: "Disposisi belum selesai",
          nilai: statistik.belum_selesai.toString(),
          delta: acuan ? deltaSekarang(nilaiSekarang("belum_selesai"), nilaiSebelum("belum_selesai"), acuan, "buruk") : null,
          catatan: "Instruksi yang masih jalan",
        },
        {
          label: "Agenda mendatang",
          nilai: statistik.rapat_mendatang.toString(),
          delta: null,
          catatan: "Jadwal aktif mulai hari ini",
        },
      ]
    : [];

  return (
    <Shell
      user={user}
      aktif="dashboard"
      judul="Dashboard"
      aksi={
        bolehMengubah(user.role) ? (
          <Button size="sm" asChild className="hidden md:inline-flex">
            <Link href="/surat/baru">
              <PlusIcon data-icon="inline-start" />
              Tambah Surat
            </Link>
          </Button>
        ) : null
      }
    >
      {/* Di HP aksi utama jadi tombol melayang; header hanya judul. */}
      {bolehMengubah(user.role) ? <FabTambahSurat /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardDescription>
          Surat masuk, disposisi, dan agenda sampai hari ini.
          {pembanding ? ` Selisih dihitung terhadap ${pembanding.acuan} pada window yang sama.` : ""}
        </CardDescription>
        <div className="flex flex-wrap gap-1.5">
          {periode.map((p) => (
            <Button key={p.key} size="sm" variant={p.key === pilih ? "selected" : "outline"} asChild>
              <Link href={`/dashboard?periode=${p.key}`} aria-current={p.key === pilih ? "true" : undefined}>
                {p.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      {galat ? (
        <Alert variant="destructive">
          <AlertDescription>Data belum bisa dibaca: {galat}</AlertDescription>
        </Alert>
      ) : null}

      {!galat && statistik && Number(statistik.surat) === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>Belum ada surat tercatat untuk periode ini</EmptyTitle>
            <EmptyDescription>
              Angka di bawah masih nol karena belum ada data, bukan karena aplikasinya kosong.
            </EmptyDescription>
          </EmptyHeader>
          {bolehMengubah(user.role) ? (
            <EmptyContent>
              <Button asChild className="hidden md:inline-flex">
                <Link href="/surat/baru">Tambah Surat</Link>
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : null}

      {!galat ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kartu.map((k) => (
            <MetricCard key={k.label} label={k.label} nilai={k.nilai} delta={k.delta} catatan={k.catatan} />
          ))}
        </div>
      ) : null}

      {!galat && perBulan.length > 0 ? (
        <Card aria-labelledby="judul-grafik-surat">
          <CardHeader>
            <CardTitle id="judul-grafik-surat">Surat masuk dan surat keluar per bulan {tahunIni}</CardTitle>
            <CardDescription>Surat masuk dihitung dari tanggal terima, surat keluar dari tanggal surat.</CardDescription>
          </CardHeader>
          <CardContent>
            <StatBarChart config={konfigurasiSurat} data={perBulan} judul="Grafik surat masuk dan surat keluar per bulan" />
          </CardContent>
        </Card>
      ) : null}

      <Card aria-labelledby="judul-surat-terbaru">
        <CardHeader>
          <CardTitle id="judul-surat-terbaru">Surat masuk terbaru</CardTitle>
          <CardAction>
            <Button size="icon-sm" variant="ghost" className="size-8 p-0 shadow-none" asChild>
              <Link href="/surat" aria-label="Lihat semua surat masuk"><ExternalLinkIcon /></Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {suratTerbaru.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Belum ada surat yang tercatat.</p>
          ) : (
<div className="overflow-x-auto">
<Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>No. Agenda</TableHead>
                  <TableHead>Tanggal Terima</TableHead>
                  <TableHead>Pengirim</TableHead>
                  <TableHead>Perihal</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suratTerbaru.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="num whitespace-nowrap">
                      <Link href={`/surat/${s.id}`} className="text-primary underline underline-offset-4">
                        {s.nomor_agenda}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-normal">{tanggal(s.tanggal_terima)}</TableCell>
                    <TableCell className="whitespace-normal break-words">{s.pengirim}</TableCell>
                    <TableCell className="max-w-[22rem] whitespace-normal break-words">{s.perihal}</TableCell>
                    <TableCell className="lg:break-all">
                      <div className="flex flex-col gap-1">
                        <Badge variant={tone(s.status_surat) as BadgeVariant}>{labelStatusSurat[s.status_surat]}</Badge>
                        <Badge variant={tone(s.status_undangan_rapat) as BadgeVariant}>{labelUndangan[s.status_undangan_rapat]}</Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
</div>
          )}
        </CardContent>
      </Card>

      <Card aria-labelledby="judul-keluar-terbaru">
        <CardHeader>
          <CardTitle id="judul-keluar-terbaru">Surat keluar terbaru</CardTitle>
          <CardAction>
            <Button size="icon-sm" variant="ghost" className="size-8 p-0 shadow-none" asChild>
              <Link href="/keluar" aria-label="Lihat semua surat keluar"><ExternalLinkIcon /></Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {keluarTerbaru.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Belum ada surat keluar yang dicatat.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Surat</TableHead>
                    <TableHead>Tanggal Surat</TableHead>
                    <TableHead>Tujuan</TableHead>
                    <TableHead>Perihal</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keluarTerbaru.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="num whitespace-normal lg:break-all">
                        <Link href={`/keluar/${s.id}`} className="text-primary underline underline-offset-4">
                          {s.nomor_surat}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-normal">{tanggal(s.tanggal_surat)}</TableCell>
                      <TableCell className="whitespace-normal break-words">{s.tujuan}</TableCell>
                      <TableCell className="whitespace-normal break-words">{s.perihal}</TableCell>
                      <TableCell className="lg:break-all">
                        <Badge variant={tone(s.status_surat) as BadgeVariant}>{labelStatusSuratKeluar[s.status_surat]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card aria-labelledby="judul-rapat-terdekat">
        <CardHeader>
          <CardTitle id="judul-rapat-terdekat">Agenda terdekat</CardTitle>
          <CardAction>
            <Button size="icon-sm" variant="ghost" className="size-8 p-0 shadow-none" asChild>
              <Link href="/rapat" aria-label="Lihat kalender"><ExternalLinkIcon /></Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {rapatTerdekat.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada agenda yang masih akan datang.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {rapatTerdekat.map((r) => (
                <div key={r.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                  <p className="font-medium">{r.agenda_rapat}</p>
                  <p className="text-sm text-muted-foreground">
                    <span className="num">{tanggalJamText(r.tanggal_mulai)}</span>
                    {r.tempat ? ` di ${r.tempat}` : ""} dari surat <span className="num">{r.nomor_agenda}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Shell>
  );
}

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

function labelPeriode(key: string): string {
  if (key === "hari") return "Sejak 00.00 WIB hari ini";
  if (key === "bulan") return "Sejak tanggal 1 bulan berjalan";
  if (key === "tahun") return "Sejak 1 Januari tahun berjalan";
  return "Seluruh periode";
}
