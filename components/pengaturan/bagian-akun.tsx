"use client";

import { useState } from "react";
import { PencilIcon, SaveIcon, XIcon } from "lucide-react";
import { AksiForm } from "@/components/aksi-form";
import { AksiIkon } from "@/components/aksi-ikon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tanggalJamText } from "@/lib/format";
import type { Hasil } from "@/lib/hasil";

type Pengguna = { id: string; name: string; email: string; role: string; is_active: boolean; created_at: Date };
type Peran = { id: string; name: string };

function tombolKirim(ikon: React.ReactNode, label: string, className?: string) {
  return (
    <Button type="submit" className={className}>
      {ikon}
      {label}
    </Button>
  );
}

/**
 * Akun pengguna: daftar akun. Pembuatan akun lewat DialogTambah di header (desktop) / pil melayang
 * (HP); perubahan peran/status satu akun dibuka di baris itu, di layar kecil di dalam baris,
 * di desktop di bawah tabel.
 */
export function BagianAkun({
  bolehUbah,
  peran,
  pengguna,
  ubahPengguna,
}: {
  bolehUbah: boolean;
  peran: Peran[];
  pengguna: Pengguna[];
  ubahPengguna: (form: FormData) => Promise<Hasil>;
}) {
  // Menandai akun yang sedang diubah supaya nilai peran/status mengikuti akun itu, bukan default.
  const [ubahId, setUbahId] = useState<string | null>(null);
  const akunUbah = ubahId ? pengguna.find((u) => u.id === ubahId) : undefined;

  function formUbahAkun(u: Pengguna, kecil = false) {
    const idPeran = kecil ? "pengguna_peran_kecil" : "pengguna_peran";
    const idStatus = kecil ? "pengguna_aktif_kecil" : "pengguna_aktif";
    return (
      <AksiForm aksi={ubahPengguna} padaSukses={() => setUbahId(null)} className="rounded-xl border border-(--border)/50 bg-input/10 p-4">
        <input type="hidden" name="id" value={u.id} />
        <FieldGroup className="flex flex-row flex-wrap items-end gap-3">
          <div className="basis-full">
            <p className="text-sm font-medium">
              Mengubah <span className="text-foreground">{u.name}</span>
            </p>
            <p className="num text-xs text-muted-foreground">
              Saat ini: peran {u.role}, status {u.is_active ? "Aktif" : "Nonaktif"} — {u.email}
            </p>
          </div>
          <Field className="min-w-[13rem] flex-1">
            <FieldLabel htmlFor={idPeran}>Peran baru</FieldLabel>
            <NativeSelect id={idPeran} name="role" className="w-full min-w-[13rem]" defaultValue={u.role}>
              {peran.map((r) => (
                <NativeSelectOption key={r.id} value={r.name}>
                  {r.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field className="min-w-[11rem] flex-1">
            <FieldLabel htmlFor={idStatus}>Status baru</FieldLabel>
            <NativeSelect id={idStatus} name="is_active" className="w-full min-w-[11rem]" defaultValue={u.is_active ? "1" : "0"}>
              <NativeSelectOption value="1">Aktif</NativeSelectOption>
              <NativeSelectOption value="0">Nonaktif</NativeSelectOption>
            </NativeSelect>
          </Field>
          <div className="flex gap-2 basis-full self-end">
            {tombolKirim(<SaveIcon data-icon="inline-start" />, "Simpan perubahan akun")}
            <Button type="button" variant="outline" onClick={() => setUbahId(null)}>
              Batal
            </Button>
          </div>
        </FieldGroup>
      </AksiForm>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card aria-labelledby="daftar-akun">
        <CardHeader>
          <CardTitle id="daftar-akun" className="flex flex-wrap items-center gap-2">
            Daftar akun
            <Badge variant="secondary" className="num">{pengguna.filter((u) => u.is_active).length} aktif dari {pengguna.length}</Badge>
          </CardTitle>
          <CardDescription>Peran menentukan hak menulis. Akun nonaktif tidak bisa masuk.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Layar kecil: enam kolom tabel tidak muat di 390px, jadi akun ditumpuk per baris. */}
          <div className="flex flex-col gap-2 md:hidden">
            {pengguna.map((u) => (
              <div
                key={u.id}
                className={`rounded-xl border p-3 ${ubahId === u.id ? "border-(--border) bg-input/10" : "border-(--border)/50"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{u.name}</p>
                    <p className="num break-words text-sm text-muted-foreground">{u.email}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{u.role}</span>
                      <Badge variant={u.is_active ? "success" : "secondary"}>{u.is_active ? "Aktif" : "Nonaktif"}</Badge>
                    </p>
                    <p className="num mt-1 text-xs text-muted-foreground">Dibuat {tanggalJamText(u.created_at)}</p>
                  </div>
                  {bolehUbah ? (
                    <AksiIkon
                      label={ubahId === u.id ? `Tutup perubahan ${u.name} di daftar ringkas` : `Ubah ${u.name} di daftar ringkas`}
                      teks={ubahId === u.id ? "Tutup" : "Ubah"}
                      type="button"
                      onClick={() => setUbahId(ubahId === u.id ? null : u.id)}
                    >
                      {ubahId === u.id ? <XIcon /> : <PencilIcon />}
                    </AksiIkon>
                  ) : null}
                </div>
                {bolehUbah && ubahId === u.id ? formUbahAkun(u, true) : null}
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Peran</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dibuat</TableHead>
                  {bolehUbah ? <TableHead className="text-right">Aksi</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pengguna.map((u) => (
                  <TableRow key={u.id} data-state={ubahId === u.id ? "selected" : undefined}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="num text-sm">{u.email}</TableCell>
                    <TableCell className="font-medium">{u.role}</TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? "success" : "secondary"}>{u.is_active ? "Aktif" : "Nonaktif"}</Badge>
                    </TableCell>
                    <TableCell className="num whitespace-nowrap text-sm">{tanggalJamText(u.created_at)}</TableCell>
                    {bolehUbah ? (
                      <TableCell className="text-right">
                        <AksiIkon
                          label={ubahId === u.id ? `Tutup perubahan ${u.name}` : `Ubah peran dan status ${u.name}`}
                          type="button"
                          onClick={() => setUbahId(ubahId === u.id ? null : u.id)}
                        >
                          {ubahId === u.id ? <XIcon /> : <PencilIcon />}
                        </AksiIkon>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {bolehUbah && akunUbah ? <div className="hidden md:block">{formUbahAkun(akunUbah)}</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
