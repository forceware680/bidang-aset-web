"use client";

import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tanggalJamText, labelAksiAudit, labelEntitasAudit } from "@/lib/format";
import { daftarPaginasi } from "@/lib/paginasi";

/// Baris jejak yang sudah diserialisasi ke string agar bisa dikirim ke komponen client.
type Audit = { id: string; created_at: string; nama_user: string | null; action: string; entity_type: string; description: string | null };

const ISI_PER_HALAMAN = 25;

/**
 * Jejak perubahan data dengan paginasi instan di sisi browser (sama seperti daftar pengaturan):
 * semua baris sudah di client, klik halaman tidak navigasi server. Filter jenis catatan juga
 * instan di client; halaman awal bisa datang dari ?entitas= di URL.
 */
export function BagianJejak({
  audit,
  entitasAwal,
  entitasAudit,
}: {
  audit: Audit[];
  entitasAwal: string;
  entitasAudit: string[];
}) {
  const [entitas, setEntitas] = useState(entitasAwal);
  const [halaman, setHalaman] = useState(1);

  const saring = entitas ? audit.filter((a) => a.entity_type === entitas) : audit;
  const terakhir = Math.max(1, Math.ceil(saring.length / ISI_PER_HALAMAN));
  const halamanIni = Math.min(halaman, terakhir);
  const potong = saring.slice((halamanIni - 1) * ISI_PER_HALAMAN, halamanIni * ISI_PER_HALAMAN);

  const gantiEntitas = (e: string) => {
    setEntitas(e);
    setHalaman(1);
  };

  // Pilihan jenis catatan untuk filter — label Indonesia dari kode entitas di audit_logs.
  const opsiJejak: { value: string; label: string }[] = [
    { value: "", label: "Semua jenis catatan" },
    ...entitasAudit.map((e) => ({ value: e, label: labelEntitasAudit(e) })),
  ];

  return (
    <Card aria-labelledby="jejak">
      <CardHeader>
        <CardTitle id="jejak" className="flex flex-wrap items-center gap-2">
          Jejak perubahan data
          <Badge variant="secondary" className="num">
            {entitas
              ? `${saring.length} dari ${audit.length} catatan jenis ini`
              : terakhir > 1
                ? `Halaman ${halamanIni} dari ${terakhir} halaman`
                : `${audit.length} catatan`}
          </Badge>
        </CardTitle>
        <CardDescription>
          {terakhir > 1
            ? "Maksimal 25 catatan per halaman, terbaru lebih dulu. Catatan perubahan hanya ditulis dan dibaca — tidak bisa diubah atau dihapus."
            : "Semua catatan ditampilkan, terbaru lebih dulu. Catatan perubahan hanya ditulis dan dibaca — tidak bisa diubah atau dihapus."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="tanpa-cetak">
          <NativeSelect
            value={entitas}
            className="w-full sm:w-fit"
            selectClassName="min-w-[14rem]"
            onChange={(e) => gantiEntitas(e.target.value)}
            aria-label="Filter jenis catatan"
          >
            {opsiJejak.map((o) => (
              <NativeSelectOption key={o.value || "semua"} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </CardContent>
      <CardContent className="p-0 pt-0">
        <div className="overflow-x-auto border-t border-(--border) pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Pengguna</TableHead>
                <TableHead>Perubahan</TableHead>
                <TableHead>Jenis catatan</TableHead>
                <TableHead>Keterangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {potong.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Belum ada jejak perubahan data{entitas ? ` untuk ${labelEntitasAudit(entitas)}` : ""}.
                  </TableCell>
                </TableRow>
              ) : (
                potong.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="num whitespace-nowrap text-sm">{tanggalJamText(a.created_at)}</TableCell>
                    <TableCell className="font-medium">{a.nama_user ?? "Sistem"}</TableCell>
                    <TableCell className="text-sm">{labelAksiAudit(a.action)}</TableCell>
                    <TableCell className="text-sm">{labelEntitasAudit(a.entity_type)}</TableCell>
                    <TableCell>{a.description ?? "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {terakhir > 1 ? (
          <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-(--border)/50 px-4 py-3">
            <Button
              variant="ghost"
              size="default"
              className="max-md:h-11"
              disabled={halamanIni <= 1}
              onClick={() => setHalaman(halamanIni - 1)}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeftIcon data-icon="inline-start" />
              Sebelumnya
            </Button>
            {daftarPaginasi(halamanIni, terakhir).map((n, i) =>
              n === "..." ? (
                <span
                  key={`elipsis-${i}`}
                  aria-hidden
                  data-slot="pagination-ellipsis"
                  className="flex size-8 max-md:size-11 items-center justify-center text-muted-foreground"
                >
                  <MoreHorizontalIcon />
                  <span className="sr-only">Halaman lainnya</span>
                </span>
              ) : (
                <Button
                  key={n}
                  variant={n === halamanIni ? "default" : "ghost"}
                  size="icon"
                  className="num max-md:size-11"
                  aria-label={`Halaman ${n}`}
                  aria-current={n === halamanIni ? "page" : undefined}
                  onClick={() => setHalaman(n)}
                >
                  {n}
                </Button>
              ),
            )}
            <Button
              variant="ghost"
              size="default"
              className="max-md:h-11"
              disabled={halamanIni >= terakhir}
              onClick={() => setHalaman(halamanIni + 1)}
              aria-label="Halaman berikutnya"
            >
              <ChevronRightIcon data-icon="inline-start" />
              Berikutnya
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
