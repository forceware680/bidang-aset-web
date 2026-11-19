import Link from "next/link";
import { InboxIcon, PlusIcon, SearchIcon } from "lucide-react";
import { bolehMengubah, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Shell } from "@/components/shell";
import { FabTambahSurat } from "@/components/fab-tambah-surat";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FilterInstan } from "@/components/filter-instan";
import { InputIkon } from "@/components/input-ikon";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { labelStatusSurat, labelUndangan, tone } from "@/lib/status";
import { daftarPaginasi } from "@/lib/paginasi";
import { tanggal, lebarOpsiMin } from "@/lib/format";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

const HALAMAN = 25;

type Baris = {
  id: string;
  nomor_agenda: string;
  tanggal_terima: Date;
  pengirim: string;
  nomor_surat: string | null;
  perihal: string;
  status_surat: string;
  status_undangan_rapat: string;
  jumlah_disposisi: bigint;
  jumlah_rapat: bigint;
};

export default async function SuratPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const tahun = typeof sp.tahun === "string" && /^\d{4}$/.test(sp.tahun) ? Number(sp.tahun) : null;
  const dari = typeof sp.dari === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.dari) ? sp.dari : "";
  const sampai = typeof sp.sampai === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.sampai) ? sp.sampai : "";
  const jenis = typeof sp.jenis === "string" ? sp.jenis : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const undangan = typeof sp.undangan === "string" ? sp.undangan : "";
  const halaman = typeof sp.halaman === "string" && /^\d+$/.test(sp.halaman) ? Number(sp.halaman) : 1;

  const kategori = await prisma.jenis_surat.findMany({ where: { aktif: true }, orderBy: { nama: "asc" } });

  // Popup select native selebar elemennya: opsi terpanjang menentukan lebar minimum.
  const lebarJenis = lebarOpsiMin(["Semua kategori", ...kategori.map((k) => k.nama)]);
  const lebarStatus = lebarOpsiMin(["Semua status", ...Object.values(labelStatusSurat)]);
  const lebarUndangan = lebarOpsiMin(["Semua", ...Object.values(labelUndangan)]);

  const syarat: string[] = [];
  const nilai: unknown[] = [];

  if (q) {
    syarat.push(
      "(nomor_agenda ILIKE $1 OR pengirim ILIKE $1 OR nomor_surat ILIKE $1 OR perihal ILIKE $1 OR isi_ringkas ILIKE $1)",
    );
    nilai.push(`%${q}%`);
  }
  if (tahun) {
    syarat.push(`EXTRACT(year FROM tanggal_terima) = $${nilai.length + 1}`);
    nilai.push(tahun);
  }
  if (dari) {
    syarat.push(`tanggal_terima >= $${nilai.length + 1}::date`);
    nilai.push(dari);
  }
  if (sampai) {
    syarat.push(`tanggal_terima <= $${nilai.length + 1}::date`);
    nilai.push(sampai);
  }
  if (jenis) {
    syarat.push(`jenis_surat = $${nilai.length + 1}`);
    nilai.push(jenis);
  }
  if (status) {
    syarat.push(`status_surat = $${nilai.length + 1}`);
    nilai.push(status);
  }
  if (undangan) {
    syarat.push(`status_undangan_rapat = $${nilai.length + 1}`);
    nilai.push(undangan);
  }

  const WHERE = syarat.length ? ` WHERE ${syarat.join(" AND ")}` : "";
  const offset = (halaman - 1) * HALAMAN;

  // Kombinasi filter yang mustahil: sampai sebelum dari, atau tahun di luar rentang tanggal.
  let konflik = "";
  if (dari && sampai && sampai < dari) konflik = `Sampai ${tanggalIso(sampai)} lebih awal dari dari ${tanggalIso(dari)}`;
  if (!konflik && tahun) {
    const tahunDari = dari ? Number(dari.slice(0, 4)) : null;
    const tahunSampai = sampai ? Number(sampai.slice(0, 4)) : null;
    if (tahunDari !== null && tahunDari > tahun) konflik = `Tahun ${tahun} lebih awal dari dari ${tanggalIso(dari)}`;
    else if (tahunSampai !== null && tahunSampai < tahun) konflik = `Tahun ${tahun} lebih akhir dari sampai ${tanggalIso(sampai)}`;
  }

  let baris: Baris[] = [];
  let total = 0;
  let galat = konflik;

  if (!konflik) {
    try {
      const hasil = await prisma.$queryRawUnsafe<{ jumlah: bigint }[]>(
        `SELECT count(*) AS jumlah FROM v_surat_aktif${WHERE}`,
        ...nilai,
      );
      total = Number(hasil[0]?.jumlah ?? 0);

      baris = await prisma.$queryRawUnsafe<Baris[]>(
        `SELECT id, nomor_agenda, tanggal_terima, pengirim, nomor_surat, perihal, status_surat,
                status_undangan_rapat, jumlah_disposisi, jumlah_rapat
         FROM v_surat_aktif${WHERE}
         ORDER BY tanggal_terima DESC, nomor_agenda DESC
         LIMIT ${HALAMAN} OFFSET ${offset}`,
        ...nilai,
      );
    } catch (e) {
      galat = e instanceof Error ? e.message : "Server data belum bisa dihubungi.";
    }
  }

  const halamanTerakhir = Math.max(1, Math.ceil(total / HALAMAN));
  const tautan = (n: number) =>
    `/surat?halaman=${n}${q ? `&q=${encodeURIComponent(q)}` : ""}${tahun ? `&tahun=${tahun}` : ""}${dari ? `&dari=${dari}` : ""}${sampai ? `&sampai=${sampai}` : ""}${jenis ? `&jenis=${jenis}` : ""}${status ? `&status=${status}` : ""}${undangan ? `&undangan=${undangan}` : ""}`;
  const daftarHalaman = daftarPaginasi(halaman, halamanTerakhir);

  return (
    <Shell
      user={user}
      aktif="surat"
      judul="Agenda Surat Masuk"
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
      {/* Di HP aksi utama jadi tombol melayang di pojok kanan bawah, selalu dalam jangkauan jempol. */}
      {bolehMengubah(user.role) ? <FabTambahSurat /> : null}
      {galat ? (
        <Alert variant="destructive">
          <AlertDescription>{konflik ? `Filter tidak cocok: ${galat}` : `Pencarian gagal: ${galat}`}</AlertDescription>
        </Alert>
      ) : null}


      <Card className="tanpa-cetak">
        <CardHeader>
          <CardTitle>Filter surat</CardTitle>
          <CardDescription>Pencarian mencari nomor agenda, nomor surat, pengirim, perihal, dan ringkasan isi.</CardDescription>
        </CardHeader>
        <CardContent>
          <FilterInstan
            rute="/surat"
            nilai={{ q, tahun: tahun ? String(tahun) : "", dari, sampai, jenis: jenis ?? "", status: status ?? "", undangan: undangan ?? "" }}
            kolom={[
              {
                nama: "q",
                label: "Cari nomor, pengirim, atau perihal",
                tipe: "teks-ikon",
                placeholder: "misal: agenda bersih alun-alun",
                kelas: "basis-full",
              },
              {
                nama: "tahun",
                label: "Tahun terima",
                tipe: "teks",
                placeholder: "2026",
                inputMode: "numeric",
                kelas: "min-w-[10rem] flex-1",
              },
              {
                nama: "rentang",
                label: "Rentang tanggal terima",
                tipe: "rentang",
                kelas: "min-w-[13rem] flex-1",
              },
              {
                nama: "jenis",
                label: "Kategori surat",
                tipe: "pilihan",
                kelas: "flex-1",
                minWidth: lebarJenis,
                opsi: [{ value: "", label: "Semua kategori" }, ...kategori.map((k) => ({ value: k.nama, label: k.nama }))],
              },
              {
                nama: "status",
                label: "Status disposisi",
                tipe: "pilihan",
                kelas: "flex-1",
                minWidth: lebarStatus,
                opsi: [{ value: "", label: "Semua status" }, ...Object.entries(labelStatusSurat).map(([kode, label]) => ({ value: kode, label }))],
              },
              {
                nama: "undangan",
                label: "Kaitan surat dengan agenda",
                tipe: "pilihan",
                kelas: "flex-1",
                minWidth: lebarUndangan,
                opsi: [{ value: "", label: "Semua" }, ...Object.entries(labelUndangan).map(([kode, label]) => ({ value: kode, label }))],
              },
            ]}
          />
        </CardContent>
      </Card>

      {total === 0 && !galat ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>Tidak ada surat yang cocok</EmptyTitle>
            <EmptyDescription>
              {bolehMengubah(user.role)
                ? "Tambah surat baru bila surat tersebut belum tercatat."
                : "Ubah filter atau minta petugas agenda mencatat surat yang kamu cari."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {total > 0 ? (
        <>
          <Card aria-labelledby="tabel-surat">
            <CardHeader>
              <CardTitle id="tabel-surat">
                <span className="num">{total}</span> surat ditemukan
              </CardTitle>
              <CardDescription>
                Halaman <span className="num">{halaman}</span> dari <span className="num">{halamanTerakhir}</span>, 25 surat per halaman.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
<div className="overflow-x-auto">
<Table className="min-w-[920px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Agenda</TableHead>
                    <TableHead>Tgl. Terima</TableHead>
                    <TableHead>Pengirim</TableHead>
                    <TableHead>Nomor Surat</TableHead>
                    <TableHead>Perihal</TableHead>
                    <TableHead>Disposisi</TableHead>
                    <TableHead>Agenda</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {baris.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="num whitespace-nowrap">{b.nomor_agenda}</TableCell>
                      <TableCell className="whitespace-normal">{tanggal(b.tanggal_terima)}</TableCell>
                      <TableCell className="whitespace-normal break-words lg:break-all">{b.pengirim}</TableCell>
                      <TableCell className="num whitespace-normal lg:break-all">{b.nomor_surat ?? "-"}</TableCell>
                      <TableCell className="max-w-[22rem] whitespace-normal break-words">{b.perihal}</TableCell>
                      <TableCell className="lg:break-all">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={tone(b.status_surat) as BadgeVariant}>{labelStatusSurat[b.status_surat]}</Badge>
                          <span className="num text-xs text-muted-foreground">{Number(b.jumlah_disposisi)} catatan</span>
                        </div>
                      </TableCell>
                      <TableCell className="lg:break-all">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={tone(b.status_undangan_rapat) as BadgeVariant}>{labelUndangan[b.status_undangan_rapat]}</Badge>
                          {Number(b.jumlah_rapat) > 0 ? (
                            <span className="num text-xs text-muted-foreground">{Number(b.jumlah_rapat)} agenda</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/surat/${b.id}`}>Detail</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
</div>
            </CardContent>
          </Card>

          {halamanTerakhir > 1 ? (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href={halaman > 1 ? tautan(halaman - 1) : tautan(1)} text="Sebelumnya" aria-label="Halaman sebelumnya" />
                </PaginationItem>
                {daftarHalaman.map((n, i) =>
                  n === "..." ? (
                    <PaginationItem key={`elipsis-${i}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={n}>
                      <PaginationLink href={tautan(n)} isActive={n === halaman} className="num">
                        {n}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext href={halaman < halamanTerakhir ? tautan(halaman + 1) : tautan(halamanTerakhir)} text="Berikutnya" aria-label="Halaman berikutnya" />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </>
      ) : null}
    </Shell>
  );
}

/** Tanggal ISO dari isian filter, ditampilkan dengan format yang sama dengan tabel. */
function tanggalIso(iso: string): string {
  return tanggal(new Date(`${iso}T00:00:00Z`));
}
