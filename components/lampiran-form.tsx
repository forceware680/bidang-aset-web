"use client";

import { useState } from "react";
import { UploadIcon } from "lucide-react";
import { AksiForm } from "@/components/aksi-form";
import { unggahLampiran } from "@/lib/actions/lampiran";
import { BATAS_LAMPIRAN, ukuranFile } from "@/lib/format";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Hasil } from "@/lib/hasil";

/**
 * Unggah lampiran untuk surat masuk maupun surat keluar: hanya aksi dan label yang berbeda,
 * batas jenis/ukuran diperiksa di browser dan lagi di server.
 */
export function LampiranForm({
  suratId,
  aksi = unggahLampiran,
  label = "Scan surat atau lampiran",
}: {
  suratId: string;
  aksi?: (form: FormData) => Promise<Hasil>;
  label?: string;
}) {
  const [pilih, setPilih] = useState<{ nama: string; size: number } | null>(null);
  // Pemeriksaan ukuran di browser mencegah pengiriman yang pasti ditolak server.
  const terlalubesar = pilih !== null && pilih.size > BATAS_LAMPIRAN;

  return (
    <AksiForm aksi={aksi} className="w-full">
      <input type="hidden" name="surat_id" value={suratId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="file">{label}</FieldLabel>
          <Input
            id="file"
            name="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPilih(f ? { nama: f.name, size: f.size } : null);
            }}
          />
          <FieldDescription>PDF, JPG, atau PNG sampai 20 MB. Jenis dan ukuran diperiksa ulang sebelum berkas disimpan.</FieldDescription>
        </Field>

        {pilih && terlalubesar ? (
          <Alert variant="destructive">
            <AlertDescription>
              Berkas {pilih.nama} berukuran {ukuranFile(pilih.size)}, melebihi batas 20 MB. Berkas tidak dikirim.
            </AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" disabled={pilih !== null && terlalubesar}>
          <UploadIcon data-icon="inline-start" />
          Unggah lampiran
        </Button>
      </FieldGroup>
    </AksiForm>
  );
}
