"use client";

import { useEffect, useState, useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { SaveIcon, XIcon } from "lucide-react";
import { ubahSuratMasuk, type SuratState } from "@/lib/actions/surat";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { lebarOpsiMin } from "@/lib/format";
import { aksiTundaPemberitahuan } from "@/lib/pemberitahuan-client";

type Kategori = { id: string; nama: string };
type Nilai = { [k: string]: string };

function Wajib() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}

/** Koreksi identitas surat. Nomor agenda tidak diubah — ia penanda arsip yang sudah dipakai di laporan. */
export function SuratEditForm({
  suratId,
  nomorAgenda,
  awal,
  kategori,
  pengirim,
}: {
  suratId: string;
  nomorAgenda: string;
  awal: {
    tanggal_terima: string;
    pengirim: string;
    nomor_surat: string;
    tanggal_surat: string;
    perihal: string;
    isi_ringkas: string;
    jenis_surat_id: string;
  };
  kategori: Kategori[];
  pengirim: string[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<SuratState, FormData>(aksiTundaPemberitahuan(ubahSuratMasuk), {});

  // Sukses: pesan jadi toast dan panel ditutup (URL kembali ke detail surat), tanpa reload.
  useEffect(() => {
    if (state.ok) {
      toast(state.ok);
      router.replace(`/surat/${suratId}`);
    }
  }, [state.ok, router, suratId]);
  const [nilai, setNilai] = useState<Nilai>({
    id: suratId,
    tanggal_terima: awal.tanggal_terima,
    pengirim: awal.pengirim,
    pengirim_lain: "",
    nomor_surat: awal.nomor_surat,
    tanggal_surat: awal.tanggal_surat,
    perihal: awal.perihal,
    isi_ringkas: awal.isi_ringkas,
    jenis_surat_id: awal.jenis_surat_id,
  });

  function ubah(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setNilai((n) => ({ ...n, [e.target.name]: e.target.value }));
  }

  const galat = (nama: string) => state.galat?.[nama];
  const invalid = (nama: string) => (galat(nama) ? true : undefined);
  const pengirimLain = nilai.pengirim === "__lain__";

  return (
    <Card variant="inset">
      <CardHeader>
        <CardTitle>Ubah identitas surat</CardTitle>
        <CardDescription>
          Nomor agenda <span className="num">{nomorAgenda}</span> tidak diubah. Status undangan dan disposisi diubah
          di bagiannya masing-masing. Perubahan dicatat di jejak perubahan data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="w-full max-w-[760px]">
          <input type="hidden" name="id" value={suratId} />
          <FieldGroup className="grid gap-4 xl:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="edit_tanggal_terima">
                Tanggal terima <Wajib />
              </FieldLabel>
              <Input
                id="edit_tanggal_terima"
                name="tanggal_terima"
                type="date"
                required
                aria-invalid={invalid("tanggal_terima")}
                value={nilai.tanggal_terima}
                onChange={ubah}
              />
              {galat("tanggal_terima") ? <FieldError>{galat("tanggal_terima")}</FieldError> : null}
            </Field>
            <Field style={{ minWidth: lebarOpsiMin(["Pilih pengirim", ...pengirim, "Lainnya (ketik manual)"]) }}>
              <FieldLabel htmlFor="edit_pengirim">
                Pengirim <Wajib />
              </FieldLabel>
              <NativeSelect
                id="edit_pengirim"
                name="pengirim"
                className="w-full"
                required
                aria-invalid={invalid("pengirim")}
                value={nilai.pengirim}
                onChange={ubah}
              >
                {pengirim.map((n) => (
                  <NativeSelectOption key={n} value={n}>
                    {n}
                  </NativeSelectOption>
                ))}
                <NativeSelectOption value="__lain__">Lainnya (ketik manual)</NativeSelectOption>
              </NativeSelect>
              {pengirimLain ? (
                <Input
                  name="pengirim_lain"
                  required
                  aria-label="Nama pengirim lainnya"
                  aria-invalid={invalid("pengirim")}
                  value={nilai.pengirim_lain}
                  onChange={ubah}
                  placeholder="Instansi atau pihak pengirim"
                />
              ) : null}
              {galat("pengirim") ? <FieldError>{galat("pengirim")}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="edit_nomor_surat">Nomor surat</FieldLabel>
              <Input
                className="num"
                id="edit_nomor_surat"
                name="nomor_surat"
                aria-invalid={invalid("nomor_surat")}
                value={nilai.nomor_surat}
                onChange={ubah}
              />
              {galat("nomor_surat") ? <FieldError>{galat("nomor_surat")}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="edit_tanggal_surat">Tanggal surat</FieldLabel>
              <Input
                id="edit_tanggal_surat"
                name="tanggal_surat"
                type="date"
                aria-invalid={invalid("tanggal_surat")}
                value={nilai.tanggal_surat}
                onChange={ubah}
              />
              {galat("tanggal_surat") ? <FieldError>{galat("tanggal_surat")}</FieldError> : null}
            </Field>
            <Field className="xl:col-span-2">
              <FieldLabel htmlFor="edit_perihal">
                Perihal <Wajib />
              </FieldLabel>
              <Input
                id="edit_perihal"
                name="perihal"
                required
                maxLength={500}
                aria-invalid={invalid("perihal")}
                value={nilai.perihal}
                onChange={ubah}
              />
              {galat("perihal") ? <FieldError>{galat("perihal")}</FieldError> : null}
            </Field>
            <Field className="xl:col-span-2">
              <FieldLabel htmlFor="edit_isi_ringkas">Ringkasan isi</FieldLabel>
              <Textarea
                id="edit_isi_ringkas"
                name="isi_ringkas"
                rows={4}
                aria-invalid={invalid("isi_ringkas")}
                value={nilai.isi_ringkas}
                onChange={ubah}
              />
              {galat("isi_ringkas") ? <FieldError>{galat("isi_ringkas")}</FieldError> : null}
            </Field>
            <Field className="xl:col-span-2 max-w-[340px]" style={{ minWidth: lebarOpsiMin(["Belum ditentukan", ...kategori.map((k) => k.nama)]) }}>
              <FieldLabel htmlFor="edit_jenis_surat_id">Kategori surat</FieldLabel>
              <NativeSelect
                id="edit_jenis_surat_id"
                name="jenis_surat_id"
                className="w-full"
                aria-invalid={invalid("jenis_surat_id")}
                value={nilai.jenis_surat_id}
                onChange={ubah}
              >
                <NativeSelectOption value="">Belum ditentukan</NativeSelectOption>
                {kategori.map((k) => (
                  <NativeSelectOption key={k.id} value={k.id}>
                    {k.nama}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {galat("jenis_surat_id") ? <FieldError>{galat("jenis_surat_id")}</FieldError> : null}
            </Field>

            {state.error ? (
              <Alert variant="destructive" className="xl:col-span-2">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 xl:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
                Simpan perubahan
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/surat/${suratId}`}>
                  <XIcon data-icon="inline-start" />
                  Batal
                </Link>
              </Button>
              <FieldDescription className="text-xs">
                Berkas lampiran diunggah dari bagian Dokumen, tidak dari formulir ini.
              </FieldDescription>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
