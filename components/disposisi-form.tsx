"use client";

import { useEffect, useActionState, useState } from "react";
import { gunakanPenyegar, aksiTundaPemberitahuan } from "@/lib/pemberitahuan-client";
import { toast } from "@/components/ui/toast";
import { SaveIcon } from "lucide-react";
import { tambahDisposisi, type DisposisiState } from "@/lib/actions/disposisi";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { PilihInstruksi, type ModeInstruksi } from "@/components/pilih-instruksi";
import { lebarOpsiMin } from "@/lib/format";

type Nilai = { [k: string]: string };

/** Nilai dropdown yang berarti "ketik nama sendiri". */
const lain = "__lain__";

export function DisposisiForm({ suratId, pejabat, terusan }: { suratId: string; pejabat: string[]; terusan: string[] }) {
  const segar = gunakanPenyegar();
  const [state, action, pending] = useActionState<DisposisiState, FormData>(aksiTundaPemberitahuan(tambahDisposisi), {});

  // Sukses: toast, riwayat diperbarui di tempat, dan isian dikosongkan untuk disposisi berikutnya.
  useEffect(() => {
    if (state.ok) {
      toast(state.ok);
      setNilai((n) => ({ ...n, isi_disposisi: "", catatan: "", penerima_disposisi: "", penerima_lain: "", tanggal_diteruskan: "" }));
      segar();
    }
  }, [state.ok, segar]);
  // Isian ditahan di client agar validasi server tidak menghapus catatan yang sudah diketik.
  // Pilihan instruksi: "Tanpa Instruksi" menyimpan strip "-", "Instruksi" menampilkan isian teks.
  const [mode, setMode] = useState<ModeInstruksi>("isi");
  const [nilai, setNilai] = useState<Nilai>({
    surat_id: suratId,
    tanggal_disposisi: "",
    pemberi_disposisi: "",
    pemberi_lain: "",
    penerima_disposisi: "",
    penerima_lain: "",
    tanggal_diteruskan: "",
    isi_disposisi: "",
    catatan: "",
  });

  function ubah(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setNilai((n) => ({ ...n, [e.target.name]: e.target.value }));
  }

  const pemberiLain = nilai.pemberi_disposisi === lain;
  const penerimaLain = nilai.penerima_disposisi === lain;
  const akanDiteruskan = nilai.penerima_disposisi !== "";

  return (
    <Card className="mt-4" variant="inset">
      <CardHeader>
        <CardTitle>Tambah disposisi</CardTitle>
        <CardDescription>
          Surat bisa di-disposisi berantai. Setelah disposisi terakhir, surat diteruskan ke subid atau orang tertentu —
          tujuan dan tanggal penerusannya diisi di sini.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="w-full max-w-[760px]">
          <input type="hidden" name="surat_id" value={suratId} />
          {/* Dua kolom hanya bila ruang kontennya memang cukup; di 1024px dengan sidebar ruang
              ~688px dan dua kolom membuat dropdown tujuan lebih sempit daripada opsi terpanjangnya. */}
          <FieldGroup className="grid gap-4 @3xl/main:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="tanggal_disposisi">Tanggal disposisi</FieldLabel>
              <Input
                id="tanggal_disposisi"
                name="tanggal_disposisi"
                type="date"
                required
                value={nilai.tanggal_disposisi}
                onChange={ubah}
              />
            </Field>
            <Field style={{ minWidth: lebarOpsiMin(["Pilih pejabat", ...pejabat, "Lainnya (ketik manual)"]) }}>
              <FieldLabel htmlFor="pemberi_disposisi">Pemberi disposisi</FieldLabel>
              <NativeSelect
                id="pemberi_disposisi"
                name="pemberi_disposisi"
                className="w-full"
                required
                value={nilai.pemberi_disposisi}
                onChange={ubah}
              >
                <NativeSelectOption value="">Pilih pejabat</NativeSelectOption>
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
              <FieldLabel htmlFor="penerima_disposisi">Diteruskan ke</FieldLabel>
              <NativeSelect
                id="penerima_disposisi"
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
                <FieldLabel htmlFor="tanggal_diteruskan">Tanggal diteruskan</FieldLabel>
                <Input
                  id="tanggal_diteruskan"
                  name="tanggal_diteruskan"
                  type="date"
                  value={nilai.tanggal_diteruskan}
                  onChange={ubah}
                />
              </Field>
            ) : null}
            <Field className="sm:col-span-2">
              <PilihInstruksi
                mode={mode}
                onMode={setMode}
                idIsi="isi_disposisi"
                namaIsi="isi_disposisi"
                nilaiIsi={nilai.isi_disposisi}
                onChange={ubah}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="catatan">Catatan tambahan (opsional)</FieldLabel>
              <Textarea id="catatan" name="catatan" rows={2} value={nilai.catatan} onChange={ubah} />
            </Field>

            {state.error ? (
              <Alert variant="destructive" className="sm:col-span-2">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex items-center gap-2 sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
                Simpan disposisi
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
