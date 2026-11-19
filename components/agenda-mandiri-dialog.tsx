"use client";

import { PlusIcon, PencilIcon, XIcon } from "lucide-react";
import { AgendaMandiriForm, type AgendaIsi } from "@/components/agenda-form";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * Agenda tanpa surat masuk dibuka lewat tombol, bukan menempel di bawah kalender: formulirnya
 * enam isian dan itu bukan isi utama halaman kalender. Di HP dialognya sheet bawah, di desktop
 * modal di tengah. Server action tetap di sini supaya `redirect()` membawa pesan kembali.
 *
 * `posisi` menentukan di mana tombolnya berada: `"header"` sejajar aksi "Tambah Surat" di header
 * halaman (desktop), `"melayang"` adalah pil di pojok kanan bawah (HP) — dua-duanya membuka dialog
 * yang sama, jadi hanya satu yang terlihat pada tiap lebar layar.
 */
export function AgendaMandiriDialog({
  action,
  bulan,
  tanggal,
  posisi = "header",
  isi,
  daftarPegawai = [],
  namaSendiri,
}: {
  action: (formData: FormData) => Promise<void>;
  bulan: string;
  tanggal: string;
  posisi?: "header" | "melayang" | "baris";
  /** Kalau diisi, dialog menjadi dialog ubah: isian terisi nilai agenda yang ada. */
  isi?: AgendaIsi;
  /** Daftar pegawai bidang aset yang aktif, untuk memilih peserta yang ikut. */
  daftarPegawai?: string[];
  /** Nama pembuat; server mencatatnya otomatis sebagai peserta. */
  namaSendiri?: string;
}) {
  const ubah = isi !== undefined;
  const kelasTombol =
    posisi === "melayang"
      ? "tanpa-cetak fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 rounded-full shadow-[0_12px_28px_-12px_oklch(0.20_0.03_322/0.55)] md:hidden"
      : posisi === "baris"
        ? "h-11 w-11 px-0 md:h-8 md:w-8 md:px-0"
        : "hidden md:inline-flex";
  // Tiap dialog punya id sendiri: di kalender banyak baris sekaligus, jadi id bersama akan duplikat.
  const idJudul = ubah ? `judul-agenda-${isi!.id}` : "judul-agenda-baru";
  const idDeskripsi = ubah ? `deskripsi-agenda-${isi!.id}` : "agenda-mandiri-desc";

  return (
    <Dialog>
      {/* data-slot dipertahankan "button": Radix menimpa slot child dengan "dialog-trigger", dan
         aturan target sentuh 44px di layar sentuh hanya berlaku untuk kontrol ber-slot button. */}
      {posisi === "baris" ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild data-slot="button">
                <Button variant="outline" data-ikon-saja className={kelasTombol} aria-label={`Ubah agenda ${isi!.agenda_rapat}`}>
                  <PencilIcon />
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">Ubah agenda ini</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <DialogTrigger asChild data-slot="button">
          <Button
            data-fab={posisi === "melayang" ? "" : undefined}
            size={posisi === "melayang" ? undefined : "sm"}
            className={kelasTombol}
            aria-label={ubah ? `Ubah agenda ${isi!.agenda_rapat}` : undefined}
          >
            {ubah ? <PencilIcon data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
            {ubah ? "Ubah agenda" : "Buat agenda sendiri"}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent aria-labelledby={idJudul} aria-describedby={idDeskripsi}>
        <DialogHeader className="pr-10">
          <DialogTitle id={idJudul}>{ubah ? `Ubah agenda ${isi!.agenda_rapat}` : "Buat agenda sendiri"}</DialogTitle>
          <DialogDescription id={idDeskripsi}>
            {ubah
              ? "Judul, waktu, tempat, penyelenggara, dan catatan agenda milikmu diubah di tempat — tidak perlu hapus lalu input ulang."
              : "Pengingat untuk dirimu sendiri atau kegiatan internal bidang — tidak perlu surat masuk. Agenda ini ikut di kalender dan bisa dihapus oleh pembuatnya."}
          </DialogDescription>
        </DialogHeader>
        <DialogClose aria-label="Tutup"><XIcon /></DialogClose>
        <AgendaMandiriForm action={action} bulan={bulan} tanggal={tanggal} isi={isi} daftarPegawai={daftarPegawai} namaSendiri={namaSendiri} />
      </DialogContent>
    </Dialog>
  );
}
