"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SaveIcon } from "lucide-react";
import { cn } from "cn";
import { buatSurat, type SuratState } from "@/lib/actions/surat";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { lebarOpsiMin } from "@/lib/format";
import { aksiTundaPemberitahuan } from "@/lib/pemberitahuan-client";

type Kategori = { id: string; nama: string };
type Nilai = { [k: string]: string };

const awal: Nilai = {
  tanggal_terima: "",
  pengirim: "",
  pengirim_lain: "",
  nomor_surat: "",
  tanggal_surat: "",
  perihal: "",
  isi_ringkas: "",
  jenis_surat_id: "",
  undangan: "belum",
  rapat_agenda: "",
  rapat_mulai: "",
  rapat_selesai: "",
  rapat_tempat: "",
  rapat_penyelenggara: "",
};

const opsiUndangan = [
  { value: "belum", judul: "Belum ditentukan", keterangan: "Surat belum ditetapkan apakah berkaitan dengan rapat." },
  { value: "ya", judul: "Ya, ada agenda", keterangan: "Agenda dicatat bersama surat dan masuk ke kalender." },
  { value: "tidak", judul: "Tidak", keterangan: "Surat biasa, tanpa agenda." },
];

/** Isian bertanda * wajib; sisanya boleh kosong. Ditulis satu kali di atas form, tidak di tiap label. */
function Wajib() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}

/**
 * `modal` dipakai oleh rute yang diintercept (@modal): isian sama persis, tapi lebar form mengikuti
 * dialog dan bilah aksi menempel di dasar dialog (latar popover), bukan di dasar jendela halaman.
 */
export function SuratForm({
  kategori,
  pengirim,
  modal = false,
  batalHref = "/surat",
}: {
  kategori: Kategori[];
  pengirim: string[];
  modal?: boolean;
  batalHref?: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<SuratState, FormData>(aksiTundaPemberitahuan(buatSurat), {});
  // Nilai form disimpan di sisi client supaya isian tidak hilang ketika validasi server menolak.
  const [nilai, setNilai] = useState<Nilai>(awal);
  const undanganYa = nilai.undangan === "ya";
  const pengirimLain = nilai.pengirim === "__lain__";

  // Browser reset state radio saat form di-submit, jadi setelah validasi server menolak posisi radio
  // bisa tidak cocok dengan state React (grup rapat muncul tapi lingkaran "belum" yang aktif).
  // Di-sync setiap render, bukan hanya saat nilai berubah.
  useEffect(() => {
    for (const el of document.querySelectorAll<HTMLInputElement>('input[name="undangan"]')) {
      el.checked = el.value === nilai.undangan;
    }
  });

  function ubah(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setNilai((n) => ({ ...n, [e.target.name]: e.target.value }));
  }

  const galat = (nama: string) => state.galat?.[nama];
  const invalid = (nama: string) => (galat(nama) ? true : undefined);

  return (
    <form action={action} className={cn("flex flex-col gap-4", modal ? "w-full" : "w-full max-w-[760px]")}>
      <Card>
        <CardHeader>
          <CardTitle>Identitas surat</CardTitle>
          <CardDescription>
            Nomor agenda dibuat otomatis saat surat disimpan, tidak perlu diisi. Isian bertanda{" "}
            <span aria-hidden="true" className="text-destructive">*</span> wajib, sisanya boleh kosong.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="tanggal_terima">
                Tanggal terima <Wajib />
              </FieldLabel>
              <Input
                id="tanggal_terima"
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
              <FieldLabel htmlFor="pengirim">
                Pengirim <Wajib />
              </FieldLabel>
              <NativeSelect
                id="pengirim"
                name="pengirim"
                className="w-full"
                required
                aria-invalid={invalid("pengirim")}
                value={nilai.pengirim}
                onChange={ubah}
              >
                <NativeSelectOption value="">Pilih pengirim</NativeSelectOption>
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
              <FieldLabel htmlFor="nomor_surat">Nomor surat</FieldLabel>
              <Input
                className="num"
                id="nomor_surat"
                name="nomor_surat"
                aria-invalid={invalid("nomor_surat")}
                value={nilai.nomor_surat}
                onChange={ubah}
                placeholder="001/ABC/X/2026"
              />
              {galat("nomor_surat") ? <FieldError>{galat("nomor_surat")}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="tanggal_surat">Tanggal surat</FieldLabel>
              <Input
                id="tanggal_surat"
                name="tanggal_surat"
                type="date"
                aria-invalid={invalid("tanggal_surat")}
                value={nilai.tanggal_surat}
                onChange={ubah}
              />
              {galat("tanggal_surat") ? <FieldError>{galat("tanggal_surat")}</FieldError> : null}
            </Field>
            {/* Teks satu kalimat tidak perlu membentang sampai ujung kolom: lebar dibatasi supaya mata tidak jauh. */}
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
            <Field className="sm:col-span-2 max-w-[340px]" style={{ minWidth: lebarOpsiMin(["Belum ditentukan", ...kategori.map((k) => k.nama)]) }}>
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
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kaitan surat dengan agenda</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldSet>
            <FieldLegend variant="label">Kaitan surat dengan agenda</FieldLegend>
            {/* Baris radio dijadikan label utuh: satu tap di teks juga memilih opsi, bukan hanya lingkaran 16px. */}
            <FieldGroup data-slot="radio-group">
              {opsiUndangan.map((o) => (
                <Field key={o.value} orientation="horizontal">
                  <FieldLabel htmlFor={`undangan-${o.value}`} className="w-full items-start gap-2">
                    <input
                      type="radio"
                      data-slot="radio"
                      id={`undangan-${o.value}`}
                      name="undangan"
                      value={o.value}
                      checked={nilai.undangan === o.value}
                      onChange={ubah}
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                    />
                    <FieldContent>
                      <FieldTitle>{o.judul}</FieldTitle>
                      <FieldDescription>{o.keterangan}</FieldDescription>
                    </FieldContent>
                  </FieldLabel>
                </Field>
              ))}
            </FieldGroup>
            {galat("undangan") ? <FieldError>{galat("undangan")}</FieldError> : null}
          </FieldSet>

          {/* Formulir rapat hanya muncul saat surat dipilih sebagai undangan, sesuai alur pencatatan. */}
          {undanganYa ? (
            <div aria-live="polite">
              {/* Isian ini wajib hanya saat surat berstatus undangan: wajib tetap memakai required,
                  wajib kondisional memakai aria-required dan validasi server supaya FieldError per isian muncul. */}
              <FieldSet className="mt-4 border-l-2 border-border pl-4">
                <FieldLegend variant="label">Data agenda</FieldLegend>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="rapat_agenda">
                      Judul agenda <Wajib />
                    </FieldLabel>
                    <Input
                      id="rapat_agenda"
                      name="rapat_agenda"
                      aria-required={undanganYa ? true : undefined}
                      aria-invalid={invalid("rapat_agenda")}
                      value={nilai.rapat_agenda}
                      onChange={ubah}
                      placeholder="Rapat koordinasi pengelolaan aset"
                    />
                    {galat("rapat_agenda") ? <FieldError>{galat("rapat_agenda")}</FieldError> : null}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="rapat_mulai">
                      Waktu mulai <Wajib />
                    </FieldLabel>
                    <Input
                      id="rapat_mulai"
                      name="rapat_mulai"
                      type="datetime-local"
                      aria-required={undanganYa ? true : undefined}
                      aria-invalid={invalid("rapat_mulai")}
                      value={nilai.rapat_mulai}
                      onChange={ubah}
                    />
                    {galat("rapat_mulai") ? <FieldError>{galat("rapat_mulai")}</FieldError> : null}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="rapat_selesai">Waktu selesai</FieldLabel>
                    <Input
                      id="rapat_selesai"
                      name="rapat_selesai"
                      type="datetime-local"
                      aria-invalid={invalid("rapat_selesai")}
                      value={nilai.rapat_selesai}
                      onChange={ubah}
                    />
                    {galat("rapat_selesai") ? <FieldError>{galat("rapat_selesai")}</FieldError> : null}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="rapat_tempat">Tempat</FieldLabel>
                    <Input id="rapat_tempat" name="rapat_tempat" value={nilai.rapat_tempat} onChange={ubah} placeholder="Ruang Rapat A" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="rapat_penyelenggara">Penyelenggara</FieldLabel>
                    <Input id="rapat_penyelenggara" name="rapat_penyelenggara" value={nilai.rapat_penyelenggara} onChange={ubah} />
                  </Field>
                </FieldGroup>
              </FieldSet>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Aksi ditempel di dasar jendela: form tiga bagian panjang dan tombol tidak harus dicari di ujung scroll.
         Di dalam modal dasar yang diacu adalah dasar dialog, dengan latar popover dan parit dialog. */}
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
            Simpan surat
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
