"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SaveIcon } from "lucide-react";
import { cn } from "cn";
import { buatSuratKeluar, type SuratKeluarState } from "@/lib/actions/keluar";
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

const awal: Nilai = {
  tanggal_surat: "",
  tujuan: "",
  tujuan_lain: "",
  nomor_surat: "",
  perihal: "",
  isi_ringkas: "",
  catatan: "",
  jenis_surat_id: "",
  surat_asal_id: "",
};

function Wajib() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}

/**
 * Pencatatan surat keluar. Nomor surat dibiarkan kosong bila petugas tidak punya nomor tata naskah:
 * sistem membuat KL-001/2026 dari penghitung tersendiri. `modal` dipakai oleh rute yang diintercept:
 * isian sama, lebar mengikuti dialog, bilah aksi menempel di dasar dialog.
 */
export function KeluarForm({
  kategori,
  penerima,
  asal,
  modal = false,
  batalHref = "/keluar",
}: {
  kategori: Kategori[];
  penerima: string[];
  asal: Asal[];
  modal?: boolean;
  batalHref?: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<SuratKeluarState, FormData>(aksiTundaPemberitahuan(buatSuratKeluar), {});
  // Nilai form disimpan di sisi client supaya isian tidak hilang ketika validasi server menolak.
  const [nilai, setNilai] = useState<Nilai>(awal);
  const tujuanLain = nilai.tujuan === "__lain__";

  function ubah(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setNilai((n) => ({ ...n, [e.target.name]: e.target.value }));
  }

  const galat = (nama: string) => state.galat?.[nama];
  const invalid = (nama: string) => (galat(nama) ? true : undefined);
  // Opsi surat asal dipotong supaya popup select tidak melebar ke luar panel di layar sempit.
  const opsiAsal = asal.map((a) => `${a.nomor_agenda} — ${a.perihal}`.slice(0, 70));

  return (
    <form action={action} className={cn("flex flex-col gap-4", modal ? "w-full" : "w-full max-w-[760px]")}>
      <Card>
        <CardHeader>
          <CardTitle>Identitas surat keluar</CardTitle>
          <CardDescription>
            Nomor surat dibuat otomatis bila dibiarkan kosong. Isian bertanda{" "}
            <span aria-hidden="true" className="text-destructive">*</span> wajib, sisanya boleh kosong.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="tanggal_surat">
                Tanggal surat <Wajib />
              </FieldLabel>
              <Input
                id="tanggal_surat"
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
              <FieldLabel htmlFor="tujuan">
                Tujuan surat <Wajib />
              </FieldLabel>
              <NativeSelect
                id="tujuan"
                name="tujuan"
                className="w-full"
                required
                aria-invalid={invalid("tujuan")}
                value={nilai.tujuan}
                onChange={ubah}
              >
                <NativeSelectOption value="">Pilih tujuan</NativeSelectOption>
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
            <Field>
              <FieldLabel htmlFor="nomor_surat">Nomor surat</FieldLabel>
              <Input
                className="num"
                id="nomor_surat"
                name="nomor_surat"
                aria-invalid={invalid("nomor_surat")}
                value={nilai.nomor_surat}
                onChange={ubah}
                placeholder="biarkan kosong, nomor dibuat otomatis (misal KL-001/2026)"
              />
              {galat("nomor_surat") ? <FieldError>{galat("nomor_surat")}</FieldError> : null}
            </Field>
            <Field className="max-w-[340px]" style={{ minWidth: lebarOpsiMin(["Belum ditentukan", ...kategori.map((k) => k.nama)]) }}>
              <FieldLabel htmlFor="jenis_surat_id">Kategori surat</FieldLabel>
              <NativeSelect
                id="jenis_surat_id"
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
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="perihal">
                Perihal <Wajib />
              </FieldLabel>
              <Input
                id="perihal"
                name="perihal"
                required
                maxLength={500}
                aria-invalid={invalid("perihal")}
                value={nilai.perihal}
                onChange={ubah}
              />
              {galat("perihal") ? <FieldError>{galat("perihal")}</FieldError> : null}
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="isi_ringkas">Ringkasan isi</FieldLabel>
              <Textarea
                id="isi_ringkas"
                name="isi_ringkas"
                rows={4}
                aria-invalid={invalid("isi_ringkas")}
                value={nilai.isi_ringkas}
                onChange={ubah}
              />
              {galat("isi_ringkas") ? <FieldError>{galat("isi_ringkas")}</FieldError> : null}
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="catatan">Catatan</FieldLabel>
              <Textarea
                id="catatan"
                name="catatan"
                rows={2}
                aria-invalid={invalid("catatan")}
                value={nilai.catatan}
                onChange={ubah}
                placeholder="misal: ditandatangani Kabid Aset, dikirim lewat SDP"
              />
              {galat("catatan") ? <FieldError>{galat("catatan")}</FieldError> : null}
            </Field>
            <Field className="sm:col-span-2" style={{ minWidth: lebarOpsiMin(["Tanpa surat asal", ...opsiAsal]) }}>
              <FieldLabel htmlFor="surat_asal_id">Balasan dari surat masuk</FieldLabel>
              <NativeSelect
                id="surat_asal_id"
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
              <FieldDescription>Dipilih hanya bila surat keluar ini membalas surat yang sudah dicatat.</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Aksi ditempel di dasar jendela supaya tombol tidak dicari di ujung scroll; di dalam modal
         dasarnya adalah dasar dialog dengan latar popover. */}
      <div
        data-slot="form-actions"
        className={cn(
          "sticky bottom-0 z-20 border-t border-border",
          // Di modal barisnya latar penuh (popover solid) dan menempel dasar dialog — kalau latar tembus,
          // teks keterangan di dasar bar terlihat seperti ada lubang di bawah dialog.
          modal ? "-mx-5 bg-popover px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6" : "-mx-4 bg-background px-4 py-3 md:-mx-6 md:px-6 md:-mb-6",
        )}
      >
        <div className={cn("flex flex-wrap items-center gap-2", modal ? "w-full" : "max-w-[760px]")}>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
            Simpan surat keluar
          </Button>
          {/* Di dalam modal "Batal" harus router.back(): router.push() tidak menghasilkan navigasi
            pada rute yang diintercept. Di halaman biasa tautan biasa tetap paling tepat. */}
          {modal ? (
            <Button variant="outline" type="button" onClick={() => router.back()}>
              Batal
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link href={batalHref}>Batal</Link>
            </Button>
          )}
          <FieldDescription className="text-xs">
            Scan dan lampiran diunggah dari halaman suratnya setelah surat tersimpan.
          </FieldDescription>
        </div>
      </div>
    </form>
  );
}
