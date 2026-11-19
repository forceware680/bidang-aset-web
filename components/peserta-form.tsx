"use client";

import { UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { AksiForm } from "@/components/aksi-form";
import { PesertaPilih } from "@/components/peserta-pilih";
import { tambahPeserta } from "@/lib/actions/peserta";

/**
 * Tambah peserta untuk satu agenda. Nama diambil dari pejabat/pegawai yang punya akun aplikasi
 * (PesertaPilih); keterangan per peserta boleh dikosongkan. Aksi tetap `tambahPeserta` — peserta
 * lama tidak dikirim, jadi isian ini hanya menambah, tidak menghapus yang sudah tercatat.
 */
export function PesertaForm({ rapatId, suratId, daftarPegawai }: { rapatId: string; suratId?: string; daftarPegawai: string[] }) {
  return (
    <AksiForm aksi={tambahPeserta} className="w-full">
      <input type="hidden" name="rapat_id" value={rapatId} />
      {suratId ? <input type="hidden" name="surat_id" value={suratId} /> : null}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="peserta_nama">Tambah peserta</FieldLabel>
          <PesertaPilih
            daftarPegawai={daftarPegawai}
            idIsian="peserta_nama"
            deskripsi="Ketik nama, pilih dari pejabat/pegawai yang punya akun aplikasi, lalu tekan Tab untuk menambahkan peserta berikutnya."
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="peserta_keterangan">Keterangan</FieldLabel>
          <Textarea id="peserta_keterangan" name="keterangan" rows={2} placeholder="Misalnya menghadiri mewakili kepala perangkat daerah." />
        </Field>
        <Field>
          <Button type="submit">
            <UsersIcon data-icon="inline-start" />
            Tambah peserta ke agenda ini
          </Button>
        </Field>
      </FieldGroup>
    </AksiForm>
  );
}
