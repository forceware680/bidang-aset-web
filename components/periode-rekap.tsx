"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Pilihan tahun rekap memakai Select shadcn: periode langsung berlaku saat tahun dipilih (URL
 * `?tahun=` di-push), tidak ada tombol "Terapkan periode" lagi. Trigger dibuat sebagai tile lembut
 * (isian muted, tanpa garis) supaya satu gaya dengan tombol Ekspor/Cetak di bawahnya.
 */
export function PilihTahunRekap({ tahun, daftar }: { tahun: string; daftar: string[] }) {
  const router = useRouter();
  return (
    <Select value={tahun} onValueChange={(t) => router.push(`/rekap?tahun=${t}`)}>
      <SelectTrigger
        id="tahun"
        aria-label="Tahun rekap"
        className="num w-[7.5rem] rounded-2xl border-0 bg-muted text-foreground hover:bg-muted/70 aria-expanded:bg-muted/70 dark:bg-input/30 dark:text-foreground dark:hover:bg-input/45 dark:aria-expanded:bg-input/45 data-[size=default]:h-11 md:data-[size=default]:h-8"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start" side="bottom">
        {daftar.map((t) => (
          <SelectItem key={t} value={t} className="num">
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
