"use client";

import { useState } from "react";
import { PlusIcon, SaveIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PesertaPilih } from "@/components/peserta-pilih";
import { datetimeLokalJakarta } from "@/lib/format";

/** Nilai yang sudah tercatat pada sebuah agenda mandiri, untuk mengisi formulir ubah. */
export type AgendaIsi = {
  id: string;
  agenda_rapat: string;
  mulai: Date;
  selesai: Date | null;
  tempat: string | null;
  penyelenggara: string | null;
  catatan: string | null;
};

/**
 * Formulir agenda tanpa surat masuk. Waktu dibaca sebagai jam Asia/Jakarta oleh server action.
 * Kalau `isi` diberikan, formulir menjadi formulir ubah: isian terisi nilai yang ada dan `id`
 * ikut dikirim, supaya pembuat tidak perlu hapus lalu input ulang.
 */
export function AgendaMandiriForm({
  action,
  bulan,
  tanggal,
  isi,
  daftarPegawai = [],
  namaSendiri,
}: {
  action: (formData: FormData) => Promise<void>;
  bulan: string;
  tanggal: string;
  isi?: AgendaIsi;
  /** Daftar pegawai bidang aset yang aktif, untuk memilih peserta. */
  daftarPegawai?: string[];
  /** Nama pembuat agenda; server mencatatnya otomatis sebagai peserta. */
  namaSendiri?: string;
}) {
  const [mengirim, setMengirim] = useState(false);
  const ubah = isi !== undefined;
  const awalan = ubah ? `ubah-${isi!.id}` : "baru";

  return (
    <form action={action} onSubmit={() => setMengirim(true)} className="w-full">
      <input type="hidden" name="bulan" value={bulan} />
      <input type="hidden" name="tanggal" value={tanggal} />
      {ubah ? <input type="hidden" name="id" value={isi!.id} /> : null}
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={`${awalan}_agenda`}>Agenda</FieldLabel>
          <Input id={`${awalan}_agenda`} name="agenda_rapat" required maxLength={300} placeholder="misal: rapat koordinasi barang milik daerah" defaultValue={isi?.agenda_rapat ?? ""} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${awalan}_mulai`}>Waktu mulai</FieldLabel>
          <Input id={`${awalan}_mulai`} name="tanggal_mulai" type="datetime-local" required defaultValue={isi ? datetimeLokalJakarta(isi.mulai) : `${tanggal}T08:00`} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${awalan}_selesai`}>Waktu selesai (opsional)</FieldLabel>
          <Input id={`${awalan}_selesai`} name="tanggal_selesai" type="datetime-local" defaultValue={isi ? datetimeLokalJakarta(isi.selesai) : ""} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${awalan}_tempat`}>Tempat (opsional)</FieldLabel>
          <Input id={`${awalan}_tempat`} name="tempat" maxLength={300} placeholder="misal: Ruang Rapat A" defaultValue={isi?.tempat ?? ""} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${awalan}_penyelenggara`}>Penyelenggara (opsional)</FieldLabel>
          <Input id={`${awalan}_penyelenggara`} name="penyelenggara" maxLength={200} placeholder="misal: Bagian Umum" defaultValue={isi?.penyelenggara ?? ""} />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={`${awalan}_peserta`}>Pejabat/pegawai yang ikut</FieldLabel>
          <PesertaPilih
            daftarPegawai={daftarPegawai}
            idIsian={`${awalan}_peserta`}
            deskripsi={
              ubah
                ? "Peserta yang sudah tercatat tetap ada; nama yang dipilih di sini ditambahkan ke agenda ini."
                : "Pilih dari pejabat/pegawai yang punya akun aplikasi — agenda yang kamu buat tetap melibatkan orang lain."
            }
            namaSendiri={namaSendiri}
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={`${awalan}_catatan`}>Catatan (opsional)</FieldLabel>
          <Textarea id={`${awalan}_catatan`} name="catatan" maxLength={2000} placeholder="misal: bawa daftar inventaris C1" defaultValue={isi?.catatan ?? ""} />
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={mengirim}>
            {mengirim ? <Spinner data-icon="inline-start" /> : ubah ? <SaveIcon data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
            {mengirim ? "Menyimpan…" : ubah ? "Simpan perubahan" : "Buat agenda"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {ubah
              ? "Perubahan hanya tersimpan untuk pembuat agenda ini. Status tetap diubah dari barisnya."
              : "Tanpa surat masuk. Pembuatnya bisa menghapus atau mengubah status agenda ini."}
          </p>
        </div>
      </FieldGroup>
    </form>
  );
}
