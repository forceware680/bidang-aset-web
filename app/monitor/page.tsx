import type { Metadata } from "next";
import { KeyRound } from "lucide-react";

import { MonitorLayar, type AgendaBaris, type AgendaKelompok } from "@/components/monitor-layar";
import { DotPattern } from "@/components/ui/dot-pattern";
import { agendaMonitor, grafikMonitor, kunciMonitorAktif, kunciMonitorCocok, statistikMonitor, type AgendaMonitor } from "@/lib/monitor";
import { sinkronkanRapatLewatWaktu } from "@/lib/rapat-waktu";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Monitor Bidang Aset — agenda dan statistik",
  description: "Layar yang dipasang di depan ruangan Bidang Aset: agenda yang ditampilkan dan statistik surat bulan berjalan.",
};

function baris(a: AgendaMonitor): AgendaBaris {
  return {
    id: a.id,
    mulai: a.tanggal_mulai.toISOString(),
    selesai: a.tanggal_selesai?.toISOString() ?? null,
    agenda: a.agenda_rapat,
    tempat: a.tempat,
    penyelenggara: a.penyelenggara,
    pemberi: a.pemberi_disposisi,
    nomor: a.nomor_agenda,
    peserta: a.peserta,
    status: a.status_rapat,
  };
}

function Gerbang({ judul, pesan }: { judul: string; pesan?: string }) {
  return (
    <main className="dark relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-8 text-foreground">
      <DotPattern
        width={22}
        height={22}
        cx={1}
        cy={1}
        cr={1.2}
        className="fill-foreground/14 [mask-image:radial-gradient(1100px_circle_at_center,transparent_20%,white_72%)]"
      />
      {/* Aura amber di belakang kartu: layar kelihatan sedang menunggu kunci, bukan sekadar error. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(760px_circle_at_center,oklch(0.72_0.17_46/0.14),transparent_68%)]" />
      <div className="relative flex w-full max-w-2xl flex-col items-center gap-6 rounded-3xl border border-primary bg-card px-7 py-8 text-center shadow-[0_40px_120px_-40px] shadow-primary/35 sm:gap-7 sm:px-12 sm:py-10" data-gerbang="kartu">
        <span className="relative flex size-16 items-center justify-center rounded-full bg-primary/12 ring-1 ring-primary" data-gerbang="ikon">
          <span className="absolute -inset-2 animate-pulse rounded-full ring-2 ring-primary/40 motion-reduce:animate-none" />
          <KeyRound className="size-8 text-primary" aria-hidden="true" />
        </span>
        <div className="flex flex-col items-center gap-3">
          <span className="rounded-full border border-primary/75 bg-primary/12 px-4 py-1.5 text-[12px] font-semibold uppercase tracking-[0.22em] text-foreground" data-gerbang="eyebrow">
            Monitor Bidang Aset
          </span>
          <h1 className="text-[clamp(1.75rem,6.5vw,3.4rem)] font-bold uppercase leading-[1.05] tracking-[0.02em]" data-gerbang="judul">{judul}</h1>
        </div>
        {pesan ? <p className="max-w-lg text-base leading-snug text-muted-foreground sm:text-lg">{pesan}</p> : null}
      </div>
    </main>
  );
}

export default async function MonitorPage({ searchParams }: { searchParams: Promise<{ t?: string | string[] }> }) {
  const sp = await searchParams;
  const kunci = await kunciMonitorAktif();
  const token = typeof sp.t === "string" ? sp.t : "";

  if (!kunci) return <Gerbang judul="Monitor Belum Siap" pesan="Kunci monitor belum dipasang. Buka Pengaturan → Kunci layar monitor untuk memasang atau membalik kunci." />;
  if (!(await kunciMonitorCocok(token))) return <Gerbang judul="Kunci Monitor Tidak Cocok" />;

  const sekarang = new Date();
  await sinkronkanRapatLewatWaktu(sekarang);
  const { hariIni, besok, mendatang } = await agendaMonitor(sekarang);
  const statistik = await statistikMonitor(sekarang);
  const grafik = await grafikMonitor(sekarang);
  const kelompok: AgendaKelompok[] = mendatang.map((k) => ({ tanggal: k.tanggal, baris: k.agenda.map(baris) }));

  return <MonitorLayar hariIni={hariIni.map(baris)} besok={besok.map(baris)} mendatang={kelompok} statistik={statistik} grafik={grafik} />;
}
