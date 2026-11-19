"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { cn } from "cn";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/**
 * Grafik donut komposisi kategori surat. Angka dan persentase ditulis di legend, bukan hanya warna.
 * `lebarKelas`/`kelasLegend` dipakai layar monitor supaya legend terbaca dari jarak jauh.
 */
export function StatPieChart({
  slices,
  total,
  judul,
  lebarKelas = "max-w-[220px]",
  kelasLegend = "text-sm",
  susun = "menumpuk",
  kelasAngka = "text-xl",
}: {
  slices: { nama: string; jumlah: number; warna: string }[];
  total: number;
  judul: string;
  lebarKelas?: string;
  kelasLegend?: string;
  /** "menumpuk" (donut di atas legend, dipakai Rekap) atau "sebelah" (donut kiri, legend kanan, dipakai layar monitor). */
  susun?: "menumpuk" | "sebelah";
  kelasAngka?: string;
}) {
  // Donut SVG buatan sendiri: geometri pasti (recharts Pie punya ukuran dari ResizeObserver yang
  // bisa meleset), tanpa label lengkung — nama, jumlah, dan persentase ditulis di legend bawah.
  const besar = 52;
  const dalam = 32;
  let sudut = -90;
  const sektor = slices.map((s) => {
    if (total === 0) return null;
    const sudutSlice = (s.jumlah / total) * 360;
    const mulai = sudut;
    const akhir = sudut + sudutSlice;
    sudut = akhir;
    const titik = (derajat: number, radius: number) => {
      const rad = (derajat * Math.PI) / 180;
      // Dibulatkan: hasil cos/sin sedikit berbeda antara Node (SSR) dan browser (CSR), dan tanpa
      // pembulatan React menganggap atribut `d` tidak cocok saat hydration.
      return [
        Number((60 + radius * Math.cos(rad)).toFixed(3)),
        Number((60 + radius * Math.sin(rad)).toFixed(3)),
      ] as const;
    };
    // Satu jenis saja (atau satu jenis menguasai seluruh periode): sudut awal = sudut akhir,
    // arc kehilangan panjang dan tidak ter-render, jadi digambar sebagai cincin penuh.
    if (sudutSlice >= 359.999) {
      return { nama: s.nama, warna: s.warna, jumlah: s.jumlah, cincin: true as const, path: "" };
    }
    const [x1, y1] = titik(mulai, besar);
    const [x2, y2] = titik(akhir, besar);
    const [x3, y3] = titik(akhir, dalam);
    const [x4, y4] = titik(mulai, dalam);
    const busurBesar = sudutSlice > 180 ? 1 : 0;
    return {
      nama: s.nama,
      warna: s.warna,
      jumlah: s.jumlah,
      cincin: false as const,
      path: `M ${x1} ${y1} A ${besar} ${besar} 0 ${busurBesar} 1 ${x2} ${y2} L ${x3} ${y3} A ${dalam} ${dalam} 0 ${busurBesar} 0 ${x4} ${y4} Z`,
    };
  }).filter((s): s is NonNullable<typeof s> => s !== null);

  return (
    <div className={susun === "sebelah" ? "flex min-h-0 flex-1 items-center gap-6" : "flex flex-col gap-3"}>
      <div className={cn("relative", susun === "sebelah" ? "aspect-square h-full max-h-[220px] shrink-0" : "mx-auto w-full", susun === "sebelah" ? "" : lebarKelas)}>
        <svg viewBox="0 0 120 120" role="img" aria-label={judul} className="block h-full w-full">
          {sektor.map((s) =>
            s.cincin ? (
              <circle key={s.nama} cx="60" cy="60" r={(besar + dalam) / 2} fill="none" stroke={s.warna} strokeWidth={besar - dalam}>
                <title>{`${s.nama}: ${s.jumlah} surat`}</title>
              </circle>
            ) : (
              <path key={s.nama} d={s.path} fill={s.warna} stroke="var(--card)" strokeWidth="0.6">
                <title>{`${s.nama}: ${s.jumlah} surat`}</title>
              </path>
            ),
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center leading-tight">
            <span className={cn("num font-semibold", kelasAngka)}>{total}</span>
            <span className="block text-xs text-muted-foreground">surat</span>
          </div>
        </div>
      </div>
      <ul
        className={cn(
          "gap-1.5",
          susun === "sebelah"
            ? "grid min-w-0 flex-1 grid-cols-[repeat(auto-fit,minmax(min(11rem,100%),1fr))] gap-x-4"
            : "flex flex-col",
          kelasLegend,
        )}
      >
        {slices.map((s) => (
          <li key={s.nama} className={cn("min-w-0", susun === "sebelah" ? "flex items-center gap-2 2xl:flex-col 2xl:items-start 2xl:gap-0.5" : "flex items-center gap-2")}>
            <span className="flex w-full min-w-0 flex-1 items-center gap-2">
              <span className="size-3 shrink-0 rounded-sm" style={{ background: s.warna }} aria-hidden="true" />
              <span className="truncate">{s.nama}</span>
            </span>
            <span
              className={cn("num shrink-0 text-muted-foreground", susun === "sebelah" ? "ml-auto 2xl:ml-0 2xl:pl-5 2xl:text-[13px]" : "ml-auto")}
            >
              {s.jumlah} surat · {total === 0 ? 0 : Math.round((s.jumlah / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Grafik batang dari data database. Batang memakai token chart-N, angka tetap tersedia lewat tooltip.
 * `tinggiKelas`/`ukuranTick` dipakai layar monitor (1920×1080 dari jarak ~3 m): sumbu dan batang lebih besar.
 */
export function StatBarChart({
  config,
  data,
  judul,
  tinggiKelas = "h-[220px] w-full",
  ukuranTick = 12,
  lebarBatangMaks = 56,
  kisi = "mendatar",
  celahBatang,
  celahKategori,
}: {
  config: ChartConfig;
  data: Record<string, string | number>[];
  judul: string;
  tinggiKelas?: string;
  ukuranTick?: number;
  /** Batang dibatasi supaya bulan yang sedikit data tidak jadi blok lebar; banyak bulan tetap proporsional. */
  lebarBatangMaks?: number;
  /** "mendatar" saja (Rekap) atau "kedua arah" (layar monitor): kisi vertikal membuat dua belas bulan terbaca sebagai kolom walaupun baru sedikit bulan yang ada datanya. */
  kisi?: "mendatar" | "kedua arah";
  /** Jarak antar batang dalam satu bulan. 0 membuat dua seri (dijadwalkan/dilaksanakan) jadi satu blok selebar batang grafik lain. */
  celahBatang?: number | string;
  /** Jarak antar bulan; disamakan antar grafik supaya lebar batang di semua panel sama. */
  celahKategori?: number | string;
}) {
  return (
    <ChartContainer config={config} className={tinggiKelas} role="img" aria-label={judul}>
      <BarChart data={data} barGap={celahBatang} barCategoryGap={celahKategori}>
        <CartesianGrid vertical={kisi === "kedua arah"} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} type="category" tick={{ fontSize: ukuranTick }} />
        <YAxis tickLine={false} axisLine={false} width={ukuranTick > 12 ? 48 : 36} allowDecimals={false} tick={{ fontSize: ukuranTick }} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        {Object.keys(config).map((key) => (
          <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={4} maxBarSize={lebarBatangMaks} />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
