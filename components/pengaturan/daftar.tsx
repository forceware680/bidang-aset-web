"use client";

import { useState } from "react";
import { BanIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon, SearchIcon } from "lucide-react";
import { AksiForm } from "@/components/aksi-form";
import { AksiIkon } from "@/components/aksi-ikon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputIkon } from "@/components/input-ikon";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Hasil } from "@/lib/hasil";

export type ItemDaftar = { id: string; nama: string; aktif: boolean; keterangan?: string | null; lencana?: string };

/// Nama yang aktif dipakai dulu; yang nonaktif turun ke bawah tanpa dihapus.
export function urutAktif<T extends { aktif: boolean; nama: string }>(daftar: T[]): T[] {
  return [...daftar].sort((a, b) => (a.aktif === b.aktif ? a.nama.localeCompare(b.nama, "id") : a.aktif ? -1 : 1));
}

function cocokCari(teks: string, kata: string): boolean {
  if (!kata.trim()) return true;
  return teks.toLowerCase().includes(kata.trim().toLowerCase());
}

const ISI_PER_HALAMAN = 10;

/**
 * Pola paginasi shadcn: hanya halaman pertama, terakhir, dan sekitar halaman aktif yang tampil;
 * jarak yang jauh diringkas jadi elipsis. Daftar 49 halaman jadi sebaris ramping, bukan deret 49 tombol.
 */
function halamanTampil(halamanIni: number, terakhir: number): (number | "...")[] {
  const tampilkan = new Set<number>([1, terakhir, halamanIni - 1, halamanIni, halamanIni + 1]);
  if (halamanIni <= 3) for (let n = 2; n <= Math.min(4, terakhir); n++) tampilkan.add(n);
  if (halamanIni >= terakhir - 2) for (let n = Math.max(1, terakhir - 3); n < terakhir; n++) tampilkan.add(n);
  const urut = [...tampilkan].filter((n) => n >= 1 && n <= terakhir).sort((a, b) => a - b);
  const keluaran: (number | "...")[] = [];
  let sebelum = 0;
  for (const n of urut) {
    if (sebelum > 0 && n - sebelum > 1) keluaran.push("...");
    keluaran.push(n);
    sebelum = n;
  }
  return keluaran;
}

/**
 * Satu daftar nama: pencarian, baris di layar kecil, tabel di desktop, dan paginasi di sisi klien.
 * Dipakai oleh semua daftar (pengirim, pejabat, pegawai, tujuan diteruskan, tujuan surat keluar)
 * dan juga daftar kategori surat. Form tambah tidak lagi di dalam daftar — tombol "Tambah" hidup
 * di header (desktop) atau pil melayang (HP) lewat DialogTambah, supaya daftar panjang tidak
 * tergeser oleh formulir.
 */
export function DaftarNama({
  bolehUbah,
  daftar,
  aksiUbahAktif,
  kunci,
  namaPaginasi,
  placeholderCari,
  ariaCari,
  kolomNama,
  kolomKeterangan,
  kosong,
}: {
  bolehUbah: boolean;
  daftar: ItemDaftar[];
  aksiUbahAktif: (form: FormData) => Promise<Hasil>;
  // Kunci daftar, dipakai untuk id isian (cari_pengirim) supaya tautan dan uji tetap sama.
  kunci: string;
  namaPaginasi: string;
  placeholderCari: string;
  ariaCari: string;
  kolomNama: string;
  kolomKeterangan?: string;
  kosong: string;
}) {
  const [kata, setKata] = useState("");
  const [halaman, setHalaman] = useState(1);

  const tampil = urutAktif(daftar).filter((m) => cocokCari(m.nama, kata));
  const terakhir = Math.max(1, Math.ceil(tampil.length / ISI_PER_HALAMAN));
  const halamanIni = Math.min(halaman, terakhir);
  const isi = tampil.slice((halamanIni - 1) * ISI_PER_HALAMAN, halamanIni * ISI_PER_HALAMAN);

  function baris(m: ItemDaftar) {
    return (
      <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-(--border)/50 p-3">
        <div className="min-w-0">
          <p className="font-medium">{m.nama}</p>
          {m.keterangan ? <p className="text-sm text-muted-foreground">{m.keterangan}</p> : null}
          {m.lencana ? <Badge variant="outline">{m.lencana}</Badge> : null}
          {!m.aktif ? <Badge variant="secondary">Nonaktif</Badge> : null}
        </div>
        {bolehUbah ? (
          <AksiForm aksi={aksiUbahAktif} className="shrink-0">
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="aktif" value={m.aktif ? "0" : "1"} />
            <AksiIkon
              label={m.aktif ? `Nonaktifkan ${m.nama} di daftar ringkas` : `Aktifkan ${m.nama} di daftar ringkas`}
              teks={m.aktif ? "Nonaktif" : "Aktifkan"}
            >
              {m.aktif ? <BanIcon /> : <CheckIcon />}
            </AksiIkon>
          </AksiForm>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <InputIkon
        ikon={SearchIcon}
        id={`cari_${kunci}`}
        value={kata}
        onChange={(e) => {
          setKata(e.target.value);
          setHalaman(1);
        }}
        placeholder={placeholderCari}
        aria-label={ariaCari}
      />

      {daftar.length === 0 ? (
        <p className="text-sm text-muted-foreground">{kosong}</p>
      ) : tampil.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada yang cocok dengan "{kata}".</p>
      ) : (
        <div className="flex flex-col gap-2 md:hidden">{isi.map(baris)}</div>
      )}

      <div className="hidden border-t border-(--border) pt-4 md:block md:overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{kolomNama}</TableHead>
              {kolomKeterangan ? <TableHead className="hidden md:table-cell">{kolomKeterangan}</TableHead> : null}
              <TableHead className="hidden md:table-cell w-28 text-center">Status</TableHead>
              <TableHead className="w-24 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {daftar.length === 0 ? (
              <TableRow>
                <TableCell colSpan={kolomKeterangan ? 4 : 3} className="text-muted-foreground">{kosong}</TableCell>
              </TableRow>
            ) : tampil.length === 0 ? (
              <TableRow>
                <TableCell colSpan={kolomKeterangan ? 4 : 3} className="text-muted-foreground">Tidak ada yang cocok dengan "{kata}".</TableCell>
              </TableRow>
            ) : (
              isi.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.nama}
                    {!m.aktif ? <Badge variant="secondary" className="ml-2 md:hidden">Nonaktif</Badge> : null}
                  </TableCell>
                  {kolomKeterangan ? (
                    <TableCell className="hidden md:table-cell">
                      {m.lencana ? <Badge variant="outline">{m.lencana}</Badge> : <span className="text-sm text-muted-foreground">{m.keterangan ?? "-"}</span>}
                    </TableCell>
                  ) : null}
                  <TableCell className="hidden md:table-cell text-center">
                    <Badge variant={m.aktif ? "success" : "secondary"}>{m.aktif ? "Aktif" : "Nonaktif"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {bolehUbah ? (
                      <AksiForm aksi={aksiUbahAktif}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="aktif" value={m.aktif ? "0" : "1"} />
                        <AksiIkon
                          label={m.aktif ? `Nonaktifkan ${m.nama}` : `Aktifkan ${m.nama}`}
                          teks={m.aktif ? "Nonaktifkan" : "Aktifkan"}
                        >
                          {m.aktif ? <BanIcon /> : <CheckIcon />}
                        </AksiIkon>
                      </AksiForm>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {terakhir > 1 ? (
        <nav aria-label={`Halaman daftar ${namaPaginasi}`} className="flex flex-wrap items-center justify-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="default"
            data-slot="pagination-link"
            aria-label="Halaman sebelumnya"
            disabled={halamanIni <= 1}
            onClick={() => setHalaman(Math.max(1, halamanIni - 1))}
          >
            <ChevronLeftIcon data-icon="inline-start" />
            Sebelumnya
          </Button>
          {halamanTampil(halamanIni, terakhir).map((n, i) =>
            n === "..." ? (
              <span
                key={`elipsis-${i}`}
                aria-hidden
                data-slot="pagination-ellipsis"
                className="flex size-8 max-md:size-11 items-center justify-center text-muted-foreground"
              >
                <MoreHorizontalIcon className="size-4" />
                <span className="sr-only">Halaman lainnya</span>
              </span>
            ) : (
              <Button
                key={n}
                type="button"
                variant={n === halamanIni ? "default" : "ghost"}
                size="icon"
                data-slot="pagination-link"
                data-active={n === halamanIni}
                aria-current={n === halamanIni ? "page" : undefined}
                className="num max-md:size-11"
                onClick={() => setHalaman(n)}
              >
                {n}
              </Button>
            )
          )}
          <Button
            type="button"
            variant="ghost"
            size="default"
            data-slot="pagination-link"
            aria-label="Halaman berikutnya"
            disabled={halamanIni >= terakhir}
            onClick={() => setHalaman(Math.min(terakhir, halamanIni + 1))}
          >
            Berikutnya
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
