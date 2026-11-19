import Link from "next/link";
import { InboxIcon, SearchIcon } from "lucide-react";
import { bolehMengubah, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Shell } from "@/components/shell";
import { StatusTindakSelect } from "@/components/status-tindak-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FilterInstan } from "@/components/filter-instan";
import { InputIkon } from "@/components/input-ikon";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { daftarPaginasi } from "@/lib/paginasi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { labelTindakLanjut, teksInstruksi, tanpaInstruksi, tint, tone } from "@/lib/status";
import { tanggal, lebarOpsiMin } from "@/lib/format";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

type Baris = {
  id: string;
  surat_id: string;
  nomor_agenda: string;
  perihal: string;
  tanggal_disposisi: Date;
  pemberi_disposisi: string;
  penerima_disposisi: string | null;
  tanggal_diteruskan: Date | null;
  isi_disposisi: string;
  status_tindak_lanjut: string;
};

export default async function DisposisiPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const dari = typeof sp.dari === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.dari) ? sp.dari : "";
  const sampai = typeof sp.sampai === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.sampai) ? sp.sampai : "";
  const HALAMAN = 25;
  const halaman =
    typeof sp.halaman === "string" && /^\d+$/.test(sp.halaman) ? Math.max(1, Number(sp.halaman)) : 1;
  const bolehUbah = bolehMengubah(user.role);

  const syarat: string[] = [];
  const nilai: unknown[] = [];
  if (status) {
    syarat.push(`status_tindak_lanjut = $${nilai.length + 1}`);
    nilai.push(status);
  }
  if (q) {
    syarat.push(`(nomor_agenda ILIKE $${nilai.length + 1} OR perihal ILIKE $${nilai.length + 1} OR penerima_disposisi ILIKE $${nilai.length + 1})`);
    nilai.push(`%${q}%`);
  }
  if (dari) {
    syarat.push(`tanggal_disposisi >= $${nilai.length + 1}::date`);
    nilai.push(dari);
  }
  if (sampai) {
    syarat.push(`tanggal_disposisi <= $${nilai.length + 1}::date`);
    nilai.push(sampai);
  }
  const WHERE = syarat.length ? ` WHERE ${syarat.join(" AND ")}` : "";

  let baris: Baris[] = [];
  let galat = "";
  let total = 0;

  try {
    const jumlah = await prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int AS total FROM v_disposisi_aktif${WHERE}`,
      ...nilai,
    );
    total = jumlah[0]?.total ?? 0;
  } catch {
    total = 0;
  }
  const halamanTerakhir = Math.max(1, Math.ceil(total / HALAMAN));
  const aktif = Math.min(halaman, halamanTerakhir);
  const offset = (aktif - 1) * HALAMAN;
  const tautan = (n: number) =>
    `/disposisi?halaman=${n}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${status}` : ""}${dari ? `&dari=${dari}` : ""}${sampai ? `&sampai=${sampai}` : ""}`;

  try {
    baris = await prisma.$queryRawUnsafe<Baris[]>(
      `SELECT id, surat_id, nomor_agenda, perihal, tanggal_disposisi, pemberi_disposisi,
              penerima_disposisi, tanggal_diteruskan,
              isi_disposisi, status_tindak_lanjut
       FROM v_disposisi_aktif${WHERE}
       ORDER BY tanggal_disposisi DESC
       LIMIT $${nilai.length + 1} OFFSET $${nilai.length + 2}`,
      ...nilai,
      HALAMAN,
      offset,
    );
  } catch (e) {
    galat = e instanceof Error ? e.message : "Server data belum bisa dihubungi.";
  }

  return (
    <Shell user={user} aktif="disposisi" judul="Disposisi dan tindak lanjut">


      {galat ? (
        <Alert variant="destructive">
          <AlertDescription>Daftar disposisi gagal dimuat: {galat}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="tanpa-cetak">
        <CardHeader>
          <CardTitle>Filter disposisi</CardTitle>
          <CardDescription>Pencarian mencari nomor agenda, perihal, dan tujuan diteruskan.</CardDescription>
        </CardHeader>
        <CardContent>
          <FilterInstan
            rute="/disposisi"
            nilai={{ q, status: status ?? "", dari, sampai }}
            kolom={[
              {
                nama: "q",
                label: "Cari nomor agenda, perihal, atau tujuan",
                tipe: "teks-ikon",
                kelas: "min-w-[12rem] flex-1",
              },
              {
                nama: "status",
                label: "Status tindak lanjut",
                tipe: "pilihan",
                kelas: "flex-1",
                minWidth: lebarOpsiMin(["Semua status", ...Object.values(labelTindakLanjut)]),
                opsi: [{ value: "", label: "Semua status" }, ...Object.entries(labelTindakLanjut).map(([kode, label]) => ({ value: kode, label }))],
              },
              {
                nama: "rentang",
                label: "Rentang tanggal disposisi",
                tipe: "rentang",
                kelas: "min-w-[13rem] flex-1",
              },
            ]}
          />
        </CardContent>
      </Card>

      {baris.length === 0 && !galat ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>Belum ada disposisi yang cocok</EmptyTitle>
            <EmptyDescription>
              Disposisi muncul setelah catatan disposisi ditambahkan pada halaman suratnya.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {baris.length > 0 ? (
        <Card aria-labelledby="tabel-disposisi">
          <CardHeader>
            <CardTitle id="tabel-disposisi"><span className="num">{baris.length}</span> disposisi ditampilkan</CardTitle>
            <CardDescription>
              {halamanTerakhir > 1 ? (
                <>
                  Halaman <span className="num">{aktif}</span> dari <span className="num">{halamanTerakhir}</span>, 25 disposisi
                  per halaman dari <span className="num">{total}</span> disposisi sesuai filter.
                </>
              ) : (
                <>
                  Semua <span className="num">{total}</span> disposisi sesuai filter ditampilkan, terbaru lebih dulu.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Di ponsel daftar menumpuk: tabel enam kolom tidak muat di 390px. */}
            <div className="flex flex-col gap-3 p-4 md:hidden">
              {baris.map((b) => (
                <div key={b.id} className="rounded-xl border border-(--border)/50 p-3">
                  <Link href={`/surat/${b.surat_id}?bagian=disposisi&dari=disposisi`} className="num text-primary underline underline-offset-4">
                    {b.nomor_agenda}
                  </Link>
                  <p className="mt-1 font-medium">{b.perihal}</p>
                  <p className="text-sm text-muted-foreground">
                    {tanggal(b.tanggal_disposisi)} · {b.pemberi_disposisi}
                  </p>
                  {b.penerima_disposisi ? (
                    <p className="text-sm text-muted-foreground">
                      Diteruskan ke {b.penerima_disposisi}
                      {b.tanggal_diteruskan ? ` pada ${tanggal(b.tanggal_diteruskan)}` : ""}
                    </p>
                  ) : null}
                  <p className={tanpaInstruksi(b.isi_disposisi) ? "text-sm text-muted-foreground" : "text-sm"}>{teksInstruksi(b.isi_disposisi)}</p>
                  {bolehUbah ? (
                    <StatusTindakSelect
                      id={b.id}
                      nomorAgenda={b.nomor_agenda}
                      status={b.status_tindak_lanjut}
                      filterStatus={status}
                      filterQ={q}
                      className="mt-2"
                    />
                  ) : (
                    <Badge variant={tone(b.status_tindak_lanjut) as BadgeVariant}>{labelTindakLanjut[b.status_tindak_lanjut]}</Badge>
                  )}
                </div>
              ))}
            </div>
            <div className="hidden border-t border-(--border) pt-4 md:block md:overflow-x-auto">
<Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>No. Agenda</TableHead>
                  <TableHead>Surat dan instruksi</TableHead>
                  <TableHead>Diteruskan ke</TableHead>
                  {bolehUbah ? <TableHead>Tindak lanjut</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {baris.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-nowrap">{tanggal(b.tanggal_disposisi)}</TableCell>
                    <TableCell className="num whitespace-nowrap">
                      <Link href={`/surat/${b.surat_id}?bagian=disposisi&dari=disposisi`} className="text-primary underline underline-offset-4">
                        {b.nomor_agenda}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-[22rem] truncate font-medium" title={b.perihal}>{b.perihal}</p>
                      <p className="max-w-[22rem] truncate text-xs text-muted-foreground" title={teksInstruksi(b.isi_disposisi)}>
                        {teksInstruksi(b.isi_disposisi)}
                      </p>
                      <p className="text-xs text-muted-foreground">dari {b.pemberi_disposisi}</p>
                    </TableCell>
                    <TableCell>
                      {b.penerima_disposisi ?? "-"}
                      {b.tanggal_diteruskan ? (
                        <p className="text-xs text-muted-foreground">diteruskan {tanggal(b.tanggal_diteruskan)}</p>
                      ) : null}
                    </TableCell>
                    {bolehUbah ? (
                      <TableCell>
                        <StatusTindakSelect
                          id={b.id}
                          nomorAgenda={b.nomor_agenda}
                          status={b.status_tindak_lanjut}
                          filterStatus={status}
                          filterQ={q}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
</div>
          </CardContent>
        </Card>
      ) : null}

      {halamanTerakhir > 1 ? (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href={aktif > 1 ? tautan(aktif - 1) : tautan(1)} text="Sebelumnya" aria-label="Halaman sebelumnya" />
            </PaginationItem>
            {daftarPaginasi(aktif, halamanTerakhir).map((n, i) =>
              n === "..." ? (
                <PaginationItem key={`elipsis-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={n}>
                  <PaginationLink href={tautan(n)} isActive={n === aktif} className="num">
                    {n}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext href={aktif < halamanTerakhir ? tautan(aktif + 1) : tautan(halamanTerakhir)} text="Berikutnya" aria-label="Halaman berikutnya" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </Shell>
  );
}
