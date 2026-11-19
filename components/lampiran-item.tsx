"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import { HapusKonfirmasi } from "@/components/hapus-konfirmasi";
import { Button } from "@/components/ui/button";
import type { Hasil } from "@/lib/hasil";

export function LampiranItem({
  id,
  suratId,
  nama,
  meta,
  bolehUbah,
  hapusAction,
}: {
  id: string;
  suratId: string;
  nama: string;
  meta: string;
  bolehUbah: boolean;
  hapusAction: (form: FormData) => Promise<Hasil>;
}) {
  // Baris hilang begitu konfirmasi ditekan; bila server menolak, barisnya kembali bersama toast galat.
  const [terhapus, setTerhapus] = useState(false);
  if (terhapus) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b py-2 transition-colors last:border-b-0 hover:bg-muted/50">
      <div className="min-w-0">
        <a href={`/lampiran/${id}`} className="break-all font-medium text-primary underline underline-offset-4">
          {nama}
        </a>
        <p className="num text-xs text-muted-foreground">{meta}</p>
      </div>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" asChild>
          <a href={`/lampiran/${id}`}>
            <DownloadIcon data-icon="inline-start" />
            Unduh
          </a>
        </Button>
        {bolehUbah ? (
          <HapusKonfirmasi
            judul={`Hapus lampiran ${nama}?`}
            keterangan="Berkas dihapus dari daftar surat, berkas aslinya ikut terhapus. Catatan surat lain tidak berubah."
            labelTrigger="Hapus"
            labelKonfirmasi="Hapus lampiran"
            aksi={hapusAction}
            hidden={{ lampiran_id: id, surat_id: suratId }}
            hapusLokal={() => setTerhapus(true)}
            galatLokal={() => setTerhapus(false)}
          />
        ) : null}
      </div>
    </div>
  );
}
