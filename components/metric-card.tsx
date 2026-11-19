import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Nada bukan arah: angka naik bisa berarti pekerjaan bertambah (buruk) atau selesai bertambah (baik). */
type Nada = "baik" | "buruk" | "netral";

export type Delta = { arah: "naik" | "turun" | "tetap"; teks: string; nada: Nada };

/** Metrik: label kecil diredakan, angka jadi focal (30px/600 tabular), delta satu chip accent. */
export function MetricCard({ label, nilai, delta, catatan }: { label: string; nilai: string; delta?: Delta | null; catatan?: string }) {
  const kelasChip =
    delta?.nada === "baik" ? "bg-success/10 text-success" : delta?.nada === "buruk" ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground";
  return (
    <Card>
      <CardContent>
        <p data-slot="metric-label" className="text-xs font-medium text-muted-foreground">{label}</p>
        <p data-slot="metric-nilai" className="num mt-1.5 text-3xl leading-none font-semibold tracking-tight">{nilai}</p>
        {delta ? (
          <p className={`metrik-chip mt-2.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium whitespace-nowrap [&_svg]:size-3 ${kelasChip}`}>
            {delta.arah === "naik" ? <ArrowUpIcon /> : delta.arah === "turun" ? <ArrowDownIcon /> : <MinusIcon />}
            {delta.teks}
          </p>
        ) : catatan ? (
          <p className="mt-2 text-sm text-muted-foreground">{catatan}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Selisih periode berjalan dengan periode sebelumnya; nada ditentukan pemanggil, bukan arah angka. */
export function deltaSekarang(sekarang: number, sebelumnya: number | null, acuan: string, nadaNaik: Nada): Delta | null {
  if (sebelumnya === null) return null;
  const selisih = sekarang - sebelumnya;
  if (selisih === 0) return { arah: "tetap", teks: `Sama dengan ${acuan}`, nada: "netral" };
  return {
    arah: selisih > 0 ? "naik" : "turun",
    teks: `${selisih > 0 ? "+" : "−"}${Math.abs(selisih)} dari ${acuan}`,
    nada: selisih > 0 ? nadaNaik : nadaNaik === "buruk" ? "baik" : nadaNaik === "baik" ? "buruk" : "netral",
  };
}
