"use client";

import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export type ModeInstruksi = "tanpa" | "isi";

const pil =
  "inline-flex items-center gap-2 rounded-full border border-(--input) bg-muted px-3 py-1.5 text-sm font-medium text-foreground transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/12 has-[:checked]:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/60";

/**
 * Pilihan instruksi disposisi. "Tanpa Instruksi" berarti langkah ini dicatat tanpa isi — kolom
 * `isi_disposisi` NOT NULL di database diisi strip "-". "Instruksi" menampilkan isian teks.
 * Data yang sudah tercatat tidak diubah: nilai "-" dan nilai kosong dibaca sebagai tanpa instruksi.
 */
export function PilihInstruksi({
  mode,
  onMode,
  idIsi,
  namaIsi,
  nilaiIsi,
  onChange,
}: {
  mode: ModeInstruksi;
  onMode: (mode: ModeInstruksi) => void;
  idIsi: string;
  namaIsi: string;
  nilaiIsi: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="grid gap-2">
      <div role="radiogroup" aria-label="Instruksi disposisi" className="flex flex-wrap gap-2">
        <label data-slot="pilih-instruksi" className={pil}>
          <input type="radio" name="instruksi" value="tanpa" checked={mode === "tanpa"} onChange={() => onMode("tanpa")} className="sr-only" />
          Tanpa Instruksi
        </label>
        <label data-slot="pilih-instruksi" className={pil}>
          <input type="radio" name="instruksi" value="isi" checked={mode === "isi"} onChange={() => onMode("isi")} className="sr-only" />
          Instruksi
        </label>
      </div>
      {mode === "isi" ? (
        <Field>
          <FieldLabel htmlFor={idIsi}>Isi instruksi</FieldLabel>
          <Textarea id={idIsi} name={namaIsi} rows={3} required value={nilaiIsi} onChange={onChange} />
        </Field>
      ) : null}
    </div>
  );
}
