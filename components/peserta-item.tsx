"use client";

import { useState } from "react";
import { HapusKonfirmasi } from "@/components/hapus-konfirmasi";
import type { Hasil } from "@/lib/hasil";

export function PesertaItem({
  id,
  suratId,
  nama,
  instansi,
  keterangan,
  bolehUbah,
  hapusAction,
}: {
  id: string;
  suratId?: string;
  nama: string;
  instansi: string | null;
  keterangan: string | null;
  bolehUbah: boolean;
  hapusAction: (form: FormData) => Promise<Hasil>;
}) {
  // Baris hilang begitu konfirmasi ditekan; bila server menolak, barisnya kembali bersama toast galat.
  const [terhapus, setTerhapus] = useState(false);
  if (terhapus) return null;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b py-2 transition-colors last:border-b-0 hover:bg-muted/50">
      <div className="min-w-0">
        <p className="font-medium">{nama}</p>
        <p className="text-sm text-muted-foreground">
          {instansi ?? "Instansi/bidang tidak dicatat"}
          {keterangan ? ` · ${keterangan}` : ""}
        </p>
      </div>
      {bolehUbah ? (
        <HapusKonfirmasi
          judul={`Hapus ${nama} dari daftar peserta?`}
          keterangan="Nama peserta dihapus dari agenda ini. Surat dan jadwalnya tidak berubah."
          labelTrigger="Hapus peserta"
          labelKonfirmasi="Hapus dari agenda"
          aksi={hapusAction}
          hidden={{ peserta_id: id, ...(suratId ? { surat_id: suratId } : {}) }}
          hapusLokal={() => setTerhapus(true)}
          galatLokal={() => setTerhapus(false)}
        />
      ) : null}
    </div>
  );
}
