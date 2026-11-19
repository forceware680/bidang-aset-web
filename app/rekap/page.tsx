import Link from "next/link";
import { DownloadIcon, FileSpreadsheetIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { CetakButton } from "@/components/cetak-button";
import { MetricCard, deltaSekarang, type Delta } from "@/components/metric-card";
import { StatBarChart, StatPieChart } from "@/components/stat-chart";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { PilihTahunRekap } from "@/components/periode-rekap";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { namaBulan, tanggalJamText } from "@/lib/format";
import { irisanKomposisiJenis, nomorLaporanRekap, persenPenyelesaian, rekapPerBulan, rekapPerJenis, tahunSurat, totalPeriode } from "@/lib/rekap";
import { sinkronkanRapatLewatWaktu } from "@/lib/rapat-waktu";

// Statistik surat masuk dan surat keluar dipisah: dua grafik berdiri sendiri, bukan dua seri dalam satu
// grafik — angka surat keluar tidak bisa dibaca kalau dia berbagi sumbu dengan surat masuk.
const konfigurasiMasuk = { surat: { label: "Surat masuk", color: "var(--color-chart-masuk)" } } satisfies ChartConfig;
const konfigurasiKeluar = { keluar: { label: "Surat keluar", color: "var(--color-chart-keluar)" } } satisfies ChartConfig;

const konfigurasiRapat = {
  dijadwalkan: { label: "Dijadwalkan", color: "var(--info)" },
  dilaksanakan: { label: "Dilaksanakan", color: "var(--success)" },
} satisfies ChartConfig;

export const dynamic = "force-dynamic";

export default async function RekapPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  await sinkronkanRapatLewatWaktu();
  const sp = await searchParams;

  const tahunList = await tahunSurat();
  const tahun = Number(sp.tahun ?? tahunList[0] ?? new Date().getFullYear());
  const mulai = new Date(`${tahun}-01-01T00:00:00Z`);
  const akhir = new Date(`${tahun}-12-31T23:59:59Z`);

  const perBulan = await rekapPerBulan(mulai, akhir);
  const perJenis = await rekapPerJenis(mulai, akhir);
  const totalJenis = perJenis.reduce((a, r) => a + r.surat, 0);

  // Pembanding tahun sebelumnya hanya diambil kalau tahun itu memang punya surat,
  // supaya "−3 dari 2025" tidak dibandingkan dengan tahun yang kosong.
  const tahunSebelum = tahunList.includes(tahun - 1) ? tahun - 1 : null;
  const totalSebelum = tahunSebelum === null ? null : totalPeriode(await rekapPerBulan(new Date(`${tahunSebelum}-01-01T00:00:00Z`), new Date(`${tahunSebelum}-12-31T23:59:59Z`)));

  // Palet kategori dan penggabungan "Lainnya" dipinjam dari lib/rekap — layar monitor memakai yang sama.
  const irisanJenis = irisanKomposisiJenis(perJenis);
  const total = totalPeriode(perBulan);
  const selesai = persenPenyelesaian(total.disposisiSelesai, total.disposisiTotal);
  const selesaiSebelum = totalSebelum ? persenPenyelesaian(totalSebelum.disposisiSelesai, totalSebelum.disposisiTotal) : null;

  const acuan = tahunSebelum === null ? null : String(tahunSebelum);
  const deltaPenyelesaian: Delta | null =
    selesai !== null && selesaiSebelum !== null
      ? {
          arah: selesai > selesaiSebelum ? "naik" : selesai < selesaiSebelum ? "turun" : "tetap",
          teks:
            selesai === selesaiSebelum
              ? `Sama dengan ${acuan}`
              : `${selesai > selesaiSebelum ? "+" : "−"}${Math.abs(selesai - selesaiSebelum)} poin dari ${acuan}`,
          nada: selesai > selesaiSebelum ? "baik" : selesai < selesaiSebelum ? "buruk" : "netral",
        }
      : null;

  const dataMasuk = perBulan.map((b) => ({ label: namaBulan(b.bulan), surat: b.surat }));
  const dataKeluar = perBulan.map((b) => ({ label: namaBulan(b.bulan), keluar: b.keluar }));
  const dataRapat = perBulan.map((b) => ({
    label: namaBulan(b.bulan),
    dijadwalkan: b.rapatDijadwalkan,
    dilaksanakan: b.rapatDilaksanakan,
  }));

  return (
    <Shell
      user={user}
      aktif="rekap"
      judul={`Rekap ${tahun}`}
    >
      {/* Kop laporan hanya muncul saat dicetak; di layar judul sudah ada di header aplikasi. */}
      <div className="hidden flex-col items-center gap-3 border-b pb-4 text-center print:flex" aria-hidden="true">
        <img src="/logo-cetak.png" alt="" className="size-24" />
        <div>
          <p className="text-base font-semibold">BPKAD Kota Magelang</p>
          <p className="text-sm">Bidang Aset</p>
        </div>
        <p className="text-base font-semibold">Rekap Surat Masuk, Surat Keluar, dan Agenda {tahun}</p>
        <p className="num text-sm">Nomor laporan: {nomorLaporanRekap(tahun, total.surat)}</p>
        <p className="text-sm">Dicetak: {tanggalJamText(new Date())}</p>
      </div>
      <CardDescription>
        Surat masuk dihitung dari tanggal terima, surat keluar dari tanggal surat, agenda dari tanggal pelaksanaan.
        Angka dihitung langsung dari data surat pada periode yang dipilih.
      </CardDescription>

      <Card className="tanpa-cetak">
        <CardHeader>
          <CardTitle>Periode tahun</CardTitle>
          <CardDescription>
            Tahun yang tersedia adalah tahun yang punya surat tercatat. Daftar tahun berasal dari surat yang sudah
            tercatat itu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="flex flex-row flex-wrap items-end gap-4">
            <Field className="w-full sm:w-auto">
              <FieldLabel htmlFor="tahun">Tahun</FieldLabel>
              <PilihTahunRekap tahun={String(tahun)} daftar={tahunList.map((t) => String(t))} />
            </Field>
          </FieldGroup>
          {/* Aksi laporan mengikuti periode yang dipilih — bukan tombol header. Satu ButtonGroup: Excel
            lalu cetak PDF. Di HP hanya icon dalam pil (spreadsheet = Excel, printer = PDF); di desktop
            berteks penuh. */}
          <Separator className="my-4" />
          {/* Aksi laporan sebagai tile lembut (isian muted, tanpa garis) — seperti tombol ikon di reference:
            bulat kotak, isian redup, ikon yang jelas. Di HP hanya ikon (spreadsheet = Excel, printer = PDF). */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              asChild
              aria-label="Ekspor Excel"
              data-ikon-saja
              className="rounded-2xl border-0 bg-primary/12 text-primary hover:bg-primary/20 md:bg-primary md:text-primary-foreground md:hover:bg-primary/80 active:translate-y-0"
            >
              <a href={`/rekap/ekspor?tahun=${tahun}`}>
                <FileSpreadsheetIcon />
                <span className="hidden md:inline">Ekspor Excel</span>
              </a>
            </Button>
            <CetakButton className="rounded-2xl border-0 bg-muted text-foreground hover:bg-muted/70 dark:bg-input/30 dark:hover:bg-input/45 active:translate-y-0" />
          </div>
        </CardContent>
      </Card>

      {total.surat === 0 && total.keluar === 0 && total.rapat === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <DownloadIcon />
            </EmptyMedia>
            <EmptyTitle>Tidak ada surat masuk, surat keluar, maupun agenda pada tahun {tahun}</EmptyTitle>
            <EmptyDescription>Pilih tahun lain di atas, atau catat surat terlebih dahulu.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {acuan
          ? `Angka dibandingkan dengan ${acuan} (periode setahun penuh pada tahun sebelumnya).`
          : `Pembanding tahun ${tahun - 1} belum tersedia karena belum ada surat tercatat pada tahun itu.`}
      </p>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Ringkasan periode">
        <MetricCard
          label="Surat masuk"
          nilai={String(total.surat)}
          delta={acuan ? deltaSekarang(total.surat, totalSebelum?.surat ?? null, acuan, "netral") : null}
        />
        <MetricCard
          label="Surat keluar"
          nilai={String(total.keluar)}
          delta={acuan ? deltaSekarang(total.keluar, totalSebelum?.keluar ?? null, acuan, "netral") : null}
          catatan={`${total.keluarDikirim} sudah dikirim`}
        />
        <MetricCard
          label="Surat dikirim"
          nilai={String(total.keluarDikirim)}
          catatan={total.keluar === 0 ? "Belum ada surat keluar pada tahun ini" : `${Math.round((total.keluarDikirim / total.keluar) * 100)}% dari surat keluar yang dicatat`}
        />
        <MetricCard
          label="Surat dengan agenda"
          nilai={String(total.undangan)}
          delta={acuan ? deltaSekarang(total.undangan, totalSebelum?.undangan ?? null, acuan, "netral") : null}
        />
        <MetricCard
          label="Agenda dijadwalkan"
          nilai={String(total.rapat)}
          delta={acuan ? deltaSekarang(total.rapat, totalSebelum?.rapat ?? null, acuan, "netral") : null}
        />
        <MetricCard
          label="Penyelesaian disposisi"
          nilai={selesai === null ? "-" : `${selesai}%`}
          delta={deltaPenyelesaian}
          catatan={selesai === null ? "Belum ada disposisi pada tahun ini" : `${total.disposisiSelesai} dari ${total.disposisiTotal} instruksi selesai`}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2 tanpa-cetak">
        <Card aria-labelledby="grafik-masuk">
          <CardHeader>
            <CardTitle id="grafik-masuk">Surat masuk per bulan</CardTitle>
            <CardDescription>Dihitung dari tanggal terima surat.</CardDescription>
          </CardHeader>
          <CardContent>
            {dataMasuk.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada surat masuk pada periode ini.</p>
            ) : (
              <StatBarChart config={konfigurasiMasuk} data={dataMasuk} judul="Grafik surat masuk per bulan" />
            )}
          </CardContent>
        </Card>
        <Card aria-labelledby="grafik-keluar">
          <CardHeader>
            <CardTitle id="grafik-keluar">Surat keluar per bulan</CardTitle>
            <CardDescription>Dihitung dari tanggal surat keluar.</CardDescription>
          </CardHeader>
          <CardContent>
            {dataKeluar.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada surat keluar pada periode ini.</p>
            ) : (
              <StatBarChart config={konfigurasiKeluar} data={dataKeluar} judul="Grafik surat keluar per bulan" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 tanpa-cetak">
        <Card aria-labelledby="komposisi-jenis">
          <CardHeader>
            <CardTitle id="komposisi-jenis">Komposisi kategori surat</CardTitle>
            <CardDescription>
              Enam kategori terbanyak ditampilkan sendiri; sisanya digabung menjadi Lainnya agar slice tetap terbaca.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {perJenis.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada surat pada tahun {tahun}.</p>
            ) : (
              <StatPieChart slices={irisanJenis} total={totalJenis} judul={`Komposisi kategori surat tahun {tahun}`} />
            )}
          </CardContent>
        </Card>
        <Card aria-labelledby="grafik-rapat">
          <CardHeader>
            <CardTitle id="grafik-rapat">Agenda per bulan</CardTitle>
            <CardDescription>Dijadwalkan dan dilaksanakan ditampilkan terpisah.</CardDescription>
          </CardHeader>
          <CardContent>
            {dataRapat.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada agenda pada periode ini.</p>
            ) : (
              <StatBarChart config={konfigurasiRapat} data={dataRapat} judul="Grafik agenda per bulan" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card aria-labelledby="tabel-bulan">
        <CardHeader>
          <CardTitle id="tabel-bulan">Rekap per bulan</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bulan</TableHead>
                <TableHead>Surat masuk</TableHead>
                <TableHead>Surat keluar</TableHead>
                <TableHead>Sudah dikirim</TableHead>
                <TableHead>Beragenda</TableHead>
                <TableHead>Tanpa agenda</TableHead>
                <TableHead>Belum disposisi</TableHead>
                <TableHead>Disposisi selesai</TableHead>
                <TableHead>Agenda</TableHead>
                <TableHead>Dilaksanakan</TableHead>
                <TableHead>Dibatalkan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perBulan.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-muted-foreground">
                    Tidak ada data pada tahun {tahun}.
                  </TableCell>
                </TableRow>
              ) : (
                perBulan.map((b) => (
                  <TableRow key={b.bulan}>
                    <TableCell>{namaBulan(b.bulan)}</TableCell>
                    <TableCell className="num">{b.surat}</TableCell>
                    <TableCell className="num">{b.keluar}</TableCell>
                    <TableCell className="num">{b.keluarDikirim}</TableCell>
                    <TableCell className="num">{b.undangan}</TableCell>
                    <TableCell className="num">{b.nonrapat}</TableCell>
                    <TableCell className="num">{b.belumDidisposisikan}</TableCell>
                    <TableCell className="num">
                      {b.disposisiSelesai} / {b.disposisiTotal}
                    </TableCell>
                    <TableCell className="num">{b.rapatDijadwalkan}</TableCell>
                    <TableCell className="num">{b.rapatDilaksanakan}</TableCell>
                    <TableCell className="num">{b.rapatDibatalkan}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card aria-labelledby="tabel-jenis">
        <CardHeader>
          <CardTitle id="tabel-jenis">Surat per kategori</CardTitle>
          <CardDescription>
            Surat tanpa kategori masuk sebagai "Belum ditentukan" supaya jumlah seluruhnya tetap sama dengan surat masuk.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategori surat</TableHead>
                <TableHead>Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perJenis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-muted-foreground">
                    Tidak ada surat pada tahun {tahun}.
                  </TableCell>
                </TableRow>
              ) : (
                perJenis.map((r) => (
                  <TableRow key={r.jenis}>
                    <TableCell>{r.jenis}</TableCell>
                    <TableCell className="num">{r.surat}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground tanpa-cetak">
        Ekspor Excel memuat rekap per bulan, rekap per kategori, dan daftar surat. Untuk versi PDF, gunakan perintah
        Cetak di browser pada halaman ini.
      </p>
    </Shell>
  );
}

