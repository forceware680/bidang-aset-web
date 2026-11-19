"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { gunakanPenyegar } from "@/lib/pemberitahuan-client";
import { Trash2Icon, MonitorIcon, EyeOffIcon, UsersIcon } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { cn } from "cn";
import { AksiIkon } from "@/components/aksi-ikon";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { StatusPilih } from "@/components/status-pilih";
import { hapusAgendaMandiri, ubahAgendaMandiri, ubahStatusRapat, ubahTerbitRapat } from "@/lib/actions/rapat";
import { AgendaMandiriDialog } from "@/components/agenda-mandiri-dialog";
import { hapusPeserta } from "@/lib/actions/peserta";
import { PesertaForm } from "@/components/peserta-form";
import { PesertaItem } from "@/components/peserta-item";
import { labelStatusRapat, opsiStatusRapat, tone } from "@/lib/status";
import { jamText } from "@/lib/format";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

/** Peserta agenda untuk ditampilkan dan diubah di baris kalender. */
export type PesertaRinci = { id: string; nama: string; instansi: string | null; keterangan: string | null };

function namaPeserta(nama: string[], batas = 3): string {
  if (nama.length <= batas) return nama.join(", ");
  return `${nama.slice(0, batas).join(", ")} +${nama.length - batas} lainnya`;
}

/**
 * Baris agenda di kalender. Barisnya utuh di sisi client supaya penghapusan bisa terlihat seketika:
 * agenda milik sendiri hilang dari daftar begitu tombol Hapus ditekan, sebelum payload di-refresh.
 * Kalau server menolak (misalnya suratnya sudah diarsipkan), baris kembali dan pesan galat muncul.
 */
export function BarisAgenda({
  id,
  agenda,
  mulai,
  selesai,
  tempat,
  penyelenggara,
  suratId,
  nomorAgenda,
  dibuatOleh,
  statusRapat,
  statusSurat,
  terbit,
  bolehUbah,
  pesertaNama,
  pesertaRinci = [],
  daftarPegawai = [],
  bulan,
  tanggal,
  catatan = null,
  namaSendiri,
}: {
  id: string;
  agenda: string;
  mulai: Date;
  selesai: Date | null;
  tempat: string | null;
  penyelenggara: string | null;
  suratId: string | null;
  nomorAgenda: string | null;
  dibuatOleh: string | null;
  statusRapat: string;
  statusSurat: string | null;
  terbit: boolean;
  bolehUbah: boolean;
  pesertaNama: string | null;
  pesertaRinci?: PesertaRinci[];
  daftarPegawai?: string[];
  bulan: string;
  tanggal: string;
  catatan?: string | null;
  /** Nama pembuat agenda; ditampilkan di dialog ubah sebagai peserta otomatis. */
  namaSendiri?: string;
}) {
  const segar = gunakanPenyegar();
  const mandiri = suratId === null;
  const [statusLokal, setStatusLokal] = useState(statusRapat);
  const [terbitLokal, setTerbitLokal] = useState(terbit);
  const [terhapus, setTerhapus] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  // Hapus agenda diminta lewat AlertDialog: baris hanya hilang setelah pengguna benar-benar mengonfirmasi.
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);
  // "Simpan status" hanya aktif kalau pilihan berbeda dari nilai yang tersimpan: tanpa itu tombol mengirim
  // nilai yang sama dan pengguna mendapat pesan bahwa status berubah padahal tidak ada yang berubah.
  // Nilai dari server mengikuti perubahan realtime: kalau payload baru datang (perubahan dari akun lain,
  // layar monitor, atau aplikasi Android), nilai lokal diselaraskan dengan server. Nilai lokal tetap
  // dipakai sampai payload itu datang, jadi aksi tetap terasa seketika.
  useEffect(() => setStatusLokal(statusRapat), [statusRapat]);
  useEffect(() => setTerbitLokal(terbit), [terbit]);

  if (terhapus) return null;

  async function ubahTerbit() {
    if (mengirim) return;
    const baru = !terbitLokal;
    setMengirim(true);
    setTerbitLokal(baru);
    const form = new FormData();
    form.set("id", id);
    form.set("terbit", baru ? "1" : "0");
    const hasil = await ubahTerbitRapat(form);
    setMengirim(false);
    if (hasil.ok) {
      toast(hasil.pesan ?? "Tampilan di layar monitor diubah.");
      segar();
    } else {
      setTerbitLokal(!baru);
      toast.galat(hasil.pesan);
    }
  }

  async function hapus() {
    if (mengirim) return;
    setMengirim(true);
    setTerhapus(true);
    const form = new FormData();
    form.set("id", id);
    const hasil = await hapusAgendaMandiri(form);
    setMengirim(false);
    if (hasil.ok) {
      toast(hasil.pesan ?? "Agenda dihapus.");
      segar();
    } else {
      setTerhapus(false);
      toast.galat(hasil.pesan);
    }
  }

  return (
    <div className="border-b py-3 last:border-b-0 last:pb-0 md:grid md:grid-cols-[7.5rem_minmax(0,1fr)_auto] md:items-start md:gap-x-5">
      <p className="num shrink-0 font-medium md:min-w-[7.5rem]">
        {jamText(mulai)}
        {selesai ? ` – ${jamText(selesai)}` : ""}
      </p>
      <div className="mt-2 min-w-0 md:mt-0">
        <p className="font-medium text-balance">{agenda}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {tempat ? `di ${tempat}` : ""}
          {penyelenggara ? `${tempat ? " · " : ""}diselenggarakan ${penyelenggara}` : ""}
        </p>
        {/* Kepemilikan dan keadaan tampilan ditulis sebagai baris sendiri: baris pertama menjawab "di mana",
          baris ini menjawab "milik siapa dan tampil di mana". Yang tidak tampil di layar diberi tanda
          amber karena itu keadaan yang perlu dilihat, bukan hiasan. */}
        {(mandiri || !terbitLokal || statusSurat === "arsip") ? (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {mandiri ? <span>agenda sendiri, dibuat oleh {dibuatOleh ?? "tidak tercatat"}</span> : null}
            {!terbitLokal ? (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning ring-1 ring-warning/35">
                tidak tampil di layar
              </span>
            ) : null}
            {statusSurat === "arsip" ? (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning ring-1 ring-warning/35">
                suratnya sudah diarsipkan, status agenda tidak bisa diubah
              </span>
            ) : null}
          </p>
        ) : null}
        {/* Pejabat/pegawai yang hadir ikut ditampilkan supaya kalender dan layar monitor membaca orang yang sama. */}
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <UsersIcon className="size-3.5 shrink-0" aria-hidden="true" />
          {pesertaNama ? (
            <span>
              diikuti <span className="text-foreground">{namaPeserta(pesertaNama.split(", ").filter(Boolean))}</span>
            </span>
          ) : (
            <span>peserta belum ditulis</span>
          )}
        </p>
        {catatan ? (
          <p className="mt-1 max-w-[68ch] text-sm text-muted-foreground">catatan: {catatan}</p>
        ) : null}
        {suratId ? (
          <Link href={`/surat/${suratId}`} className="mt-1 text-sm text-primary underline underline-offset-4">
            Buka surat {nomorAgenda ?? ""}
          </Link>
        ) : null}
        {/* Daftar peserta agenda mandiri dikelola di kalender sendiri; agenda dari surat tetap dikelola di halaman suratnya. */}
        {mandiri && bolehUbah ? (
          <Accordion type="single" collapsible className="mt-2 border-border/70 bg-input/20 md:max-w-[46rem]" data-aksi="peserta">
            <AccordionItem value="peserta" className="border-b-0">
              <AccordionTrigger className="px-3 py-2 hover:no-underline">
                Kelola peserta agenda ini{pesertaRinci.length > 0 ? ` (${pesertaRinci.length})` : ""}
              </AccordionTrigger>
              <AccordionContent className="px-3">
                <div className="flex flex-col gap-2">
                  {pesertaRinci.map((p) => (
                    <PesertaItem key={p.id} id={p.id} nama={p.nama} instansi={p.instansi} keterangan={p.keterangan} bolehUbah hapusAction={hapusPeserta} />
                  ))}
                  <PesertaForm rapatId={id} daftarPegawai={daftarPegawai} />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}
      </div>
      {/* Kontrol agenda satu kesatuan: ButtonGroup shadcn berisi pilihan status dan aksi monitor/ubah/hapus,
          duduk di kanan baris sejajar judul. Yang tidak boleh diubah hanya menunjukkan badge status. */}
      <div className="mt-2 flex w-full justify-end md:mt-0 md:w-auto">
        {bolehUbah && statusSurat !== "arsip" ? (
          <ButtonGroup className="[&_[data-slot=select-trigger]]:border-input! [&>[data-slot=button]:last-child]:rounded-r-full! md:[&>[data-slot=button]:last-child]:rounded-r-2xl!">
            <StatusPilih
              aksi={ubahStatusRapat}
              nama="status_rapat"
              nilai={statusRapat}
              dataAksi="status"
              kelas="rounded-l-full! rounded-r-none! md:rounded-l-2xl!"
              bertint
              tambahan={{ id }}
              label={`Status agenda ${agenda}`}
              opsi={opsiStatusRapat({ tanggal_mulai: mulai, tanggal_selesai: selesai }, statusLokal).map((kode) => ({
                kode,
                label: labelStatusRapat[kode],
              }))}
            />
            {/* Publikasi ke monitor di depan ruangan: agenda boleh disembunyikan. Optimistis seperti status —
              kalau server menolak (surat diarsipkan), baris kembali dan pesan galat muncul. */}
            <AksiIkon
              label={terbitLokal ? `Sembunyikan agenda ${agenda} dari layar monitor` : `Tampilkan agenda ${agenda} di layar monitor`}
              teks=""
              className="h-11 w-11 px-0 md:h-8 md:w-8 md:px-0"
              onClick={ubahTerbit}
              type="button"
            >
              {/* Ikon menunjukkan keadaan agenda sekarang: monitor = tampil di layar, mata silang = tidak tampil. */}
              {terbitLokal ? <MonitorIcon /> : <EyeOffIcon />}
            </AksiIkon>
            {/* Agenda milik sendiri diubah di tempat lewat dialog yang sama dengan dialog buat — pembuat
              tidak perlu hapus lalu input ulang. Agenda dari surat tetap diubah di halaman suratnya. */}
            {mandiri ? (
              <AgendaMandiriDialog
                posisi="baris"
                action={ubahAgendaMandiri}
                bulan={bulan}
                tanggal={tanggal}
                isi={{ id, agenda_rapat: agenda, mulai, selesai, tempat, penyelenggara, catatan }}
                daftarPegawai={daftarPegawai}
                namaSendiri={namaSendiri}
              />
            ) : null}
            {mandiri ? (
              <AlertDialog open={konfirmasiHapus} onOpenChange={setKonfirmasiHapus}>
                <TooltipProvider>
                  <Tooltip>
                    <AlertDialogTrigger asChild>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="destructive"
                          aria-label={`Hapus agenda ${agenda}`}
                          className="border-input h-11 w-11 px-0 md:h-8 md:w-8 md:px-0"
                        >
                          <Trash2Icon />
                        </Button>
                      </TooltipTrigger>
                    </AlertDialogTrigger>
                    <TooltipContent side="top">Hapus agenda</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus agenda ini?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {agenda} beserta peserta yang tercatat akan dihapus. Setelah dihapus, agenda tidak bisa dikembalikan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction asChild>
                      <Button
                        type="button"
                        disabled={mengirim}
                        onClick={() => {
                          setKonfirmasiHapus(false);
                          void hapus();
                        }}
                      >
                        Hapus agenda
                      </Button>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </ButtonGroup>
        ) : (
          <Badge variant={tone(statusLokal) as BadgeVariant} className="rounded-full md:rounded-md">{labelStatusRapat[statusLokal]}</Badge>
        )}
      </div>
    </div>
  );
}

