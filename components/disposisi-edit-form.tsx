"use client";

import { useEffect, useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { SaveIcon, XIcon } from "lucide-react";
import { ubahDisposisi, type DisposisiState } from "@/lib/actions/disposisi";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { PilihInstruksi, type ModeInstruksi } from "@/components/pilih-instruksi";
import { labelTindakLanjut, tanpaInstruksi } from "@/lib/status";
import { lebarOpsiMin } from "@/lib/format";
import { aksiTundaPemberitahuan } from "@/lib/pemberitahuan-client";

type Nilai = { [k: string]: string };

/** Nilai dropdown yang berarti "ketik nama sendiri". */
const lain = "__lain__";

export function DisposisiEditForm({
  suratId,
  disposisiId,
  awal,
  pejabat,
  terusan,
  batalHref,
}: {
  suratId: string;
  disposisiId: string;
  awal: {
    tanggal_disposisi: string;
    pemberi_disposisi: string;
    penerima_disposisi: string;
    tanggal_diteruskan: string;
    isi_disposisi: string;
    catatan: string;
    status_tindak_lanjut: string;
  };
  pejabat: string[];
  terusan: string[];
  batalHref: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<DisposisiState, FormData>(aksiTundaPemberitahuan(ubahDisposisi), {});

  // Sukses: toast lalu panel ditutup lewat URL bersih; nilai yang dikoreksi langsung terbaca dari refresh.
  useEffect(() => {
    if (state.ok) {
      toast(state.ok);
      router.replace(batalHref);
    }
  }, [state.ok, batalHref, router]);
  // Nilai lama yang strip "-" atau kosong dibaca sebagai tanpa instruksi; pengguna tidak perlu
  // mengetik ulang isi lama untuk mengosongkan instruksi.
  const [mode, setMode] = useState<ModeInstruksi>(tanpaInstruksi(awal.isi_disposisi) ? "tanpa" : "isi");
  const [nilai, setNilai] = useState<Nilai>({
    surat_id: suratId,
    id: disposisiId,
    tanggal_disposisi: awal.tanggal_disposisi,
    pemberi_disposisi: awal.pemberi_disposisi,
    pemberi_lain: "",
    penerima_disposisi: awal.penerima_disposisi,
    penerima_lain: "",
    tanggal_diteruskan: awal.tanggal_diteruskan,
    isi_disposisi: awal.isi_disposisi,
    catatan: awal.catatan,
    status_tindak_lanjut: awal.status_tindak_lanjut,
  });

  function ubah(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setNilai((n) => ({ ...n, [e.target.name]: e.target.value }));
  }

  const pemberiLain = nilai.pemberi_disposisi === lain;
  const penerimaLain = nilai.penerima_disposisi === lain;
  const akanDiteruskan = nilai.penerima_disposisi !== "";

  return (
    <Card variant="inset">
      <CardHeader>
        <CardTitle>Ubah disposisi</CardTitle>
        <CardDescription>
          Mengoreksi langkah yang sudah dicatat. Nama di luar daftar pejabat atau tujuan bisa dipilih lewat
          "Lainnya (ketik manual)". Setiap perubahan tercatat di jejak perubahan data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="w-full max-w-[760px]">
          <input type="hidden" name="surat_id" value={suratId} />
          <input type="hidden" name="id" value={disposisiId} />
          {/* Dua kolom hanya bila ruang kontennya cukup (lihat catatan di DisposisiForm). */}
          <FieldGroup className="grid gap-4 @3xl/main:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="edit_tanggal_disposisi">Tanggal disposisi</FieldLabel>
              <Input
                id="edit_tanggal_disposisi"
                name="tanggal_disposisi"
                type="date"
                required
                value={nilai.tanggal_disposisi}
                onChange={ubah}
              />
            </Field>
            <Field style={{ minWidth: lebarOpsiMin(["Pilih pejabat", ...pejabat, "Lainnya (ketik manual)"]) }}>
              <FieldLabel htmlFor="edit_pemberi_disposisi">Pemberi disposisi</FieldLabel>
              <NativeSelect
                id="edit_pemberi_disposisi"
                name="pemberi_disposisi"
                className="w-full"
                required
                value={nilai.pemberi_disposisi}
                onChange={ubah}
              >
                {pejabat.map((n) => (
                  <NativeSelectOption key={n} value={n}>
                    {n}
                  </NativeSelectOption>
                ))}
                <NativeSelectOption value={lain}>Lainnya (ketik manual)</NativeSelectOption>
              </NativeSelect>
              {pemberiLain ? (
                <Input
                  name="pemberi_lain"
                  required
                  aria-label="Nama pemberi disposisi lainnya"
                  value={nilai.pemberi_lain}
                  onChange={ubah}
                  placeholder="Nama di luar daftar pejabat"
                />
              ) : null}
            </Field>
            <Field style={{ minWidth: lebarOpsiMin(["Belum diteruskan", ...terusan, "Lainnya (ketik manual)"]) }}>
              <FieldLabel htmlFor="edit_penerima_disposisi">Diteruskan ke</FieldLabel>
              <NativeSelect
                id="edit_penerima_disposisi"
                name="penerima_disposisi"
                className="w-full"
                value={nilai.penerima_disposisi}
                onChange={ubah}
              >
                <NativeSelectOption value="">Belum diteruskan</NativeSelectOption>
                {terusan.map((n) => (
                  <NativeSelectOption key={n} value={n}>
                    {n}
                  </NativeSelectOption>
                ))}
                <NativeSelectOption value={lain}>Lainnya (ketik manual)</NativeSelectOption>
              </NativeSelect>
              {penerimaLain ? (
                <Input
                  name="penerima_lain"
                  required
                  aria-label="Nama tujuan diteruskan lainnya"
                  value={nilai.penerima_lain}
                  onChange={ubah}
                  placeholder="Subid atau orang di luar daftar"
                />
              ) : null}
            </Field>
            {akanDiteruskan ? (
              <Field>
                <FieldLabel htmlFor="edit_tanggal_diteruskan">Tanggal diteruskan</FieldLabel>
                <Input
                  id="edit_tanggal_diteruskan"
                  name="tanggal_diteruskan"
                  type="date"
                  value={nilai.tanggal_diteruskan}
                  onChange={ubah}
                />
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="edit_status_tindak_lanjut">Tindak lanjut</FieldLabel>
              <NativeSelect
                id="edit_status_tindak_lanjut"
                name="status_tindak_lanjut"
                className="w-full"
                value={nilai.status_tindak_lanjut}
                onChange={ubah}
              >
                {Object.entries(labelTindakLanjut).map(([kode, label]) => (
                  <NativeSelectOption key={kode} value={kode}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field className="sm:col-span-2">
              <PilihInstruksi
                mode={mode}
                onMode={setMode}
                idIsi="edit_isi_disposisi"
                namaIsi="isi_disposisi"
                nilaiIsi={nilai.isi_disposisi}
                onChange={ubah}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="edit_catatan">Catatan tambahan (opsional)</FieldLabel>
              <Textarea id="edit_catatan" name="catatan" rows={2} value={nilai.catatan} onChange={ubah} />
            </Field>

            {state.error ? (
              <Alert variant="destructive" className="sm:col-span-2">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
                Simpan perubahan
              </Button>
              <Button variant="outline" asChild>
                <Link href={batalHref}>
                  <XIcon data-icon="inline-start" />
                  Batal
                </Link>
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
