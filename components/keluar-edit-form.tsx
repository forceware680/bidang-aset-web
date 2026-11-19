"use client";

import { useEffect, useState, useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { SaveIcon, XIcon } from "lucide-react";
import { ubahSuratKeluar, type SuratKeluarState } from "@/lib/actions/keluar";
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
type Asal = { id: string; nomor_agenda: string; perihal: string };
type Nilai = { [k: string]: string };

function Wajib() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}

/** Koreksi identitas surat keluar. Status surat diubah di bagiannya sendiri, tidak di form ini. */
export function KeluarEditForm({
  suratId,
  nomorSurat,
  awal,
  kategori,
  penerima,
  asal,
}: {
  suratId: string;
  nomorSurat: string;
  awal: {
    tanggal_surat: string;
    waktu_kirim: string;
    tujuan: string;
    nomor_surat: string;
    perihal: string;
    isi_ringkas: string;
    catatan: string;
    jenis_surat_id: string;
    surat_asal_id: string;
  };
  kategori: Kategori[];
  penerima: string[];
  asal: Asal[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<SuratKeluarState, FormData>(aksiTundaPemberitahuan(ubahSuratKeluar), {});

  // Sukses: pesan jadi toast dan panel ditutup (URL kembali ke detail surat keluar), tanpa reload.
  useEffect(() => {
    if (state.ok) {
      toast(state.ok);
      router.replace(`/keluar/${suratId}`);
    }
  }, [state.ok, router, suratId]);

  const [nilai, setNilai] = useState<Nilai>({
    id: suratId,
    tanggal_surat: awal.tanggal_surat,
    waktu_kirim: awal.waktu_kirim,
    tujuan: awal.tujuan,
    tujuan_lain: "",
    nomor_surat: awal.nomor_surat,
    perihal: awal.perihal,
    isi_ringkas: awal.isi_ringkas,
    catatan: awal.catatan,
    jenis_surat_id: awal.jenis_surat_id,
    surat_asal_id: awal.surat_asal_id,
  });

  function ubah(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setNilai((n) => ({ ...n, [e.target.name]: e.target.value }));
  }

  const galat = (nama: string) => state.galat?.[nama];
  const invalid = (nama: string) => (galat(nama) ? true : undefined);
  const tujuanLain = nilai.tujuan === "__lain__";
  // Opsi surat asal dipotong supaya popup select tidak melebar ke luar panel di layar sempit.
  const opsiAsal = asal.map((a) => `${a.nomor_agenda} — ${a.perihal}`.slice(0, 70));

  return (
    <Card variant="inset">
      <CardHeader>
        <CardTitle>Ubah identitas surat keluar</CardTitle>
        <CardDescription>
          Nomor surat <span className="num">{nomorSurat}</span> boleh dikoreksi bila surat sudah punya nomor tata
          naskah sendiri. Perubahan dicatat di jejak perubahan data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="w-full max-w-[760px]">
          <input type="hidden" name="id" value={suratId} />
          <FieldGroup className="grid gap-4 xl:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="edit_tanggal_surat">
                Tanggal surat <Wajib />
              </FieldLabel>
              <Input
                id="edit_tanggal_surat"
                name="tanggal_surat"
                type="date"
                required
                aria-invalid={invalid("tanggal_surat")}
                value={nilai.tanggal_surat}
                onChange={ubah}
              />
              {galat("tanggal_surat") ? <FieldError>{galat("tanggal_surat")}</FieldError> : null}
            </Field>
            <Field style={{ minWidth: lebarOpsiMin(["Pilih tujuan", ...penerima, "Lainnya (ketik manual)"]) }}>
              <FieldLabel htmlFor="edit_tujuan">
                Tujuan surat <Wajib />
              </FieldLabel>
              <NativeSelect
                id="edit_tujuan"
                name="tujuan"
                className="w-full"
                required
                aria-invalid={invalid("tujuan")}
                value={nilai.tujuan}
                onChange={ubah}
              >
                {penerima.map((n) => (
                  <NativeSelectOption key={n} value={n}>
                    {n}
                  </NativeSelectOption>
                ))}
                <NativeSelectOption value="__lain__">Lainnya (ketik manual)</NativeSelectOption>
              </NativeSelect>
              {tujuanLain ? (
                <Input
                  name="tujuan_lain"
                  required
                  aria-label="Nama tujuan lainnya"
                  aria-invalid={invalid("tujuan")}
                  value={nilai.tujuan_lain}
                  onChange={ubah}
                  placeholder="Instansi atau pihak yang dituju"
                />
              ) : null}
              {galat("tujuan") ? <FieldError>{galat("tujuan")}</FieldError> : null}
            </Field>
            <Field className="xl:col-span-2">
              <FieldLabel htmlFor="edit_waktu_kirim">Waktu kirim</FieldLabel>
              <Input
                className="num sm:max-w-[16rem]"
                id="edit_waktu_kirim"
                name="waktu_kirim"
                type="datetime-local"
                aria-invalid={invalid("waktu_kirim")}
                value={nilai.waktu_kirim}
                onChange={ubah}
              />
              <FieldDescription>
                Kosong bila surat belum dikirim. Boleh waktu yang sudah lewat — misal surat dicatat hari ini tetapi
                dikirim kemarin. Waktu yang sudah diisi tidak ditimpa saat surat ditandai dikirim.
              </FieldDescription>
              {galat("waktu_kirim") ? <FieldError>{galat("waktu_kirim")}</FieldError> : null}
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
            <Field className="max-w-[340px]" style={{ minWidth: lebarOpsiMin(["Belum ditentukan", ...kategori.map((k) => k.nama)]) }}>
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
            <Field className="xl:col-span-2">
              <FieldLabel htmlFor="edit_catatan">Catatan</FieldLabel>
              <Textarea
                id="edit_catatan"
                name="catatan"
                rows={2}
                aria-invalid={invalid("catatan")}
                value={nilai.catatan}
                onChange={ubah}
              />
              {galat("catatan") ? <FieldError>{galat("catatan")}</FieldError> : null}
            </Field>
            <Field className="xl:col-span-2" style={{ minWidth: lebarOpsiMin(["Tanpa surat asal", ...opsiAsal]) }}>
              <FieldLabel htmlFor="edit_surat_asal_id">Balasan dari surat masuk</FieldLabel>
              <NativeSelect
                id="edit_surat_asal_id"
                name="surat_asal_id"
                className="w-full"
                aria-invalid={invalid("surat_asal_id")}
                value={nilai.surat_asal_id}
                onChange={ubah}
              >
                <NativeSelectOption value="">Tanpa surat asal</NativeSelectOption>
                {asal.map((a, i) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {opsiAsal[i]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {galat("surat_asal_id") ? <FieldError>{galat("surat_asal_id")}</FieldError> : null}
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
                <Link href={`/keluar/${suratId}`}>
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
