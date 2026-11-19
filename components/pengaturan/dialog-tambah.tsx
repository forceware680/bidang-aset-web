"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { AksiForm } from "@/components/aksi-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Hasil } from "@/lib/hasil";

/**
 * Satu dialog untuk semua aksi "tambah" di Pengaturan (kategori surat, daftar nama, akun baru).
 * Tombolnya di pojok kanan atas header di desktop, dan pil melayang di atas bilah bawah navigasi
 * di HP — sama seperti "Tambah Surat" di halaman surat masuk. Di HP dialognya jadi sheet bawah
 * bawaan DialogContent. Isian form dikirim lewat `aksi` (server action), dialog tertutup saat sukses.
 */
export function DialogTambah({
  aksi,
  label,
  judul,
  deskripsi,
  anak,
  pesanSukses,
}: {
  aksi: (form: FormData) => Promise<Hasil>;
  label: string;
  judul: string;
  deskripsi?: string;
  anak: React.ReactNode;
  pesanSukses?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* data-slot dipertahankan "button" supaya aturan target sentuh 44px di layar sentuh berlaku
          (Radix menimpa slot trigger menjadi "dialog-trigger"). */}
      <DialogTrigger asChild data-slot="button">
        <Button className="hidden shrink-0 gap-1.5 md:inline-flex">
          <PlusIcon data-icon="inline-start" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogTrigger asChild data-slot="button">
        <Button
          className="tanpa-cetak fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+5rem)] right-4 z-40 rounded-full shadow-[0_12px_28px_-12px_oklch(0.20_0.03_322/0.55)] md:hidden data-[state=open]:invisible"
          aria-label={label}
        >
          <PlusIcon data-icon="inline-start" />
          Tambah
        </Button>
      </DialogTrigger>
      {/* Di HP bilah bawah navigasi Pengaturan melayang di dasar layar, jadi sheet diberi ruang
          tambahan setinggi bilah itu supaya tombol submit tidak jatuh di belakangnya. */}
      <DialogContent className="max-w-lg md:max-w-md max-sm:pb-[calc(max(1.25rem,env(safe-area-inset-bottom))+5rem)]">
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          {deskripsi ? <DialogDescription>{deskripsi}</DialogDescription> : null}
        </DialogHeader>
        <AksiForm
          aksi={aksi}
          pesanSukses={pesanSukses}
          padaSukses={() => setOpen(false)}
          className="flex flex-col gap-4"
        >
          {anak}
          <Button type="submit" className="w-full gap-1.5">
            <PlusIcon data-icon="inline-start" />
            {label}
          </Button>
        </AksiForm>
      </DialogContent>
    </Dialog>
  );
}
