"use client";

import { SaveIcon } from "lucide-react";
import { AksiForm } from "@/components/aksi-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { catatAgendaSurat } from "@/lib/actions/rapat";

function Wajib() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}

/**
 * Agenda untuk surat yang sudah tersimpan dan ditandai sebagai undangan rapat tapi belum punya agenda.
 * Isian tanggal-jam diberi lebar penuh sendiri: lebar bawaan isian itu membuat dua kolom saling
 * menumpang di 640px dan 768px, jadi kolom baru dibagi dua sampai 1024px.
 */
export function RapatSuratForm({ suratId }: { suratId: string }) {
  return (
    <Card variant="inset" size="sm" aria-labelledby={`agenda-baru-${suratId}`}>
      <CardHeader>
        <CardTitle id={`agenda-baru-${suratId}`}>Agenda untuk surat ini</CardTitle>
        <CardDescription>Agenda masuk ke kalender dan waktunya bisa digeser setelah tersimpan.</CardDescription>
      </CardHeader>
      <AksiForm aksi={catatAgendaSurat} className="flex flex-col gap-(--card-spacing)">
        <input type="hidden" name="surat_id" value={suratId} />
        <CardContent>
          <FieldGroup className="grid gap-4 lg:grid-cols-2">
            <Field className="lg:col-span-2">
              <FieldLabel htmlFor={`agenda-${suratId}`}>
                Judul agenda <Wajib />
              </FieldLabel>
              <Input
                id={`agenda-${suratId}`}
                name="agenda_rapat"
                aria-required={true}
                maxLength={300}
                placeholder="Rapat koordinasi pengelolaan aset"
              />
            </Field>
            <Field className="lg:col-span-2">
              <FieldLabel htmlFor={`mulai-${suratId}`}>
                Waktu mulai <Wajib />
              </FieldLabel>
              <Input className="num" id={`mulai-${suratId}`} name="tanggal_mulai" type="datetime-local" aria-required={true} />
            </Field>
            <Field className="lg:col-span-2">
              <FieldLabel htmlFor={`selesai-${suratId}`}>Waktu selesai</FieldLabel>
              <Input className="num" id={`selesai-${suratId}`} name="tanggal_selesai" type="datetime-local" />
              <FieldDescription>Boleh dikosongkan bila agenda belum punya batas waktu.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`tempat-${suratId}`}>Tempat</FieldLabel>
              <Input id={`tempat-${suratId}`} name="tempat" maxLength={300} placeholder="Ruang Rapat A" />
            </Field>
            <Field>
              <FieldLabel htmlFor={`penyelenggara-${suratId}`}>Penyelenggara</FieldLabel>
              <Input id={`penyelenggara-${suratId}`} name="penyelenggara" maxLength={200} placeholder="BPKAD Bidang Aset" />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="border-t">
          <Button type="submit">
            <SaveIcon data-icon="inline-start" />
            Simpan agenda
          </Button>
        </CardFooter>
      </AksiForm>
    </Card>
  );
}
