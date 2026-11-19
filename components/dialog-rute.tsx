"use client";

import { useRouter, usePathname } from "next/navigation";
import { XIcon } from "lucide-react";
import { cn } from "cn";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";

/**
 * Modal yang dibuka lewat rute (intercepting route), bukan lewat tombol dialog: `/surat/baru` dan
 * `/keluar/baru` tetap alamat yang bisa dibagikan dan di-refresh (merender halaman penuh), tapi kalau
 * dibuka dari daftar formulirnya muncul di atas daftar yang tetap terlihat.
 *
 * Ditutup dengan `router.back()` — sama seperti docs Next untuk modal. `router.push()` tidak bekerja di
 * dalam rute yang diintercept: push tidak mengubah apa pun, jadi tombol tutup, Escape, klik latar, dan
 * "Batal" semuanya memakai back.
 */
export function DialogRute({ rute, children, className }: { rute: string; children: React.ReactNode; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  // Setelah surat tersimpan alamat pindah ke halaman detail; dialog harus ikut hilang, kalau tidak
  // latarnya tetap menutupi halaman detail dan semua kontrol di bawahnya tidak bisa diklik.
  if (pathname !== rute) return null;
  return (
    <Dialog
      open
      onOpenChange={(buka) => {
        if (!buka) router.back();
      }}
    >
      {/* Lebar dialog: kolom dua isian butuh ~736px supaya opsi terpanjang select muat di popupnya;
         default DialogContent 34rem hanya berlaku sampai 640px (sm:) sehingga harus ditimpa di sm juga.
         pb-0: baris aksi modal menempel dasar dialog (sticky bottom-0 dibatasi padding bawah scrollport,
         jadi kalau padding itu dibiarkan ada sisa kosong di bawah bar), dan ruang safe-area HP dipindah
         ke dalam bar aksi sendiri lewat form. */}
      <DialogContent className={cn("max-w-[46rem] pb-0 sm:max-w-[46rem] sm:pb-0", className)}>
        <DialogClose aria-label="Tutup">
          <XIcon />
        </DialogClose>
        {children}
      </DialogContent>
    </Dialog>
  );
}
