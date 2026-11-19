"use client";

import { cn } from "cn";
import { StatusPilih } from "@/components/status-pilih";
import { simpanStatusTindak } from "@/lib/actions/disposisi";
import { labelTindakLanjut } from "@/lib/status";

/**
 * Pengubah status tindak lanjut di daftar `/disposisi`. Pilihan langsung disimpan saat dipilih —
 * tidak ada tombol simpan. Pilihan yang baru kelihatan seketika; kalau server menolak, pilihan kembali
 * ke yang lama dan pesannya jadi toast. Filter (status dan pencarian) ikut dikirim supaya halaman tetap
 * pada filter yang sama saat di-refresh.
 */
export function StatusTindakSelect({
  id,
  nomorAgenda,
  status,
  filterStatus,
  filterQ,
  className,
}: {
  id: string;
  nomorAgenda: string;
  status: string;
  filterStatus: string;
  filterQ: string;
  className?: string;
}) {
  return (
    <StatusPilih
      aksi={simpanStatusTindak}
      nama="status_tindak_lanjut"
      nilai={status}
      bertint
      kelas={cn("w-full md:w-[10rem]", className)}
      label={`Status tindak lanjut untuk ${nomorAgenda}`}
      tambahan={{ id, filter_status: filterStatus, filter_q: filterQ }}
      opsi={Object.entries(labelTindakLanjut).map(([kode, label]) => ({ kode, label }))}
    />
  );
}
