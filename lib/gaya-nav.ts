import { cn } from "cn";

/**
 * Pil hitungan di navigator surat (bilah langkah dan daftar bagian). Pil selalu tanpa garis: di luar
 * bagian aktif latarnya lembut (`bg-muted` di mode terang, `bg-input/30` di mode gelap), di bagian aktif
 * pil krem di atas isi primary supaya angkanya tetap terbaca.
 */
export function pilJumlahKelas(aktif: boolean): string {
  return cn(
    "num rounded-full border-0 px-1.5 py-0.5 text-xs leading-none",
    aktif ? "bg-primary-foreground text-primary" : "bg-counter text-counter-foreground",
  );
}
