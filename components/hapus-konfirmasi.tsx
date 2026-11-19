"use client";

import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { gunakanAksi } from "@/components/aksi-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Hasil } from "@/lib/hasil";

/**
 * Konfirmasi hapus yang dipakai daftar lampiran, daftar peserta, dan agenda rapat. Trigger memakai
 * ghost berwarna destructive: warna tetap mengomunikasikan risiko, tapi tidak bikin satu tombol merah
 * berat di setiap baris daftar. Hapus tidak berpindah halaman — hasilnya toast lalu payload di-refresh,
 * dan dialog hanya ditutup kalau server benar-benar menghapusnya.
 */
export function HapusKonfirmasi({
  judul,
  keterangan,
  labelTrigger,
  labelKonfirmasi,
  aksi,
  hidden,
  arahSetelah,
  hapusLokal,
  galatLokal,
}: {
  judul: string;
  keterangan: string;
  labelTrigger: string;
  labelKonfirmasi: string;
  aksi: (form: FormData) => Promise<Hasil>;
  hidden: { [nama: string]: string };
  /** Halaman tujuan setelah hapus yang berpindah (mis. daftar surat). Kalau tidak ada, halaman ini di-refresh. */
  arahSetelah?: string;
  /** Baris hilang seketika saat dikonfirmasi; bila server menolak, pemanggil pulihkan barisnya. */
  hapusLokal?: () => void;
  galatLokal?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { jalan, mengirim } = gunakanAksi(
    aksi,
    undefined,
    arahSetelah ? { arah: arahSetelah } : undefined,
    { sebelumJalan: hapusLokal, padaGalat: galatLokal }
  );

  async function konfirmasi() {
    const form = new FormData();
    for (const [nama, nilai] of Object.entries(hidden)) form.set(nama, nilai);
    if (await jalan(form)) setOpen(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2Icon data-icon="inline-start" />
          {labelTrigger}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{judul}</AlertDialogTitle>
          <AlertDialogDescription>{keterangan}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button type="button" onClick={konfirmasi} disabled={mengirim}>
              {labelKonfirmasi}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
