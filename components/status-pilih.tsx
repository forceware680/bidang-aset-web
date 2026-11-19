"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/ui/toast";
import { cn } from "cn";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tint } from "@/lib/status";
import { gunakanPenyegar } from "@/lib/pemberitahuan-client";

type Opsi = { kode: string; label: string };

/// Aksi server yang menerima FormData dan mengembalikan Hasil (ok + pesan).
type Aksi = (form: FormData) => Promise<{ ok: boolean; pesan?: string }>;

/**
 * Pengubah status dengan Select shadcn: pilihan langsung disimpan saat item dipilih — tidak ada tombol
 * simpan. Pilihan baru kelihatan seketika (tint ikut berubah); kalau server menolak, pilihan kembali ke
 * nilai lama dan penolakan menjadi toast. `tambahan` adalah isian yang aksi server butuhkan (id agenda,
 * surat_id, filter yang sedang aktif).
 */
export function StatusPilih({
  aksi,
  nama,
  nilai,
  opsi,
  id,
  label,
  bertint,
  disabled,
  dataAksi,
  tambahan,
  pesanSukses,
  kelas,
}: {
  aksi: Aksi;
  nama: string;
  nilai: string;
  opsi: Opsi[];
  id?: string;
  label?: string;
  /// Warna mengikuti status (tint dari lib/status). Fungsi tint tidak bisa lewat sebagai prop ke
  /// komponen client, jadi flag ini yang dikirim.
  bertint?: boolean;
  disabled?: boolean;
  dataAksi?: string;
  tambahan?: Record<string, string>;
  pesanSukses?: string;
  kelas?: string;
}) {
  const segar = gunakanPenyegar();
  const [kode, setKode] = useState(nilai);
  const [mengirim, setMengirim] = useState(false);
  // Nilai dari server (perubahan realtime dari akun lain, monitor, atau Android) menyelaraskan pilihan lokal.
  useEffect(() => setKode(nilai), [nilai]);

  async function pilih(nilaiBaru: string) {
    if (mengirim || nilaiBaru === kode) return;
    const lama = kode;
    setKode(nilaiBaru);
    setMengirim(true);
    const form = new FormData();
    form.set(nama, nilaiBaru);
    for (const [k, v] of Object.entries(tambahan ?? {})) form.set(k, v);
    const hasil = await aksi(form);
    setMengirim(false);
    if (hasil.ok) {
      toast(hasil.pesan ?? pesanSukses ?? "Status diperbarui.");
      segar();
    } else {
      setKode(lama);
      toast.galat(hasil.pesan ?? "Status tidak bisa disimpan.");
    }
  }

  return (
    <Select value={kode} disabled={disabled || mengirim} onValueChange={(v) => void pilih(v)}>
      {/* Trigger-nya anak langsung dari ButtonGroup: dulu dibungkus div, jadi aturan "sambungkan tepi"
        ButtonGroup tidak sampai ke trigger dan pil status terlihat terpisah dari tombol ikonnya. */}
      <SelectTrigger
        id={id}
        data-aksi={dataAksi}
        data-mengirim={mengirim ? "" : undefined}
        className={cn("relative w-fit data-[size=default]:h-11 md:data-[size=default]:h-8", bertint ? tint(kode) : "", kelas)}
        aria-label={label ?? `Status ${nama}`}
        aria-busy={mengirim}
      >
        <SelectValue />
        {mengirim ? <Spinner className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground" /> : null}
      </SelectTrigger>
      <SelectContent position="popper" align="start" side="bottom">
        {opsi.map((o) => (
          <SelectItem key={o.kode} value={o.kode}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
