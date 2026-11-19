import Link from "next/link";
import { PlusIcon, SearchIcon, SendIcon } from "lucide-react";
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
import { daftarPaginasi } from "@/lib/paginasi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { labelStatusSuratKeluar, tone } from "@/lib/status";
import { tanggal, lebarOpsiMin } from "@/lib/format";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

const HALAMAN = 25;

type Baris = {
  id: string;
  nomor_surat: string;
  tanggal_surat: Date;
  tujuan: string;
  perihal: string;
  jenis_surat: string | null;
  status_surat: string;
  tanggal_kirim: Date | null;
  jumlah_lampiran: bigint;
  nomor_asal: string | null;
};

export default async function KeluarPage({
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
  const halaman = typeof sp.halaman === "string" && /^\d+$/.test(sp.halaman) ? Number(sp.halaman) : 1;

  // Klasifikasi surat keluar saja; surat masuk punya daftar klasifikasinya sendiri.
  const kategori = await prisma.jenis_surat.findMany({ where: { aktif: true, arah: "keluar" }, orderBy: { nama: "asc" } });

  const lebarJenis = lebarOpsiMin(["Semua kategori", ...kategori.map((k) => k.nama)]);
  const lebarStatus = lebarOpsiMin(["Semua status", ...Object.values(labelStatusSuratKeluar)]);

  const syarat: string[] = [];
  const nilai: unknown[] = [];

  if (q) {
    syarat.push("(nomor_surat ILIKE $1 OR tujuan ILIKE $1 OR perihal ILIKE $1 OR isi_ringkas ILIKE $1)");
    nilai.push(`%${q}%`);
  }
  if (tahun) {
    syarat.push(`tahun_surat = $${nilai.length + 1}`);
    nilai.push(tahun);
  }
  if (dari) {
    syarat.push(`tanggal_surat >= $${nilai.length + 1}::date`);
    nilai.push(dari);
  }
  if (sampai) {
    syarat.push(`tanggal_surat <= $${nilai.length + 1}::date`);
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
        `SELECT count(*) AS jumlah FROM v_surat_keluar_aktif${WHERE}`,
        ...nilai,
      );
      total = Number(hasil[0]?.jumlah ?? 0);

      baris = await prisma.$queryRawUnsafe<Baris[]>(
        `SELECT id, nomor_surat, tanggal_surat, tujuan, perihal, jenis_surat, status_surat,
                tanggal_kirim, jumlah_lampiran, nomor_asal
         FROM v_surat_keluar_aktif${WHERE}
         ORDER BY tanggal_surat DESC, nomor_surat DESC
         LIMIT ${HALAMAN} OFFSET ${offset}`,
        ...nilai,
      );
    } catch (e) {
      galat = e instanceof Error ? e.message : "Server data belum bisa dihubungi.";
    }
  }

  const halamanTerakhir = Math.max(1, Math.ceil(total / HALAMAN));
  const tautan = (n: number) =>
    `/keluar?halaman=${n}${q ? `&q=${encodeURIComponent(q)}` : ""}${tahun ? `&tahun=${tahun}` : ""}${dari ? `&dari=${dari}` : ""}${sampai ? `&sampai=${sampai}` : ""}${jenis ? `&jenis=${jenis}` : ""}${status ? `&status=${status}` : ""}`;
  const daftarHalaman = daftarPaginasi(halaman, halamanTerakhir);

  return (
    <Shell
      user={user}
      aktif="keluar"
      judul="Agenda Surat Keluar"
      aksi={
        bolehMengubah(user.role) ? (
          <Button size="sm" asChild className="hidden md:inline-flex">
            <Link href="/keluar/baru">
              <PlusIcon data-icon="inline-start" />
              Tambah Surat Keluar
            </Link>
          </Button>
        ) : null
      }
    >
      {/* Di HP aksi utama jadi tombol melayang di pojok kanan bawah. */}
      {bolehMengubah(user.role) ? <FabTambahSurat href="/keluar/baru" label="Tambah Surat Keluar" ariaLabel="Tambah surat keluar baru" /> : null}
      {galat ? (
        <Alert variant="destructive">
          <AlertDescription>{konflik ? `Filter tidak cocok: ${galat}` : `Pencarian gagal: ${galat}`}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="tanpa-cetak">
        <CardHeader>
          <CardTitle>Filter surat keluar</CardTitle>
          <CardDescription>Pencarian mencari nomor surat, tujuan, perihal, dan ringkasan isi.</CardDescription>
        </CardHeader>
        <CardContent>
          <FilterInstan
            rute="/keluar"
            nilai={{ q, tahun: tahun ? String(tahun) : "", dari, sampai, jenis: jenis ?? "", status: status ?? "" }}
            kolom={[
              {
                nama: "q",
                label: "Cari nomor, tujuan, atau perihal",
                tipe: "teks-ikon",
                placeholder: "misal: balasan undangan inventaris",
                kelas: "basis-full",
              },
              {
                nama: "tahun",
                label: "Tahun surat",
                tipe: "teks",
                placeholder: "2026",
                inputMode: "numeric",
                kelas: "min-w-[10rem] flex-1",
              },
              {
                nama: "rentang",
                label: "Rentang tanggal surat",
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
                label: "Status surat",
                tipe: "pilihan",
                kelas: "flex-1",
                minWidth: lebarStatus,
                opsi: [{ value: "", label: "Semua status" }, ...Object.entries(labelStatusSuratKeluar).map(([kode, label]) => ({ value: kode, label }))],
              },
            ]}
          />
        </CardContent>
      </Card>

      {total === 0 && !galat ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SendIcon />
            </EmptyMedia>
            <EmptyTitle>Tidak ada surat keluar yang cocok</EmptyTitle>
            <EmptyDescription>
              {bolehMengubah(user.role)
                ? "Catat surat keluar baru bila surat tersebut belum tercatat."
                : "Ubah filter atau minta petugas agenda mencatat surat keluar yang kamu cari."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {total > 0 ? (
        <>
          <Card aria-labelledby="tabel-surat-keluar">
            <CardHeader>
              <CardTitle id="tabel-surat-keluar">
                <span className="num">{total}</span> surat keluar ditemukan
              </CardTitle>
              <CardDescription>
                Halaman <span className="num">{halaman}</span> dari <span className="num">{halamanTerakhir}</span>, 25 surat per halaman.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Surat</TableHead>
                    <TableHead>Tgl. Surat</TableHead>
                    <TableHead >Tujuan</TableHead>
                    <TableHead >Perihal</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead >Status</TableHead>
                    <TableHead>Lampiran</TableHead>
                    <TableHead>Balasan dari</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                  <TableBody>
                    {baris.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="num whitespace-normal lg:break-all">{b.nomor_surat}</TableCell>
                        <TableCell className="whitespace-normal">{tanggal(b.tanggal_surat)}</TableCell>
                        <TableCell className="whitespace-normal break-words">{b.tujuan}</TableCell>
                        <TableCell className="max-w-[22rem] whitespace-normal break-words">{b.perihal}</TableCell>
                        <TableCell className="whitespace-normal break-words">{b.jenis_surat ?? "-"}</TableCell>
                        <TableCell className="lg:break-all">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant={tone(b.status_surat) as BadgeVariant}>{labelStatusSuratKeluar[b.status_surat]}</Badge>
                            {b.tanggal_kirim ? (
                              <span className="num text-xs text-muted-foreground">dikirim {tanggal(b.tanggal_kirim)}</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="num text-muted-foreground whitespace-normal">
                          {Number(b.jumlah_lampiran) > 0 ? `${Number(b.jumlah_lampiran)} berkas` : "-"}
                        </TableCell>
                        <TableCell className="num whitespace-normal lg:break-all">{b.nomor_asal ?? "-"}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/keluar/${b.id}`}>Detail</Link>
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
