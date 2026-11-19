import Link from "next/link";
import { cn } from "cn";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, SaveIcon, TrashIcon } from "lucide-react";
import { bolehMengubah, requireUser } from "@/lib/auth";
import { daftarAkunPeserta } from "@/lib/akun";
import { prisma } from "@/lib/db";
import { Shell } from "@/components/shell";
import { AksiIkon } from "@/components/aksi-ikon";
import { AgendaMandiriDialog } from "@/components/agenda-mandiri-dialog";
import { BarisAgenda, type PesertaRinci } from "@/components/baris-agenda";
import { buatAgendaMandiri } from "@/lib/actions/rapat";
import { sinkronkanRapatLewatWaktu } from "@/lib/rapat-waktu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToastKuer } from "@/components/toast-kuer";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { labelStatusRapat, tint, tone } from "@/lib/status";
import { jamText, namaBulan, tanggal, tanggalJamText } from "@/lib/format";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

// Titik warna pada sel kalender: warna hanya pelengkap, jam dan judul tetap teks.
function dotStatus(code: string): string {
  return code === "berlangsung"
    ? "bg-warning"
    : code === "selesai"
      ? "bg-success"
      : code === "batal"
        ? "bg-muted-foreground"
        : "bg-info";
}

const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

type Rapat = {
  id: string;
  surat_id: string | null;
  nomor_agenda: string | null;
  status_surat: string | null;
  agenda_rapat: string;
  penyelenggara: string | null;
  tanggal_mulai: Date;
  tanggal_selesai: Date | null;
  tempat: string | null;
  catatan: string | null;
  status_rapat: string;
  terbit: boolean;
  dibuat_oleh: string | null;
  peserta: string | null;
};

function rentangBulan(bulan: string): { mulai: Date; akhir: Date; label: string } {
  const mulai = geserBulan(bulan, 0);
  const akhir = geserBulan(bulan, 1);
  return {
    mulai,
    akhir,
    label: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(mulai),
  };
}

/** Awal bulan (plus/minus n bulan) sebagai instant tengah malam Asia/Jakarta. */
function geserBulan(bulan: string, langkah: number): Date {
  const [y, m] = bulan.split("-").map(Number);
  const total = y * 12 + (m - 1) + langkah;
  const yy = Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return new Date(`${yy}-${String(mm).padStart(2, "0")}-01T00:00:00+07:00`);
}

function bulanKey(d: Date): string {
  const bagian = formatBulan.formatToParts(d);
  return `${bagian.find((p) => p.type === "year")?.value}-${bagian.find((p) => p.type === "month")?.value}`;
}

function bulanBerikut(bulan: string): string {
  return bulanKey(geserBulan(bulan, 1));
}

function bulanSebelum(bulan: string): string {
  return bulanKey(geserBulan(bulan, -1));
}

const formatBulan = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" });
const formatTanggal = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });

function bulanBerjalan(): string {
  const bagian = formatBulan.formatToParts(new Date());
  return `${bagian.find((p) => p.type === "year")?.value}-${bagian.find((p) => p.type === "month")?.value}`;
}

function tanggalBerjalan(): string {
  const bagian = formatTanggal.formatToParts(new Date());
  return `${bagian.find((p) => p.type === "year")?.value}-${bagian.find((p) => p.type === "month")?.value}-${bagian.find((p) => p.type === "day")?.value}`;
}

function labelTanggal(kunci: string): string {
  const d = new Date(`${kunci}T00:00:00+07:00`);
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(d);
}

export default async function RapatPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  await sinkronkanRapatLewatWaktu();
  const sp = await searchParams;
  // Hasil yang dibawa query disampaikan sebagai toast, bukan banner di atas halaman.
  const notifikasi: { teks: string; nada: "sukses" | "galat" } | null =
    sp.agenda === "ok"
      ? { teks: sp.pesan ? String(sp.pesan) : "Agenda tersimpan.", nada: "sukses" }
      : sp.agenda === "galat"
        ? { teks: sp.pesan ? String(sp.pesan) : "Agenda gagal disimpan.", nada: "galat" }
        : sp.ubah === "ok"
          ? { teks: "Status agenda diperbarui.", nada: "sukses" }
          : sp.ubah === "galat"
            ? { teks: sp.pesan ? String(sp.pesan) : "Status agenda gagal diubah.", nada: "galat" }
            : null;
  const bulanKini = bulanBerjalan();
  const bulan = typeof sp.bulan === "string" && /^\d{4}-\d{2}$/.test(sp.bulan) ? sp.bulan : bulanKini;
  const { mulai, akhir, label } = rentangBulan(bulan);
  const bolehUbah = bolehMengubah(user.role);

  // Detail satu tanggal: agenda pada hari itu, urut dari jam paling awal.
  const tanggalKunci = typeof sp.tanggal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.tanggal) ? sp.tanggal : null;
  const hariMulai = tanggalKunci ? new Date(`${tanggalKunci}T00:00:00+07:00`) : null;
  const hariAkhir = hariMulai ? new Date(hariMulai.getTime() + 86400000) : null;

  let kalender: Rapat[] = [];
  let mendatang: Rapat[] = [];
  let pelaksanaan: Rapat[] = [];
  let isiHari: Rapat[] = [];
  let galat = "";
  const pesertaRinci: Record<string, PesertaRinci[]> = {};
  let daftarPegawai: string[] = [];

  try {
    kalender = await prisma.$queryRaw<Rapat[]>`
      SELECT r.id, r.surat_id, s.nomor_agenda, s.status_surat, r.agenda_rapat, r.penyelenggara,
             r.tanggal_mulai, r.tanggal_selesai, r.tempat, r.catatan, r.status_rapat, r.terbit, u.name AS dibuat_oleh,
             (SELECT string_agg(p.nama_peserta, ', ' ORDER BY p.nama_peserta)
              FROM peserta_rapat p WHERE p.rapat_id = r.id) AS peserta
      FROM jadwal_rapat r
      LEFT JOIN surat_masuk s ON s.id = r.surat_id AND s.deleted_at IS NULL
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.tanggal_mulai >= ${mulai} AND r.tanggal_mulai < ${akhir}
      ORDER BY r.tanggal_mulai`;

    if (hariMulai && hariAkhir) {
      isiHari = await prisma.$queryRaw<Rapat[]>`
        SELECT r.id, r.surat_id, s.nomor_agenda, s.status_surat, r.agenda_rapat, r.penyelenggara,
               r.tanggal_mulai, r.tanggal_selesai, r.tempat, r.catatan, r.status_rapat, r.terbit, u.name AS dibuat_oleh,
               (SELECT string_agg(p.nama_peserta, ', ' ORDER BY p.nama_peserta)
                FROM peserta_rapat p WHERE p.rapat_id = r.id) AS peserta
        FROM jadwal_rapat r
        LEFT JOIN surat_masuk s ON s.id = r.surat_id AND s.deleted_at IS NULL
        LEFT JOIN users u ON u.id = r.created_by
        WHERE r.tanggal_mulai >= ${hariMulai} AND r.tanggal_mulai < ${hariAkhir}
        ORDER BY r.tanggal_mulai`;
    }

    mendatang = await prisma.$queryRaw<Rapat[]>`
      SELECT r.id, r.surat_id, s.nomor_agenda, s.status_surat, r.agenda_rapat, r.penyelenggara,
             r.tanggal_mulai, r.tanggal_selesai, r.tempat, r.catatan, r.status_rapat, r.terbit, u.name AS dibuat_oleh,
             (SELECT string_agg(p.nama_peserta, ', ' ORDER BY p.nama_peserta)
              FROM peserta_rapat p WHERE p.rapat_id = r.id) AS peserta
      FROM jadwal_rapat r
      LEFT JOIN surat_masuk s ON s.id = r.surat_id AND s.deleted_at IS NULL
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.tanggal_mulai >= now() AND r.status_rapat <> 'dibatalkan'
      ORDER BY r.tanggal_mulai
      LIMIT 10`;

    pelaksanaan = await prisma.$queryRaw<Rapat[]>`
      SELECT r.id, r.surat_id, s.nomor_agenda, s.status_surat, r.agenda_rapat, r.penyelenggara,
             r.tanggal_mulai, r.tanggal_selesai, r.tempat, r.catatan, r.status_rapat, r.terbit, u.name AS dibuat_oleh,
             (SELECT string_agg(p.nama_peserta, ', ' ORDER BY p.nama_peserta)
              FROM peserta_rapat p WHERE p.rapat_id = r.id) AS peserta
      FROM jadwal_rapat r
      LEFT JOIN surat_masuk s ON s.id = r.surat_id AND s.deleted_at IS NULL
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.tanggal_mulai < now()
      ORDER BY r.tanggal_mulai DESC
      LIMIT 20`;

      // Peserta per agenda untuk tampilan satu tanggal. Daftar pegawai aktif diambil untuk combobox karena
      // peserta agenda mandiri dikelola di kalender, bukan di halaman surat.
      const rows = await prisma.peserta_rapat.findMany({
        where: { rapat_id: { in: isiHari.map((r) => r.id) } },
        select: { id: true, rapat_id: true, nama_peserta: true, instansi_bidang: true, keterangan: true },
        orderBy: { nama_peserta: "asc" },
      });
      for (const p of rows) {
        const list = pesertaRinci[p.rapat_id] ?? [];
        list.push({ id: p.id, nama: p.nama_peserta, instansi: p.instansi_bidang, keterangan: p.keterangan });
        pesertaRinci[p.rapat_id] = list;
      }
      if (bolehUbah) {
        daftarPegawai = await daftarAkunPeserta();
      }
  } catch (e) {
    galat = e instanceof Error ? e.message : "Server data belum bisa dihubungi.";
  }

  // Sel kalender dibangun dari tanggal 1 bulan berjalan; hari sebelum tanggal 1 dibiarkan kosong.
  const namaKeIndeks: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const hariPertama = new Date(`${bulan}-01T00:00:00+07:00`);
  const namaHariPertama = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Jakarta" }).format(hariPertama);
  const offsetHari = namaKeIndeks[namaHariPertama] ?? 0;
  const jumlahHari = Math.floor((akhir.getTime() - mulai.getTime()) / 86400000);
  // Tanggal hari ini dihitung di zona yang sama dengan tampilan, bukan zona server/browser.
  const kunciHariIni = tanggalBerjalan();
  const sel: { kunci: string; hari: number; isi: Rapat[] | null }[] = [];
  for (let i = 0; i < offsetHari; i++) sel.push({ kunci: `kosong-${i}`, hari: 0, isi: null });
  for (let hari = 1; hari <= jumlahHari; hari++) {
    const tanggalSel = new Date(mulai.getTime() + (hari - 1) * 86400000);
    const kunci = formatTanggal.format(tanggalSel);
    sel.push({
      kunci,
      hari,
      isi: kalender.filter((r) => formatTanggal.format(r.tanggal_mulai) === kunci),
    });
  }

  const milikSendiri = (r: Rapat) => r.surat_id === null && r.dibuat_oleh === user.name;

  return (
    <Shell
      user={user}
      aktif="rapat"
      judul={tanggalKunci ? `Agenda ${labelTanggal(tanggalKunci)}` : "Kalender agenda"}
      aksi={<AgendaMandiriDialog posisi="header" action={buatAgendaMandiri} bulan={bulan} tanggal={tanggalKunci ?? tanggalBerjalan()} daftarPegawai={daftarPegawai} namaSendiri={user.name} />}
    >
      {/* Di HP aksi utama menjadi pil melayang di pojok kanan bawah, di desktop tombolnya di header
        sejajar "Tambah Surat". Peran pembaca ikut membuat pengingat miliknya sendiri, jadi ini
        tidak di-gate bolehUbah. */}
      <AgendaMandiriDialog posisi="melayang" action={buatAgendaMandiri} bulan={bulan} tanggal={tanggalKunci ?? tanggalBerjalan()} daftarPegawai={daftarPegawai} namaSendiri={user.name} />
      {notifikasi ? <ToastKuer teks={notifikasi.teks} nada={notifikasi.nada} /> : null}

      {galat ? (
        <Alert variant="destructive">
          <AlertDescription>Kalender agenda gagal dimuat: {galat}</AlertDescription>
        </Alert>
      ) : (
        <>
          {tanggalKunci ? (
            <Card aria-labelledby="judul-hari">
              {/* Di HP judul butuh lebar penuh: tombol kembali ke kalender turun ke bawah deskripsi. Di desktop
                tetap satu baris, judul kiri tombol kanan. */}
              <CardHeader className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-1.5">
                  <CardTitle id="judul-hari" className="text-balance">Agenda pada {labelTanggal(tanggalKunci)}</CardTitle>
                  <CardDescription>
                    {isiHari.length === 0
                      ? "Belum ada agenda pada tanggal ini. Bisa dibuat langsung dari formulir di bawah."
                      : `${isiHari.length} agenda pada tanggal ini, urut dari jam paling awal.`}
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" asChild className="rounded-full md:rounded-2xl">
                  <Link href={`/rapat?bulan=${bulan}`}>
                    <CalendarDaysIcon />
                    Kalender {label}
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pb-[4.5rem] md:pb-0">
                {isiHari.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <CalendarDaysIcon />
                      </EmptyMedia>
                      <EmptyTitle>Tanggal ini masih kosong</EmptyTitle>
                      <EmptyDescription>Belum ada agenda maupun pengingat internal untuk tanggal ini.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  isiHari.map((r) => (
                    <BarisAgenda
                      key={r.id}
                      id={r.id}
                      agenda={r.agenda_rapat}
                      mulai={r.tanggal_mulai}
                      selesai={r.tanggal_selesai}
                      tempat={r.tempat}
                      penyelenggara={r.penyelenggara}
                      catatan={r.catatan}
                      bulan={bulan}
                      tanggal={tanggalKunci ?? tanggalBerjalan()}
                      suratId={r.surat_id}
                      nomorAgenda={r.nomor_agenda}
                      terbit={r.terbit}
                      dibuatOleh={r.dibuat_oleh}
                      statusRapat={r.status_rapat}
                      statusSurat={r.status_surat}
                      pesertaNama={r.peserta}
                      pesertaRinci={pesertaRinci[r.id] ?? []}
                      daftarPegawai={daftarPegawai}
                      namaSendiri={user.name}
                      bolehUbah={(bolehUbah || milikSendiri(r)) && r.status_surat !== "arsip"}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card aria-labelledby="judul-kalender">
            <CardHeader className="gap-2 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-x-3">
              <CardTitle id="judul-kalender">Kalender {label}</CardTitle>
              <CardDescription className="max-w-[52ch]">
                {kalender.length === 0
                  ? "Tidak ada agenda pada bulan ini."
                  : `${kalender.length} agenda pada bulan ini. Klik tanggal untuk melihat jamnya; agenda dari surat menaut ke surat sumber.`}
              </CardDescription>
              <div className="w-full md:w-auto md:col-start-2 md:row-start-1 md:justify-self-end">
                <div className="flex w-full items-center gap-0.5 rounded-full border border-(--input) p-1 whitespace-nowrap md:w-auto" data-slot="month-nav">
                  <Button size="icon-sm" variant="ghost" asChild aria-label="Bulan sebelumnya" className="rounded-full">
                    <Link href={`/rapat?bulan=${bulanSebelum(bulan)}`}><ChevronLeftIcon /></Link>
                  </Button>
                  <span className="flex-1 px-1.5 text-center text-sm font-medium tabular-nums md:flex-none">{namaBulan(bulan)}</span>
                  <Button size="icon-sm" variant="ghost" asChild aria-label="Bulan berikutnya" className="rounded-full">
                    <Link href={`/rapat?bulan=${bulanBerikut(bulan)}`}><ChevronRightIcon /></Link>
                  </Button>
                  <span className="mx-0.5 hidden h-4 w-px bg-(--border) md:block" aria-hidden="true" />
                  <Button
                    size="icon-sm"
                    variant={bulan === bulanKini ? "selected" : "ghost"}
                    asChild
                    aria-label="Bulan berjalan"
                    className="rounded-full"
                  >
                    <Link href={`/rapat?bulan=${bulanKini}`} aria-current={bulan === bulanKini ? "page" : undefined}><CalendarDaysIcon /></Link>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto kalender" data-slot="calendar">
                <div className="grid min-w-[21rem] grid-cols-7 border-t lg:min-w-[40rem]">
                  {HARI.map((h) => (
                    <div key={h} className="border-b bg-secondary px-2 py-2 text-center text-xs font-medium text-secondary-foreground">
                      {h}
                    </div>
                  ))}
                  {sel.map((c) => (
                    <div
                      key={c.kunci}
                      className={`min-h-[76px] border-b border-r px-2 py-2 last:border-r-0 ${c.isi === null ? "bg-muted/40" : "bg-card"} ${c.kunci === kunciHariIni ? "bg-info-bg ring-1 ring-inset ring-info/35" : ""} ${c.kunci === tanggalKunci ? "ring-1 ring-inset ring-primary/45" : ""}`}
                      aria-label={c.kunci === kunciHariIni ? `Hari ini, ${c.hari} ${label}` : undefined}
                    >
                      {c.isi === null ? null : (
                        <p className="num text-xs">
                          <Link
                            href={`/rapat?bulan=${bulan}&tanggal=${c.kunci}`}
                            className={`flex w-full min-h-[1.75rem] items-center justify-center font-medium underline-offset-2 hover:underline ${c.kunci === kunciHariIni ? "text-info" : c.isi.length > 0 ? "text-primary" : "text-muted-foreground"}`}
                            aria-label={`Lihat agenda tanggal ${c.hari} ${label}`}
                            aria-current={c.kunci === tanggalKunci ? "page" : undefined}
                          >
                            {c.hari}
                            {c.kunci === kunciHariIni ? " · hari ini" : ""}
                          </Link>
                        </p>
                      )}
                      {c.isi && c.isi.length > 0 ? (
                        <ul className="mt-1 flex flex-col gap-1">
                          {c.isi.slice(0, 3).map((r) => (
                            <li key={r.id} className="text-xs">
                              <Link
                                href={`/rapat?bulan=${bulan}&tanggal=${c.kunci}`}
                                className="flex w-full items-start gap-1.5 text-primary underline-offset-2 hover:underline"
                                title={`${jamText(r.tanggal_mulai)} ${r.agenda_rapat}`}
                              >
                                <span
                                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dotStatus(r.status_rapat)}`}
                                  aria-hidden="true"
                                />
                                <span className="num shrink-0 font-medium tabular-nums">{jamText(r.tanggal_mulai)}</span>
                                <span className="truncate">{r.agenda_rapat}</span>
                              </Link>
                            </li>
                          ))}
                          {c.isi.length > 3 ? (
                            <li className="num text-xs text-muted-foreground">+{c.isi.length - 3} agenda lain</li>
                          ) : null}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Saat satu tanggal dibuka, daftar akan datang tidak diulang: isinya sudah terlihat di kartu tanggal. */}
          {tanggalKunci === null ? (
            <Card aria-labelledby="judul-mendatang">
            <CardHeader>
              <CardTitle id="judul-mendatang">Agenda yang masih akan datang</CardTitle>
            </CardHeader>
            <CardContent>
              {mendatang.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <CalendarDaysIcon />
                    </EmptyMedia>
                    <EmptyTitle>Tidak ada agenda yang masih akan datang</EmptyTitle>
                    <EmptyDescription>Agenda yang sudah lewat tercatat pada tabel di bawah.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="flex flex-col gap-3">
                  {mendatang.map((r) => (
                    <BarisAgenda
                      key={r.id}
                      id={r.id}
                      agenda={r.agenda_rapat}
                      mulai={r.tanggal_mulai}
                      selesai={r.tanggal_selesai}
                      tempat={r.tempat}
                      penyelenggara={r.penyelenggara}
                      catatan={r.catatan}
                      bulan={bulan}
                      tanggal={tanggalKunci ?? tanggalBerjalan()}
                      suratId={r.surat_id}
                      nomorAgenda={r.nomor_agenda}
                      terbit={r.terbit}
                      dibuatOleh={r.dibuat_oleh}
                      statusRapat={r.status_rapat}
                      statusSurat={r.status_surat}
                      pesertaNama={r.peserta}
                      bolehUbah={(bolehUbah || milikSendiri(r)) && r.status_surat !== "arsip"}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          ) : null}

          <Card aria-labelledby="judul-catatan">
            <CardHeader>
              <CardTitle id="judul-catatan">Agenda yang sudah lewat</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pelaksanaan.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">Belum ada agenda yang telah berlalu.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Jam</TableHead>
                      <TableHead>Agenda</TableHead>
                      <TableHead>Tempat</TableHead>
                      <TableHead>Sumber</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pelaksanaan.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">{tanggal(r.tanggal_mulai)}</TableCell>
                        <TableCell className="num whitespace-nowrap">
                          {jamText(r.tanggal_mulai)}
                          {r.tanggal_selesai ? ` – ${jamText(r.tanggal_selesai)}` : ""}
                        </TableCell>
                        <TableCell>{r.agenda_rapat}</TableCell>
                        <TableCell>{r.tempat ?? "-"}</TableCell>
                        <TableCell>
                          {r.surat_id && r.nomor_agenda ? (
                            <Link href={`/surat/${r.surat_id}`} className="num text-primary underline underline-offset-4">
                              {r.nomor_agenda}
                            </Link>
                          ) : (
                            <span className="text-sm text-muted-foreground">agenda sendiri · {r.dibuat_oleh ?? "tidak tercatat"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tone(r.status_rapat) as BadgeVariant}>{labelStatusRapat[r.status_rapat]}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Shell>
  );

}
