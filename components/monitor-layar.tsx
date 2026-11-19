"use client";

import { useCallback, useEffect, useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { PauseIcon, PlayIcon } from "lucide-react";
import { cn } from "cn";
import { DotPattern } from "@/components/ui/dot-pattern";
import { StatBarChart, StatPieChart } from "@/components/stat-chart";
import { gunakanTersambung } from "@/lib/pemberitahuan-client";
import type { ChartConfig } from "@/components/ui/chart";

/**
 * Layar monitor yang dipasang di depan ruangan Bidang Aset. Layar ini tidak punya tombol untuk bekerja:
 * isinya berganti sendiri antara agenda, statistik, dan grafik. Seorang pengunjung yang ingin membaca
 * bisa menjeda — klik di mana saja pada layar, tekan Spasi, atau tombol Jeda difooter — dan lanjut lagi.
 *
 * Semua waktu dibaca di Asia/Jakarta oleh browser layar (bukan jam server), supaya jam di layar sama dengan
 * jam orang di ruangan.
 */

export type AgendaBaris = {
  id: string;
  mulai: string;
  selesai: string | null;
  agenda: string;
  tempat: string | null;
  penyelenggara: string | null;
  pemberi: string | null;
  nomor: string | null;
  peserta: string | null;
  status: string;
};

export type AgendaKelompok = { tanggal: string; baris: AgendaBaris[] };

export type StatistikLayar = {
  masuk: number;
  keluar: number;
  keluarBelumDikirim: number;
  belumDidisposisikan: number;
  disposisiBelumSelesai: number;
  agendaHariIni: number;
  rapatBulanIni: number;
};

export type GrafikLayar = {
  tahun: number;
  masuk: { label: string; surat: number }[];
  keluar: { label: string; keluar: number }[];
  rapat: { label: string; total: number }[];
  jenis: { nama: string; jumlah: number; warna: string }[];
  totalJenis: number;
};

const ZONA = "Asia/Jakarta";
// Jam ditulis dengan titik dua (bukan titik seperti locale id-ID): layar harus mudah dibaca cepat.
const formatJam = new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const formatHari = new Intl.DateTimeFormat("id-ID", { timeZone: ZONA, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const formatTanggalPendek = new Intl.DateTimeFormat("id-ID", { timeZone: ZONA, weekday: "short", day: "numeric", month: "short" });
// Ringkasan di bilah bawah dan catatan sisa tidak perlu nama hari: kalimatnya harus pendek supaya tetap
// muat di layar monitor yang lebih kecil (1366 × 768).
const formatTanggalRingkas = new Intl.DateTimeFormat("id-ID", { timeZone: ZONA, day: "numeric", month: "short" });
const formatBulan = new Intl.DateTimeFormat("id-ID", { timeZone: ZONA, month: "long", year: "numeric" });

function jam(iso: string): string {
  return formatJam.format(new Date(iso));
}

/** Nama peserta/pejabat yang hadir, dipotong supaya baris tetap pendek terbaca dari jauh. */
function namaPeserta(teks: string, batas: number): string {
  const nama = teks.split(", ").filter(Boolean);
  return nama.length > batas ? `${nama.slice(0, batas).join(", ")} +${nama.length - batas} lainnya` : nama.join(", ");
}

/** Selang ke menit sampai sebuah agenda mulai; negatif berarti sudah lewat. */
function menitLagi(iso: string, sekarang: number): number {
  return Math.round((new Date(iso).getTime() - sekarang) / 60_000);
}

const GANTI_LAYAR_MS = 20_000;
// Hanya dipakai kalau jalur pembaruan realtime tertutup; selama jalur aktif, layar disegar oleh
// pemberitahuan dari database sehingga agenda baru muncul dalam hitung detik.
const SEGARKAN_JEDA_MS = 30_000;
const JEDA_MS = 250;
// Batas isi tiap daftar: layar harus tetap terbaca dari ~3 m. Kalau isinya lebih, sisanya diringkas
// jadi satu baris, dan kalau tetap terlalu tinggi, seluruh bagian dikecilkan (IsiSkala).
const BATAS_HARI_INI = 6;
const BATAS_KELPOK_MENDATANG = 5;

const LAYAR = [
  { kode: "agenda", nama: "Agenda" },
  { kode: "statistik", nama: "Statistik" },
  { kode: "grafik", nama: "Grafik" },
] as const;

const konfigurasiMasuk = { surat: { label: "Surat masuk", color: "var(--color-chart-masuk)" } } satisfies ChartConfig;
const konfigurasiKeluar = { keluar: { label: "Surat keluar", color: "var(--color-chart-keluar)" } } satisfies ChartConfig;
const konfigurasiRapat = {
  total: { label: "Total agenda", color: "var(--info)" },
} satisfies ChartConfig;

export function MonitorLayar({
  hariIni,
  besok,
  mendatang,
  statistik,
  grafik,
}: {
  hariIni: AgendaBaris[];
  besok: AgendaBaris[];
  mendatang: AgendaKelompok[];
  statistik: StatistikLayar;
  grafik: GrafikLayar;
}) {
  const router = useRouter();
  const terhubung = gunakanTersambung();
  const [sekarang, setSekarang] = useState(() => Date.now());
  // Indeks dan hitung mundur disimpan sebagai satu state: pembaruan updaternya harus murni (React dev
  // memanggil updater dua kali), jadi perpindahan layar tidak boleh dilakukan di dalam updater jam.
  const [giliran, setGiliran] = useState({ indeks: 0, sisa: GANTI_LAYAR_MS });
  const [jeda, setJeda] = useState(false);

  useEffect(() => {
    // Satu timer: jam berdetak dan hitung mundur pergantian layar berjalan dari sini. Saat dijeda,
    // hitung mundur berhenti tapi jam tetap jalan — yang berhenti hanya pergantian konten.
    const tik = setInterval(() => {
      setSekarang(Date.now());
      if (jeda) return;
      setGiliran((g) =>
        g.sisa > JEDA_MS ? { indeks: g.indeks, sisa: g.sisa - JEDA_MS } : { indeks: (g.indeks + 1) % LAYAR.length, sisa: GANTI_LAYAR_MS },
      );
    }, JEDA_MS);
    const segar = terhubung ? undefined : setInterval(() => startTransition(() => router.refresh()), SEGARKAN_JEDA_MS);
    return () => {
      clearInterval(tik);
      if (segar) clearInterval(segar);
    };
  }, [router, jeda, terhubung]);

  const pilih = useCallback((i: number) => {
    setGiliran({ indeks: ((i % LAYAR.length) + LAYAR.length) % LAYAR.length, sisa: GANTI_LAYAR_MS });
  }, []);

  useEffect(() => {
    function tombol(e: KeyboardEvent) {
      if (e.key === " ") {
        e.preventDefault();
        setJeda((v) => !v);
      } else if (e.key === "ArrowRight") {
        setGiliran((g) => ({ indeks: (g.indeks + 1) % LAYAR.length, sisa: GANTI_LAYAR_MS }));
      } else if (e.key === "ArrowLeft") {
        setGiliran((g) => ({ indeks: (g.indeks - 1 + LAYAR.length) % LAYAR.length, sisa: GANTI_LAYAR_MS }));
      }
    }
    window.addEventListener("keydown", tombol);
    return () => window.removeEventListener("keydown", tombol);
  }, []);

  const layarAktif = LAYAR[giliran.indeks].kode;
  const kosong = hariIni.length === 0 && besok.length === 0 && mendatang.length === 0;
  const hariTampil = hariIni.slice(0, BATAS_HARI_INI);
  const hariLain = hariIni.length - hariTampil.length;
  // Panel kanan menggabungkan besok dan berikutnya; daftar jauh dibatasi supaya tetap terbaca.
  // `tanggal` selalu bentuk yang bisa dibaca new Date(): kelompok besok memakai waktu agendanya sendiri,
  // kelompok berikutnya memakai tanggalnya (nama kunci "besok" bukan tanggal, jadi tidak ikut di-parse).
  const kelompok: { kunci: string; tanggal: string; label: string; baris: AgendaBaris[] }[] = [
    ...(besok.length ? [{ kunci: "besok", tanggal: besok[0].mulai, label: `Besok · ${formatTanggalPendek.format(new Date(besok[0].mulai))}`, baris: besok }] : []),
    ...mendatang.map((k) => ({ kunci: k.tanggal, tanggal: `${k.tanggal}T00:00:00+07:00`, label: formatTanggalPendek.format(new Date(`${k.tanggal}T00:00:00+07:00`)), baris: k.baris })),
  ];
  const kelompokTampil = kelompok.slice(0, BATAS_KELPOK_MENDATANG);
  const agendaLain = kelompok.slice(BATAS_KELPOK_MENDATANG).reduce((n, k) => n + k.baris.length, 0);
  const tanggalTerakhir = kelompok[kelompok.length - 1]?.tanggal;
  const jumlahSemua = hariIni.length + besok.length + mendatang.reduce((n, k) => n + k.baris.length, 0);
  const acuan = Math.max(statistik.masuk, statistik.keluar, statistik.keluarBelumDikirim, statistik.belumDidisposisikan, statistik.disposisiBelumSelesai, statistik.agendaHariIni, statistik.rapatBulanIni);

  return (
    <div className="dark relative flex min-h-dvh flex-col overflow-x-hidden bg-background text-foreground lg:h-dvh lg:overflow-hidden">
      {/* Latar bertitik di tepi layar; bagian tengah ditransparansikan lewat mask supaya jam besar dan
          angka statistik tetap bersih terbaca dari jarak ~3 m. */}
      <DotPattern
        width={22}
        height={22}
        cx={1}
        cy={1}
        cr={1.2}
        className="fill-foreground/16 [mask-image:radial-gradient(1200px_circle_at_center,transparent_30%,white_75%)]"
      />
      <header className="flex shrink-0 flex-col gap-4 border-b border-border px-12 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="flex items-center gap-4">
          <img src="/logo.svg" alt="" className="size-11 rounded-xl sm:size-12" />
          <div className="min-w-0">
            <p className="text-xl font-semibold sm:text-2xl">Bidang Aset — BPKAD Kota Magelang</p>
            <p className="max-w-[760px] text-[15px] leading-snug text-muted-foreground">Monitoring agenda, statistik surat masuk dan surat keluar pada Bidang Aset BPKAD Kota Magelang</p>
          </div>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="num text-[clamp(2.75rem,4vw,3.6rem)] font-semibold leading-none tracking-tight">{formatJam.format(sekarang)}</p>
          <p className="mt-1 text-base text-muted-foreground">{formatHari.format(sekarang)}</p>
        </div>
      </header>

      {/* Klik di mana saja pada konten menjeda layar — pengunjung yang sedang membaca tidak kehilangan
        halamannya karena pergantian. Ketiga layar berada di atas satu wadah tetap tingginya, jadi layar
        tidak pernah menggulir: yang terlalu tinggi dikecilkan, bukan digulir. */}
      <main className="relative min-h-0 flex-1 overflow-y-auto lg:overflow-hidden" onPointerDown={() => setJeda((v) => !v)}>
        <section
          aria-hidden={layarAktif !== "agenda"}
          className={cn(
            "px-12 py-7 transition-opacity duration-500",
            layarAktif === "agenda" ? "relative opacity-100 lg:absolute lg:inset-0" : "hidden opacity-0 lg:block lg:absolute lg:inset-0 lg:pointer-events-none",
          )}
        >
          {kosong ? (
            <IsiSkala className="grid h-full place-items-center">
              <div className="flex flex-col items-center gap-4 text-center">
                <p className="num text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-tight">Belum ada agenda yang ditampilkan</p>
                <p className="max-w-[42rem] text-lg text-muted-foreground">
                  Layar ini menampilkan agenda yang masih akan berlangsung, termasuk yang sudah dibatalkan. Agenda yang sudah selesai tidak ditampilkan.
                </p>
                <p className="num text-base text-muted-foreground">{formatHari.format(sekarang)}</p>
              </div>
            </IsiSkala>
          ) : (
            <IsiSkala>
              <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
                <div className="flex min-w-0 flex-col gap-4">
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <h2 className="text-xl font-semibold uppercase tracking-[0.14em] text-muted-foreground">Agenda hari ini</h2>
                    <span className="num rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">{hariIni.length} agenda</span>
                  </div>
                  <ul className="flex min-h-0 flex-1 flex-col gap-3">
                    {hariTampil.map((a, i) => {
                      const selang = menitLagi(a.mulai, sekarang);
                      const batal = a.status === "dibatalkan";
                      const akanSegera = !batal && selang > 0 && selang <= 30;
                      const sedang = !batal && (a.status === "berlangsung" || selang <= 0);
                      return (
                        <li
                          key={a.id}
                          data-baris={a.status}
                          className={cn(
                            "grid min-h-[5.5rem] flex-1 items-center gap-2 rounded-2xl px-5 py-4 sm:max-h-[7.5rem] sm:grid-cols-[10.5rem_minmax(0,1fr)_auto] sm:gap-6",
                            batal ? "" : akanSegera ? "bg-warning-bg ring-1 ring-warning-line" : sedang ? "bg-success-bg ring-1 ring-success-line" : "",
                            i === hariTampil.length - 1 && hariLain === 0 ? "" : "border-b border-border",
                          )}
                        >
                          <p className="num whitespace-nowrap text-[1.3rem] font-semibold leading-none tracking-tight sm:text-[1.75rem]">
                            {jam(a.mulai)}
                            {a.selesai ? `–${jam(a.selesai)}` : ""}
                          </p>
                          <div className="min-w-0 flex-1">
                            <p className="text-[1.6rem] font-medium leading-tight">{a.agenda}</p>
                            <p className="mt-1.5 text-[15px] text-muted-foreground">
                              {[a.tempat ? `di ${a.tempat}` : "", a.penyelenggara ? `diselenggarakan ${a.penyelenggara}` : "", a.pemberi ? `dari ${a.pemberi}` : "", a.nomor ? `surat ${a.nomor}` : "", a.peserta ? `diikuti ${namaPeserta(a.peserta, 3)}` : ""].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <p
                            className={cn(
                              "justify-self-start rounded-full px-4 py-2 text-sm font-medium sm:justify-self-end",
                              batal ? "bg-card text-destructive ring-1 ring-destructive/40" : akanSegera ? "bg-card text-warning ring-1 ring-warning-line" : sedang ? "bg-card text-success ring-1 ring-success-line" : "bg-muted text-muted-foreground",
                            )}
                            data-lencana={batal ? "batal" : akanSegera ? "segera" : sedang ? "sedang" : "terjadwal"}
                          >
                            {batal ? "dibatalkan" : akanSegera ? `${selang} menit lagi` : a.status === "berlangsung" ? "sedang berlangsung" : selang <= 0 ? "sudah lewat" : a.status === "dijadwalkan_ulang" ? "jadwal diubah" : "terjadwal"}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                  {hariLain > 0 ? (
                    <p className="num shrink-0 text-[15px] text-muted-foreground">+ {hariLain} agenda lagi hari ini</p>
                  ) : null}
                </div>

                <aside className="flex min-h-0 flex-col gap-5 overflow-hidden rounded-3xl border border-border bg-card px-6 py-6">
                  <h2 className="shrink-0 text-xl font-semibold uppercase tracking-[0.14em] text-muted-foreground">Besok &amp; mendatang</h2>
                  <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden">
                    {kelompokTampil.length === 0 ? (
                      <p className="my-auto rounded-2xl border border-dashed border-border px-4 py-3 text-base text-muted-foreground">
                        Belum ada agenda mendatang.
                      </p>
                    ) : (
                      kelompokTampil.map((k) => (
                        <div key={k.kunci} className="border-l-2 border-border pl-4">
                          <p className="text-[17px] font-semibold">{k.label}</p>
                          <ul className="mt-2 flex flex-col gap-1.5">
                            {k.baris.map((a) => (
                              <li key={a.id} className="num break-words text-[15px] text-muted-foreground">
                                {jam(a.mulai)} · <span className="text-foreground">{a.agenda}</span>
                                {a.tempat ? ` di ${a.tempat}` : ""}
                                {a.status === "dibatalkan" ? <span className="text-destructive"> · dibatalkan</span> : ""}
                                {a.peserta ? <span className="block">diikuti {namaPeserta(a.peserta, 2)}</span> : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    )}
                  </div>
                  {agendaLain > 0 && tanggalTerakhir ? (
                    <p className="num shrink-0 text-[15px] text-muted-foreground">
                      + {agendaLain} agenda lain sampai {formatTanggalRingkas.format(new Date(tanggalTerakhir))}
                    </p>
                  ) : null}
                </aside>
              </div>
            </IsiSkala>
          )}
        </section>

        <section
          aria-hidden={layarAktif !== "statistik"}
          className={cn(
            "px-12 py-7 transition-opacity duration-500",
            layarAktif === "statistik" ? "relative opacity-100 lg:absolute lg:inset-0" : "hidden opacity-0 lg:block lg:absolute lg:inset-0 lg:pointer-events-none",
          )}
        >
          <IsiSkala>
            <div className="flex h-full min-h-0 flex-col gap-6">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-muted-foreground">Statistik surat — {formatBulan.format(sekarang)}</h2>
                <p className="text-[14px] text-muted-foreground">Angka dihitung langsung dari data surat dan agenda bulan berjalan</p>
              </div>
              {acuan === 0 ? (
                <p className="shrink-0 rounded-2xl border border-dashed border-border px-4 py-3 text-lg text-muted-foreground">
                  Belum ada surat masuk, surat keluar, maupun agenda yang tercatat bulan ini.
                </p>
              ) : null}
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
                <Kartu kode="agenda" angka={statistik.agendaHariIni} label="Agenda hari ini" warna="var(--info)" acuan={acuan} />
                <Kartu kode="masuk" angka={statistik.masuk} label="Surat masuk bulan ini" warna="var(--color-chart-masuk)" acuan={acuan} />
                <Kartu kode="keluar" angka={statistik.keluar} label="Surat keluar bulan ini" warna="var(--color-chart-keluar)" acuan={acuan} />
                <Kartu kode="belum-kirim" angka={statistik.keluarBelumDikirim} label="Surat keluar belum dikirim" warna="var(--warning)" acuan={acuan} />
                <Kartu kode="belum-disposisi" angka={statistik.belumDidisposisikan} label="Surat belum didisposisikan" warna="var(--warning)" acuan={acuan} />
                <Kartu kode="belum-selesai" angka={statistik.disposisiBelumSelesai} label="Disposisi belum selesai" warna="var(--success)" acuan={acuan} />
                <Kartu kode="rapat" angka={statistik.rapatBulanIni} label="Agenda bulan ini" warna="var(--success)" acuan={acuan} />
                <Kartu kode="total" angka={statistik.masuk + statistik.keluar} label="Total surat bulan ini" warna="var(--chart-1)" acuan={acuan} />
              </div>
            </div>
          </IsiSkala>
        </section>

        <section
          aria-hidden={layarAktif !== "grafik"}
          className={cn(
            "px-12 py-7 transition-opacity duration-500",
            layarAktif === "grafik" ? "relative opacity-100 lg:absolute lg:inset-0" : "hidden opacity-0 lg:block lg:absolute lg:inset-0 lg:pointer-events-none",
          )}
        >
          <IsiSkala>
            <div className="grid h-full min-h-0 grid-cols-1 gap-6 md:grid-cols-2 md:grid-rows-2">
              <Panel judul="Surat masuk per bulan" keterangan={`Dihitung dari tanggal terima surat, tahun ${grafik.tahun}.`} id="grafik-masuk-monitor">
                {grafik.masuk.some((b) => b.surat > 0) ? (
                  <StatBarChart config={konfigurasiMasuk} data={grafik.masuk} judul="Grafik surat masuk per bulan" tinggiKelas="h-full w-full" ukuranTick={16} kisi="kedua arah" />
                ) : (
                  <Kosong teks={`Belum ada surat masuk pada tahun ${grafik.tahun}.`} />
                )}
              </Panel>
              <Panel judul="Surat keluar per bulan" keterangan={`Dihitung dari tanggal surat keluar, tahun ${grafik.tahun}.`} id="grafik-keluar-monitor">
                {grafik.keluar.some((b) => b.keluar > 0) ? (
                  <StatBarChart config={konfigurasiKeluar} data={grafik.keluar} judul="Grafik surat keluar per bulan" tinggiKelas="h-full w-full" ukuranTick={16} kisi="kedua arah" />
                ) : (
                  <Kosong teks={`Belum ada surat keluar pada tahun ${grafik.tahun}.`} />
                )}
              </Panel>
              <Panel judul="Komposisi kategori surat" keterangan={`Enam kategori terbanyak ditampilkan sendiri, sisanya menjadi Lainnya. Tahun ${grafik.tahun}.`} id="komposisi-monitor">
                {grafik.jenis.length === 0 ? (
                  <Kosong teks={`Belum ada surat pada tahun ${grafik.tahun}.`} />
                ) : (
                  <StatPieChart
                    slices={grafik.jenis}
                    total={grafik.totalJenis}
                    judul={`Komposisi kategori surat tahun ${grafik.tahun}`}
                    susun="sebelah"
                    lebarKelas="max-w-[min(230px,55%)]"
                    kelasLegend="grid-cols-1 md:grid-cols-2 text-[15px] xl:text-lg"
                    kelasAngka="text-2xl"
                  />
                )}
              </Panel>
              <Panel judul="Agenda per bulan" keterangan={`Semua agenda dihitung sebagai total, termasuk yang dibatalkan. Tahun ${grafik.tahun}.`} id="grafik-rapat-monitor">
                {grafik.rapat.some((b) => b.total > 0) ? (
                  <StatBarChart config={konfigurasiRapat} data={grafik.rapat} judul="Grafik agenda per bulan" tinggiKelas="h-full w-full" ukuranTick={16} kisi="kedua arah" />
                ) : (
                  <Kosong teks={`Belum ada agenda pada tahun ${grafik.tahun}.`} />
                )}
              </Panel>
            </div>
          </IsiSkala>
        </section>
      </main>

      <footer className="flex shrink-0 flex-wrap items-center gap-4 border-t border-border px-12 py-4 text-base text-muted-foreground">
        <button
          type="button"
          onClick={() => setJeda((v) => !v)}
          aria-label={jeda ? "Lanjutkan pergantian layar" : "Jeda pergantian layar"}
          className={cn("flex h-11 min-w-11 items-center gap-2 rounded-full px-4 font-medium", jeda ? "bg-info-bg text-info ring-1 ring-info-line" : "bg-muted text-foreground")}
        >
          {jeda ? <PlayIcon /> : <PauseIcon />}
          <span>{jeda ? "Lanjut" : "Jeda"}</span>
        </button>
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
          <p className="num" aria-live="polite">
            {layarAktif === "agenda" ? "Layar agenda" : layarAktif === "statistik" ? "Layar statistik" : "Layar grafik"}
            {" · "}
            {jeda ? "dijeda" : `berganti dalam ${Math.ceil(giliran.sisa / 1000)} detik`}
          </p>
          {/* Jalur maju menandai seberapa dekat ke pergantian berikutnya; saat dijeda ia membeku. */}
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary transition-[width] duration-[250ms]" style={{ width: `${((GANTI_LAYAR_MS - giliran.sisa) / GANTI_LAYAR_MS) * 100}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {LAYAR.map((l, i) => (
            <button
              key={l.kode}
              type="button"
              onClick={() => pilih(i)}
              aria-label={`Tampilkan ${l.nama}`}
              aria-current={layarAktif === l.kode ? "true" : undefined}
              className={cn("h-11 rounded-full px-4 text-base font-medium", layarAktif === l.kode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
            >
              {l.nama}
            </button>
          ))}
        </div>
        <p className="num ml-2">
          {tanggalTerakhir
            ? `${jumlahSemua} agenda tampil sampai ${formatTanggalRingkas.format(new Date(tanggalTerakhir))}`
            : `${hariIni.length + besok.length} agenda tampil untuk hari ini dan besok`}
        </p>
      </footer>
    </div>
  );
}

/**
 * Isi yang selalu muat di layar: bagian ini mengukur tinggi isinya dan tinggi ruang yang tersedia.
 * Kalau isi lebih tinggi, seluruh bagian dikecilkan (bukan digulir), karena layar monitor TV tidak
 * boleh punya scrollbar — pengunjung membaca layar utuh dari jarak ~3 m.
 */
function IsiSkala({ children, className }: { children: React.ReactNode; className?: string }) {
  const wadah = useRef<HTMLDivElement>(null);
  const isi = useRef<HTMLDivElement>(null);
  const [skala, setSkala] = useState(1);

  useEffect(() => {
    const w = wadah.current;
    const i = isi.current;
    if (!w || !i) return;
    const hitung = () => {
      const tersedia = w.clientHeight;
      const alami = i.scrollHeight;
      if (!tersedia || !alami) return;
      // Di HP layar dibaca dengan menggulir, bukan dikecilkan: teks kecil akan terpotong kalau dipaksa muat.
      if (window.matchMedia("(max-width: 640px)").matches) {
        setSkala(1);
        return;
      }
      setSkala(alami > tersedia ? Math.max(0.55, tersedia / alami) : 1);
    };
    const pengamat = new ResizeObserver(hitung);
    pengamat.observe(w);
    pengamat.observe(i);
    hitung();
    return () => pengamat.disconnect();
  }, []);

  return (
    <div ref={wadah} className={cn("h-full overflow-hidden", className)}>
      <div
        ref={isi}
        className="h-full origin-top"
        style={skala < 1 ? { transform: `scale(${skala})`, width: `${100 / skala}%`, marginLeft: `-${(100 / skala - 100) / 2}%` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

function Kartu({ angka, label, warna, acuan, kode }: { angka: number; label: string; warna: string; acuan: number; kode: string }) {
  const persen = acuan > 0 ? Math.round((angka / acuan) * 100) : 0;
  return (
    <div className="flex min-h-[9rem] flex-col justify-between gap-3 rounded-3xl border border-border bg-card px-6 py-6">
      <p className="text-[15px] text-muted-foreground">{label}</p>
      <p className={cn("num text-[clamp(2.25rem,3.4vw,3.75rem)] font-semibold leading-none tracking-tight", angka === 0 ? "text-muted-foreground" : "text-foreground")}>{angka}</p>
      {/* Track memakai latar kartu + garis tipis: bar yang kecil tetap kelihatan batasnya, dan warna bar
        diukur terhadap latar kartu (3:1), bukan terhadap muted yang lebih terang. */}
      <div className="h-2.5 overflow-hidden rounded-full bg-card ring-1 ring-foreground/12" aria-hidden="true">
        <div data-meter={kode} className="h-full rounded-full" style={{ width: `${persen}%`, background: warna }} />
      </div>
      <p className="text-[13px] text-muted-foreground">{angka === 0 ? "belum ada bulan ini" : `${persen}% dari angka terbesar di layar ini`}</p>
    </div>
  );
}

function Panel({ judul, keterangan, id, children }: { judul: string; keterangan: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[12rem] min-w-0 flex-col gap-3 rounded-3xl border border-border bg-card px-6 py-5" aria-labelledby={id}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h3 id={id} className="text-xl font-semibold">{judul}</h3>
        <p className="text-[14px] text-muted-foreground">{keterangan}</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

function Kosong({ teks }: { teks: string }) {
  return <p className="m-auto rounded-2xl border border-dashed border-border px-4 py-3 text-lg text-muted-foreground">{teks}</p>;
}
