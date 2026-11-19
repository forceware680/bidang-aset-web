import Link from "next/link";
import { CalendarIcon, RotateCwIcon, SaveIcon, TrashIcon } from "lucide-react";
import { bolehMengubah, requireUser } from "@/lib/auth";
import { daftarAkunPeserta } from "@/lib/akun";
import { prisma } from "@/lib/db";
import { Shell } from "@/components/shell";
import { DisposisiForm } from "@/components/disposisi-form";
import { DisposisiEditForm } from "@/components/disposisi-edit-form";
import { SuratEditForm } from "@/components/surat-edit-form";
import { HapusKonfirmasi } from "@/components/hapus-konfirmasi";
import { TombolKembali } from "@/components/tombol-kembali";
import { AksiForm } from "@/components/aksi-form";
import { LampiranForm } from "@/components/lampiran-form";
import { LampiranItem } from "@/components/lampiran-item";
import { PesertaForm } from "@/components/peserta-form";
import { SectionNav } from "@/components/section-nav";
import { BilahLangkah } from "@/components/bilah-langkah";
import { Kronologi, Langkah } from "@/components/kronologi";
import { NavLangkah } from "@/components/nav-langkah";
import { PesertaItem } from "@/components/peserta-item";
import { RapatSuratForm } from "@/components/rapat-surat-form";
import { StatusPilih } from "@/components/status-pilih";
import { ToastKuer } from "@/components/toast-kuer";
import { hapusAgendaDariSurat, jadwalkanUlang, ubahDetailRapat, ubahStatusRapat } from "@/lib/actions/rapat";
import { sinkronkanRapatLewatWaktu } from "@/lib/rapat-waktu";
import { simpanStatusUndangan, arsipkanSurat, pulihkanSurat, hapusSuratKeras } from "@/lib/actions/surat";
import { hapusLampiran } from "@/lib/actions/lampiran";
import { hapusPeserta } from "@/lib/actions/peserta";
import { hapusDisposisi } from "@/lib/actions/disposisi";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { labelStatusRapat, labelStatusSurat, labelTindakLanjut, labelUndangan, opsiStatusRapat, teksInstruksi, tanpaInstruksi, tone } from "@/lib/status";
import { tanggal, tanggalJamText, ukuranFile, jenisBerkas, isoHari } from "@/lib/format";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

/** Bagian agenda yang masih kosong, dinyatakan sebagai chip supaya yang perlu diisi terlihat seketika. */
function agendaKurang(r: { tempat: string | null; penyelenggara: string | null }): string[] {
  const kurang: string[] = [];
  if (!r.tempat) kurang.push("Tempat belum diisi");
  if (!r.penyelenggara) kurang.push("Penyelenggara belum diisi");
  return kurang;
}

export default async function SuratDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  await sinkronkanRapatLewatWaktu();
  const { id } = await params;
  const sp = await searchParams;

  let galat = "";
  const surat = await prisma.surat_masuk
    .findUnique({
      where: { id },
      include: {
        jenis_surat: { select: { nama: true } },
        created_by_user: { select: { name: true } },
        disposisi: { orderBy: { tanggal_disposisi: "asc" } },
        lampiran_surat: {
          include: { users: { select: { name: true } } },
          orderBy: { created_at: "desc" },
        },
        jadwal_rapat: {
          include: {
            riwayat_jadwal_rapat: { orderBy: { changed_at: "desc" } },
            peserta_rapat: { orderBy: { nama_peserta: "asc" } },
          },
          orderBy: { tanggal_mulai: "asc" },
        },
      },
    })
    .catch((e: unknown) => {
      galat = e instanceof Error ? e.message : "Server data belum bisa dihubungi.";
      return null;
    });

  // Daftar resmi untuk form disposisi: pejabat pemberi dan tujuan penerusan.
  const bolehTulis = bolehMengubah(user.role);
  const pejabat = bolehTulis ? (await prisma.master_pejabat.findMany({ where: { aktif: true }, orderBy: { nama: "asc" } })).map((m) => m.nama) : [];
  // Daftar peserta autocomplete: hanya nama yang punya akun aplikasi aktif, karena agenda
  // hanya bisa muncul di HP orang yang bisa masuk aplikasi Android.
  const daftarPegawai =
    bolehTulis && surat ? await daftarAkunPeserta() : [];
  const terusan = bolehTulis
    ? (await prisma.master_terusan.findMany({ where: { aktif: true }, orderBy: [{ jenis: "asc" }, { nama: "asc" }] })).map((m) => m.nama)
    : [];

  const pesan = pesanDariQuery(sp);
  // Halaman asal ditentukan lewat ?dari=… (ditulis tautan daftar asal; tanda() ikut menyalurkannya
  // antar langkah), jadi tombol kembali dan Selesai mengarah ke daftar yang benar.
  const asal = sp.dari === "disposisi"
    ? { href: "/disposisi", label: "Kembali ke daftar disposisi" }
    : { href: "/surat", label: "Kembali ke daftar surat masuk" };
  const kembali = <TombolKembali href={asal.href} label={asal.label} />;

  if (galat) {
    return (
      <Shell user={user} aktif="surat" judul="Detail surat" aksi={kembali}>
        <Alert variant="destructive">
          <AlertDescription>Detail surat gagal dimuat: {galat}</AlertDescription>
        </Alert>
      </Shell>
    );
  }

  if (!surat || surat.deleted_at) {
    return (
      <Shell user={user} aktif="surat" judul="Detail surat" aksi={kembali}>
        <Alert>
          <AlertDescription>
            Surat dengan id <span className="num">{id}</span> tidak ditemukan.
          </AlertDescription>
        </Alert>
      </Shell>
    );
  }

  const bolehKelola = bolehMengubah(user.role);
  // Surat yang diarsipkan tertutup: isinya tidak diubah sampai dikeluarkan dari arsip.
  const tertutup = surat.status_surat === "arsip";
  const bolehUbah = bolehKelola && !tertutup;

  // Daftar resmi untuk form koreksi identitas: pengirim dan kategori surat. Kategori yang masih dipakai surat ini
  // tetap masuk walau sudah dinonaktifkan, supaya nilai lama tidak hilang dari pilihan.
  const ubahIdentitas = bolehKelola && !tertutup && sp.surat === "ubah";
  const pengirimUbah = ubahIdentitas
    ? [...new Set([surat.pengirim, ...(await prisma.master_pengirim.findMany({ where: { aktif: true }, orderBy: { nama: "asc" } })).map((m) => m.nama)])]
    : [];
  const kategoriUbah = ubahIdentitas
    ? [
        ...(await prisma.jenis_surat.findMany({ where: { aktif: true }, orderBy: { nama: "asc" } })),
        ...(surat.jenis_surat_id && !(await prisma.jenis_surat.findFirst({ where: { id: surat.jenis_surat_id, aktif: true } }))
          ? await prisma.jenis_surat.findMany({ where: { id: surat.jenis_surat_id } })
          : []),
      ]
    : [];

  // Mode ubah disposisi: satu langkah dipilih lewat URL (?disposisi=ubah&id=…), jadi refresh dan tautan
  // tetap membuka form yang sama tanpa state client.
  const disposisiUbah =
    bolehUbah && sp.disposisi === "ubah" && typeof sp.id === "string"
      ? (surat.disposisi.find((d) => d.id === sp.id) ?? null)
      : null;
  // Nama yang sudah tersimpan tetap bisa dipilih walau tidak ada di daftar resmi.
  const pejabatUbah = disposisiUbah ? [...new Set([disposisiUbah.pemberi_disposisi, ...pejabat])] : pejabat;
  const terusanUbah = disposisiUbah?.penerima_disposisi
    ? [...new Set([disposisiUbah.penerima_disposisi, ...terusan])]
    : terusan;

  // Nomor langkah kronologi mengikuti bagian yang benar-benar tampil, supaya nomornya tidak loncat.
  const adaRapat = surat.jadwal_rapat.length > 0 || surat.status_undangan_rapat === "ya";
  const nomorLangkah = new Map(
    [
      { id: "bagian-identitas", tampil: true },
      { id: "bagian-dokumen", tampil: true },
      { id: "bagian-undangan", tampil: bolehUbah },
      { id: "bagian-disposisi", tampil: true },
      { id: "bagian-rapat", tampil: adaRapat },
      { id: "bagian-pengelolaan", tampil: bolehKelola },
    ]
      .filter((l) => l.tampil)
      .map((l, i) => [l.id, i + 1]),
  );

  const bagianSurat = [
    { id: "bagian-identitas", label: "Identitas surat", nomor: nomorLangkah.get("bagian-identitas") },
    ...(ubahIdentitas ? [{ id: "bagian-ubah-identitas", label: "Ubah identitas" }] : []),
    { id: "bagian-dokumen", label: "Dokumen", jumlah: surat.lampiran_surat.length, nomor: nomorLangkah.get("bagian-dokumen") },
    ...(bolehUbah ? [{ id: "bagian-undangan", label: "Kaitan agenda", nomor: nomorLangkah.get("bagian-undangan") }] : []),
    { id: "bagian-disposisi", label: "Disposisi", jumlah: surat.disposisi.length, nomor: nomorLangkah.get("bagian-disposisi") },
    ...(disposisiUbah ? [{ id: "bagian-ubah-disposisi", label: "Ubah disposisi" }] : []),
    ...(bolehUbah && !disposisiUbah ? [{ id: "bagian-tambah-disposisi", label: "Tambah disposisi" }] : []),
    ...(adaRapat ? [{ id: "bagian-rapat", label: "Agenda", jumlah: surat.jadwal_rapat.length, nomor: nomorLangkah.get("bagian-rapat") }] : []),
    ...(bolehKelola ? [{ id: "bagian-pengelolaan", label: "Pengelolaan surat", nomor: nomorLangkah.get("bagian-pengelolaan") }] : []),
  ];

  // Mode langkah demi langkah (bawaan): satu bagian tampil per layar. ?semua=1 menampilkan semuanya,
  // termasuk saat dicetak — lembar cetak tidak boleh kehilangan bagian.
  const daftarLangkah = bagianSurat
    .filter((b) => b.nomor !== undefined)
    .map((b) => ({ id: b.id, label: b.label, jumlah: b.jumlah }));
  const semuaBagian = sp.semua === "1";
  // Tautan mode ubah membuka langkah yang panelnya memang sedang diisi (?surat=ubah → identitas,
  // ?disposisi=ubah → disposisi), supaya form tidak tersembunyi di langkah lain.
  // ?bagian=<nama> membuka langkah itu langsung (nomor langkah berubah-ubah per surat, jadi tujuan
  // dinyatakan dengan nama bagian, bukan angka): dipakai tautan No. Agenda dari halaman Disposisi.
  const bagianTujuan: Record<string, string> = {
    identitas: "bagian-identitas",
    dokumen: "bagian-dokumen",
    undangan: "bagian-undangan",
    disposisi: "bagian-disposisi",
    rapat: "bagian-rapat",
    pengelolaan: "bagian-pengelolaan",
  };
  const langkahParam =
    sp.disposisi === "ubah"
      ? nomorLangkah.get("bagian-disposisi")
      : sp.surat === "ubah"
        ? nomorLangkah.get("bagian-identitas")
        : typeof sp.bagian === "string"
          ? nomorLangkah.get(bagianTujuan[sp.bagian] ?? "")
          : undefined;
  const langkahAktif = semuaBagian
    ? 0
    : Math.min(Math.max(Number(sp.langkah) || (langkahParam ?? 1), 1), daftarLangkah.length);

  function tanda(nomorTujuan: number) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "langkah" && k !== "semua") q.set(k, v);
    const bagianId = daftarLangkah[nomorTujuan - 1]?.id ?? "";
    q.set("langkah", String(nomorTujuan));
    return `/surat/${id}${q.size ? `?${q}` : ""}${bagianId ? `#${bagianId}` : ""}`;
  }
  const hrefSemua = (() => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "langkah" && k !== "semua") q.set(k, v);
    q.set("semua", "1");
    return `/surat/${id}${q.size ? `?${q}` : ""}`;
  })();
  const langkahLangkah = daftarLangkah.map((l, i) => ({ ...l, href: tanda(i + 1) }));
  const tampilLangkah = (bagianId: string) => semuaBagian || nomorLangkah.get(bagianId) === langkahAktif;
  // Berikutnya/Sebelumnya diletakkan di bawah bagian yang sedang dibuka, bukan di bilah atas.
  const langkahSebelum = langkahAktif > 1 ? { href: langkahLangkah[langkahAktif - 2].href, label: langkahLangkah[langkahAktif - 2].label } : undefined;
  const langkahBerikut = langkahAktif < daftarLangkah.length ? { href: langkahLangkah[langkahAktif].href, label: langkahLangkah[langkahAktif].label } : undefined;
  // Langkah terakhir = akhir perjalanan surat: tombol Selesai mengarah balik ke daftar asal.
  const selesai = !semuaBagian && langkahAktif === daftarLangkah.length ? { href: asal.href, label: "Selesai" } : undefined;

  const rapatAktif = surat.jadwal_rapat.filter((r) => r.status_rapat !== "dibatalkan");
  const langkahBelum = surat.disposisi.filter((d) => d.status_tindak_lanjut === "belum" || d.status_tindak_lanjut === "proses").length;
  const jumlahPeserta = surat.jadwal_rapat.reduce((n, r) => n + r.peserta_rapat.length, 0);

  // Yang masih menghalangi arsip dan penghapusan, dinyatakan di UI sebelum tombol bisa dipakai.
  const halangArsip: string[] = [];
  if (langkahBelum > 0) halangArsip.push(`${langkahBelum} langkah disposisi belum selesai`);
  if (rapatAktif.length > 0) halangArsip.push(`${rapatAktif.length} agenda masih aktif`);
  const halangHapus: string[] = [];
  if (surat.lampiran_surat.length > 0) halangHapus.push(`hapus ${surat.lampiran_surat.length} lampiran dulu`);
  if (surat.disposisi.length > 0) halangHapus.push(`hapus ${surat.disposisi.length} langkah disposisi dulu`);
  if (surat.jadwal_rapat.length > 0)
    halangHapus.push(`hapus ${surat.jadwal_rapat.length} agenda dulu${jumlahPeserta > 0 ? ` beserta ${jumlahPeserta} pesertanya` : ""}`);

  return (
    <Shell user={user} aktif="surat" judul={`${surat.nomor_agenda} — ${surat.perihal}`} aksi={kembali}>
      {pesan ? <ToastKuer teks={pesan.teks} nada={pesan.nada} /> : null}


      {semuaBagian ? (
        <SectionNav bagian={bagianSurat} langkahHref={langkahLangkah[0]?.href} />
      ) : (
        <BilahLangkah daftar={langkahLangkah} aktif={langkahAktif} hrefSemua={hrefSemua} />
      )}

      <NavLangkah sebelum={semuaBagian ? undefined : langkahSebelum} berikutnya={semuaBagian ? undefined : langkahBerikut} selesai={semuaBagian ? undefined : selesai}>
      <Kronologi>
      <Langkah nomor={nomorLangkah.get("bagian-identitas")!} id="bagian-identitas" tertutup={!tampilLangkah("bagian-identitas")}>
      <Card aria-labelledby="identitas">
        <CardHeader>
          <CardTitle id="identitas">Identitas surat</CardTitle>
          <CardAction>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={tone(surat.status_surat) as BadgeVariant}>{labelStatusSurat[surat.status_surat]}</Badge>
              <Badge variant={tone(surat.status_undangan_rapat) as BadgeVariant}>{labelUndangan[surat.status_undangan_rapat]}</Badge>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-y-3 sm:grid-cols-2">
            <Baris label="Tanggal terima" nilai={tanggal(surat.tanggal_terima)} />
            <Baris label="Pengirim" nilai={surat.pengirim} />
            <Baris label="Nomor surat" nilai={surat.nomor_surat ?? "-"} num />
            <Baris label="Tanggal surat" nilai={tanggal(surat.tanggal_surat)} />
            <Baris label="Kategori surat" nilai={surat.jenis_surat?.nama ?? "Belum ditentukan"} />
            <Baris label="Dicatat oleh" nilai={surat.created_by_user?.name ?? "Tidak tercatat"} />
          </dl>
          {surat.isi_ringkas ? <p className="mt-3 text-sm leading-normal">{surat.isi_ringkas}</p> : null}
        </CardContent>
      </Card>
      {ubahIdentitas ? (
        <div id="bagian-ubah-identitas" tabIndex={-1} className="mt-4 scroll-mt-28">
          <SuratEditForm
            suratId={id}
            nomorAgenda={surat.nomor_agenda}
            awal={{
              tanggal_terima: isoHari(surat.tanggal_terima),
              pengirim: surat.pengirim,
              nomor_surat: surat.nomor_surat ?? "",
              tanggal_surat: isoHari(surat.tanggal_surat),
              perihal: surat.perihal,
              isi_ringkas: surat.isi_ringkas ?? "",
              jenis_surat_id: surat.jenis_surat_id ?? "",
            }}
            kategori={kategoriUbah}
            pengirim={pengirimUbah}
          />
        </div>
      ) : null}
      </Langkah>

      <Langkah nomor={nomorLangkah.get("bagian-dokumen")!} id="bagian-dokumen" tertutup={!tampilLangkah("bagian-dokumen")}>
      <Card aria-labelledby="dokumen">
        <CardHeader>
          <CardTitle id="dokumen">Dokumen surat</CardTitle>
          <CardDescription>
            {surat.lampiran_surat.length === 0
              ? "Belum ada lampiran untuk surat ini."
              : `${surat.lampiran_surat.length} lampiran. Unduh memakai nama asli berkas.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {surat.lampiran_surat.length > 0 ? (
            <div className="mb-4">
              {surat.lampiran_surat.map((l) => (
                <LampiranItem
                  key={l.id}
                  id={l.id}
                  suratId={surat.id}
                  nama={l.nama_asli}
              meta={`${ukuranFile(l.ukuran_byte)} · ${jenisBerkas(l.mime_type)} · diunggah ${tanggalJamText(l.created_at)} oleh ${l.users?.name ?? "tidak tercatat"}`}
                  bolehUbah={bolehUbah}
                  hapusAction={hapusLampiran}
                />
              ))}
            </div>
          ) : null}
          {bolehUbah ? <LampiranForm suratId={surat.id} /> : null}
        </CardContent>
      </Card>
      </Langkah>

      {bolehUbah ? (
        <Langkah nomor={nomorLangkah.get("bagian-undangan")!} id="bagian-undangan" tertutup={!tampilLangkah("bagian-undangan")}>
        <Card aria-labelledby="undangan" variant="inset">
          <CardHeader>
            <CardTitle id="undangan">Kaitan surat dengan agenda</CardTitle>
            <CardDescription>
              Surat yang masih punya agenda aktif tidak bisa diubah menjadi tanpa agenda. Database menolak
              perubahan tersebut.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full">
              <FieldGroup className="flex flex-row flex-wrap items-end gap-4">
                <Field className="w-full sm:w-auto">
                  <FieldLabel htmlFor="status_undangan_rapat">Pilihan</FieldLabel>
                  {/* Pilihan langsung disimpan — tidak ada tombol simpan lagi. */}
                  <StatusPilih
                    aksi={simpanStatusUndangan}
                    nama="status_undangan_rapat"
                    nilai={surat.status_undangan_rapat}
                    id="status_undangan_rapat"
                    kelas="w-[13.5rem]"
                    disabled={tertutup}
                    tambahan={{ surat_id: id }}
                    label="Kaitan surat dengan agenda"
                    opsi={Object.entries(labelUndangan).map(([kode, label]) => ({ kode, label }))}
                  />
                </Field>
              </FieldGroup>
            </div>
          </CardContent>
        </Card>
        </Langkah>
      ) : null}

      <Langkah nomor={nomorLangkah.get("bagian-disposisi")!} id="bagian-disposisi" tertutup={!tampilLangkah("bagian-disposisi")}>
      <Card aria-labelledby="disposisi">
        <CardHeader>
          <CardTitle id="disposisi">Riwayat disposisi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {surat.disposisi.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Surat ini belum pernah didisposisikan.</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 p-4 md:hidden">
                {surat.disposisi.map((d) => (
                  <div key={d.id} className="rounded-xl border border-(--border)/50 p-3">
                    <p className="text-sm text-muted-foreground">{tanggal(d.tanggal_disposisi)} · {d.pemberi_disposisi}</p>
                    <p className={tanpaInstruksi(d.isi_disposisi) ? "mt-1 text-sm text-muted-foreground" : "mt-1 text-sm"}>{teksInstruksi(d.isi_disposisi)}</p>
                    {d.catatan ? <p className="text-sm text-muted-foreground">{d.catatan}</p> : null}
                    {d.penerima_disposisi ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Diteruskan ke {d.penerima_disposisi}
                        {d.tanggal_diteruskan ? ` pada ${tanggal(d.tanggal_diteruskan)}` : ""}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant={tone(d.status_tindak_lanjut) as BadgeVariant}>{labelTindakLanjut[d.status_tindak_lanjut]}</Badge>
                    </div>
                    {bolehUbah ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/surat/${id}?disposisi=ubah&id=${d.id}`}>Ubah langkah ini</Link>
                        </Button>
                        <AksiForm aksi={hapusDisposisi} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="surat_id" value={id} />
                          <Button size="sm" variant="outline" type="submit" aria-label={`Hapus disposisi ${tanggal(d.tanggal_disposisi)}`}>
                            <TrashIcon data-icon="inline-start" />
                            Hapus langkah ini
                          </Button>
                        </AksiForm>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="hidden border-t border-(--border) pt-4 md:block md:overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Instruksi</TableHead>
                      <TableHead>Diteruskan ke</TableHead>
                      <TableHead>Tindak lanjut</TableHead>
                      {bolehUbah ? <TableHead className="text-right">Aksi</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {surat.disposisi.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="whitespace-nowrap">{tanggal(d.tanggal_disposisi)}</TableCell>
                        <TableCell>
                          <p className={tanpaInstruksi(d.isi_disposisi) ? "max-w-[24rem] truncate text-muted-foreground" : "max-w-[24rem] truncate"} title={teksInstruksi(d.isi_disposisi)}>{teksInstruksi(d.isi_disposisi)}</p>
                          <p className="text-xs text-muted-foreground">dari {d.pemberi_disposisi}</p>
                          {d.catatan ? <p className="max-w-[24rem] truncate text-xs text-muted-foreground" title={d.catatan}>{d.catatan}</p> : null}
                        </TableCell>
                        <TableCell>
                          {d.penerima_disposisi ?? "-"}
                          {d.tanggal_diteruskan ? (
                            <p className="text-xs text-muted-foreground">diteruskan {tanggal(d.tanggal_diteruskan)}</p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tone(d.status_tindak_lanjut) as BadgeVariant}>{labelTindakLanjut[d.status_tindak_lanjut]}</Badge>
                        </TableCell>
                        {bolehUbah ? (
                          <TableCell className="text-right">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/surat/${id}?disposisi=ubah&id=${d.id}`} aria-label={`Ubah disposisi ${tanggal(d.tanggal_disposisi)}`}>Ubah</Link>
                              </Button>
                              <AksiForm aksi={hapusDisposisi} className="flex items-center gap-2">
                                <input type="hidden" name="id" value={d.id} />
                                <input type="hidden" name="surat_id" value={id} />
                                <Button size="sm" variant="outline" type="submit" aria-label={`Hapus disposisi ${tanggal(d.tanggal_disposisi)}`}>Hapus</Button>
                              </AksiForm>
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {disposisiUbah ? (
        <div id="bagian-ubah-disposisi" tabIndex={-1} className="mt-4 scroll-mt-28">
          <DisposisiEditForm
            suratId={id}
            disposisiId={disposisiUbah.id}
            awal={{
              tanggal_disposisi: isoHari(disposisiUbah.tanggal_disposisi),
              pemberi_disposisi: disposisiUbah.pemberi_disposisi,
              penerima_disposisi: disposisiUbah.penerima_disposisi ?? "",
              tanggal_diteruskan: isoHari(disposisiUbah.tanggal_diteruskan),
              isi_disposisi: disposisiUbah.isi_disposisi,
              catatan: disposisiUbah.catatan ?? "",
              status_tindak_lanjut: disposisiUbah.status_tindak_lanjut,
            }}
            pejabat={pejabatUbah}
            terusan={terusanUbah}
            batalHref={`/surat/${id}`}
          />
        </div>
      ) : null}

      {/* Saat sebuah langkah sedang diubah, form tambah tidak ditampilkan — kalau ada dua form
          sekaligus (ubah di atas, tambah di bawah) layarnya jadi jelek dan membingungkan. */}
      {bolehUbah && !disposisiUbah ? (
        <div id="bagian-tambah-disposisi" tabIndex={-1} className="mt-4 scroll-mt-28">
          <DisposisiForm suratId={id} pejabat={pejabat} terusan={terusan} />
        </div>
      ) : null}
      </Langkah>

      {/* Bagian agenda hanya muncul bila surat memang terkait agenda: ada agenda yang tercatat, atau surat
          ditandai memiliki agenda tapi agendanya belum dicatat. */}
      {adaRapat ? (
      <Langkah nomor={nomorLangkah.get("bagian-rapat")!} id="bagian-rapat" tertutup={!tampilLangkah("bagian-rapat")}>
      <Card aria-labelledby="agenda-surat">
        <CardHeader>
          <CardTitle id="agenda-surat">Agenda terkait surat ini</CardTitle>
        </CardHeader>
        <CardContent>
          {surat.jadwal_rapat.length === 0 ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Surat ini ditetapkan memiliki agenda, tetapi agendanya belum dicatat.</p>
              {bolehUbah ? <RapatSuratForm suratId={surat.id} /> : null}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {surat.jadwal_rapat.map((r) => (
                <div key={r.id} className="flex flex-col gap-4">
                  {/* Judul, waktu, dan status dalam satu baris: status agenda adalah keadaan, bukan aksi yang terpisah. */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 max-w-[62ch]">
                      <p className="font-heading text-base font-semibold text-balance">{r.agenda_rapat}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        <span className="num">{tanggalJamText(r.tanggal_mulai)}</span>
                        {r.tanggal_selesai ? ` s/d ${tanggalJamText(r.tanggal_selesai)}` : ""}
                        {r.tempat ? ` di ${r.tempat}` : ""}
                        {r.penyelenggara ? ` diselenggarakan ${r.penyelenggara}` : ""}
                      </p>
                      {agendaKurang(r).length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {agendaKurang(r).map((k) => (
                            <Badge key={k} variant="warning">{k}</Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="w-full shrink-0 md:w-auto">
                      {bolehUbah ? (
                        <StatusPilih
                          aksi={ubahStatusRapat}
                          nama="status_rapat"
                          nilai={r.status_rapat}
                          id={`status-${r.id}`}
                          kelas="w-full md:w-[13rem]"
                          bertint
                          tambahan={{ id: r.id, surat_id: id }}
                          label="Ubah status agenda"
                          opsi={opsiStatusRapat({ tanggal_mulai: r.tanggal_mulai, tanggal_selesai: r.tanggal_selesai }, r.status_rapat).map((kode) => ({ kode, label: labelStatusRapat[kode] }))}
                        />
                      ) : (
                        <Badge variant={tone(r.status_rapat) as BadgeVariant}>{labelStatusRapat[r.status_rapat]}</Badge>
                      )}
                    </div>
                  </div>

                  <Card variant="inset" size="sm" aria-labelledby={`peserta-${r.id}`}>
                    <CardHeader>
                      <CardTitle id={`peserta-${r.id}`}>Peserta agenda</CardTitle>
                      <CardAction>
                        <Badge variant="secondary" className="num">{r.peserta_rapat.length}</Badge>
                      </CardAction>
                      <CardDescription>Nama peserta diambil dari pejabat/pegawai yang punya akun aplikasi — agenda hanya tampil di HP peserta yang berakun.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      {r.peserta_rapat.length === 0 ? (
                        <FieldDescription>Belum ada peserta dicatat untuk agenda ini.</FieldDescription>
                      ) : (
                        <div>
                          {r.peserta_rapat.map((p) => (
                            <PesertaItem
                              key={p.id}
                              id={p.id}
                              suratId={surat.id}
                              nama={p.nama_peserta}
                              instansi={p.instansi_bidang}
                              keterangan={p.keterangan}
                              bolehUbah={bolehUbah}
                              hapusAction={hapusPeserta}
                            />
                          ))}
                        </div>
                      )}
                      {bolehUbah ? (
                        <>
                          <Separator className="bg-border/70" />
                          <PesertaForm rapatId={r.id} suratId={surat.id} daftarPegawai={daftarPegawai} />
                        </>
                      ) : null}
                    </CardContent>
                  </Card>

                  {bolehUbah ? (
                    <Card variant="inset" size="sm" aria-labelledby={`detail-${r.id}`}>
                      <CardHeader>
                        <CardTitle id={`detail-${r.id}`}>Tempat dan penyelenggara</CardTitle>
                        <CardDescription>Isian boleh dikosongkan untuk menghapus keterangan yang salah.</CardDescription>
                      </CardHeader>
                      <AksiForm aksi={ubahDetailRapat} pesanSukses="Tempat dan penyelenggara agenda diperbarui." className="flex flex-col gap-(--card-spacing)">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="surat_id" value={id} />
                        <CardContent>
                          <FieldGroup className="grid gap-4 lg:grid-cols-2">
                            <Field>
                              <FieldLabel htmlFor={`tempat-${r.id}`}>Tempat agenda</FieldLabel>
                              <Input id={`tempat-${r.id}`} name="tempat" defaultValue={r.tempat ?? ""} placeholder="Ruang Rapat A" />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor={`penyelenggara-${r.id}`}>Penyelenggara</FieldLabel>
                              <Input id={`penyelenggara-${r.id}`} name="penyelenggara" defaultValue={r.penyelenggara ?? ""} placeholder="BPKAD" />
                            </Field>
                          </FieldGroup>
                        </CardContent>
                        <CardFooter className="border-t">
                          <Button size="sm" type="submit">
                            <SaveIcon data-icon="inline-start" />
                            Simpan tempat dan penyelenggara
                          </Button>
                        </CardFooter>
                      </AksiForm>
                    </Card>
                  ) : null}

                  {bolehUbah ? (
                    <Card variant="inset" size="sm" aria-labelledby={`jadwal-${r.id}`}>
                      <CardHeader>
                        <CardTitle id={`jadwal-${r.id}`}>Jadwalkan ulang agenda</CardTitle>
                        <CardDescription>Waktu baru dipakai sejak disimpan; waktu lama tercatat sebagai riwayat perubahan jadwal.</CardDescription>
                      </CardHeader>
                      <AksiForm aksi={jadwalkanUlang} pesanSukses="Jadwal agenda diperbarui dan perubahan lama tercatat." className="flex flex-col gap-(--card-spacing)">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="surat_id" value={id} />
                        <CardContent>
                          <FieldGroup className="grid gap-4 lg:grid-cols-2">
                            <Field>
                              <FieldLabel htmlFor={`baru-${r.id}`}>Waktu mulai baru</FieldLabel>
                              <Input className="num" id={`baru-${r.id}`} name="tanggal_mulai_baru" type="datetime-local" />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor={`alasan-${r.id}`}>Alasan perubahan</FieldLabel>
                              <Input id={`alasan-${r.id}`} name="alasan_perubahan" placeholder="misal: pemda mengubah jadwal" />
                            </Field>
                          </FieldGroup>
                        </CardContent>
                        <CardFooter className="border-t">
                          <Button size="sm" variant="outline" type="submit">
                            <CalendarIcon data-icon="inline-start" />
                            Jadwalkan ulang
                          </Button>
                        </CardFooter>
                      </AksiForm>
                    </Card>
                  ) : null}

                  {r.riwayat_jadwal_rapat.length > 0 ? (
                    <Accordion type="single" collapsible className="border-border/70 bg-input/20">
                      <AccordionItem value={`riwayat-${r.id}`} className="border-b-0">
                        <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                          Riwayat perubahan jadwal ({r.riwayat_jadwal_rapat.length})
                        </AccordionTrigger>
                        <AccordionContent className="px-3">
                          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                            {r.riwayat_jadwal_rapat.map((h) => (
                              <li key={h.id}>
                                <span className="num">{tanggalJamText(h.tanggal_mulai_lama)}</span> dipindah ke{" "}
                                <span className="num">{tanggalJamText(h.tanggal_mulai_baru)}</span> karena {h.alasan_perubahan ?? "tanpa alasan"}
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  ) : null}

                  {bolehUbah ? (
                    <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-3">
                      <HapusKonfirmasi
                        judul={`Hapus agenda ${r.agenda_rapat}?`}
                        keterangan={
                          r.peserta_rapat.length > 0
                            ? `Agenda ini hilang dari surat ini beserta ${r.peserta_rapat.length} peserta yang tercatat dan riwayat perubahan jadwalnya. Penghapusan tidak bisa dibatalkan.`
                            : "Agenda ini hilang dari surat ini, beserta riwayat perubahan jadwalnya. Penghapusan tidak bisa dibatalkan."
                        }
                        labelTrigger="Hapus agenda ini"
                        labelKonfirmasi="Hapus agenda"
                        aksi={hapusAgendaDariSurat}
                        hidden={{ id: r.id, surat_id: surat.id }}
                      />
                      <p className="text-xs text-muted-foreground">Hapus agenda hanya bila memang salah dicatat.</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </Langkah>
      ) : null}

      {bolehKelola ? (
        <Langkah nomor={nomorLangkah.get("bagian-pengelolaan")!} id="bagian-pengelolaan" tertutup={!tampilLangkah("bagian-pengelolaan")}>
        <Card aria-labelledby="pengelolaan" variant="inset">
          <CardHeader>
            <CardTitle id="pengelolaan">Pengelolaan surat ini</CardTitle>
            <CardDescription>
              Mengoreksi identitas surat, mengarsipkan surat yang sudah selesai, dan menghapus surat secara permanen.
              Penghapusan permanen baru bisa dilakukan setelah lampiran, langkah disposisi, dan agenda rapatnya dibersihkan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              {tertutup ? null : (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/surat/${id}?surat=ubah`}>Ubah identitas surat</Link>
                </Button>
              )}
              {surat.status_surat === "arsip" ? (
                <AksiForm aksi={pulihkanSurat} className="flex items-center gap-2">
                  <input type="hidden" name="surat_id" value={id} />
                  <Button size="sm" variant="outline" type="submit">
                    <RotateCwIcon data-icon="inline-start" />
                    Keluarkan dari arsip
                  </Button>
                </AksiForm>
              ) : (
                <AksiForm aksi={arsipkanSurat} className="flex items-center gap-2">
                  <input type="hidden" name="surat_id" value={id} />
                  <Button size="sm" variant="outline" type="submit" disabled={halangArsip.length > 0}>
                    Arsipkan surat
                  </Button>
                </AksiForm>
              )}
              <HapusKonfirmasi
                judul={`Hapus surat ${surat.nomor_agenda} secara permanen?`}
                keterangan={
                  halangHapus.length > 0
                    ? `Belum bisa dihapus: ${halangHapus.join(", ")}.`
                    : "Catatan surat hilang dari daftar agenda. Jejak perubahannya tetap tersimpan di pengaturan. Tindakan ini tidak bisa dibatalkan."
                }
                labelTrigger="Hapus surat"
                labelKonfirmasi="Hapus permanen"
                aksi={hapusSuratKeras}
                hidden={{ surat_id: id }}
                arahSetelah="/surat"
              />
            </div>
            {halangArsip.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Belum bisa diarsipkan: {halangArsip.join(", ")}.</p>
            ) : null}
            {halangHapus.length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">Belum bisa dihapus permanen: {halangHapus.join(", ")}.</p>
            ) : null}
            {tertutup ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Surat diarsipkan: identitas, lampiran, disposisi, dan agenda rapatnya tidak bisa diubah sampai surat
                dikeluarkan dari arsip.
              </p>
            ) : null}
          </CardContent>
        </Card>
        </Langkah>
      ) : null}
      </Kronologi>
      </NavLangkah>
    </Shell>
  );
}

function Baris({ label, nilai, num }: { label: string; nilai: string; num?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`mt-1 font-medium ${num ? "num" : ""}`}>{nilai}</dd>
    </div>
  );
}

/**
 * Hanya hasil yang datang bersama perpindahan halaman masih dipakai alert: surat masuk baru
 * (`?ok=1`) dan agenda rapat yang dibuat dari surat (`?rapat=buat&pesan=`). Perubahan di halaman ini
 * sendiri disampaikan sebagai toast, jadi tidak ada lagi flag hasil per aksi.
 */
function pesanDariQuery(sp: { [k: string]: string | string[] | undefined }): { teks: string; nada: "sukses" | "galat" } | null {
  if (sp.ok === "1") return { teks: "Surat tersimpan dengan nomor agenda otomatis.", nada: "sukses" };
  if (sp.rapat === "buat") return { teks: sp.pesan ? String(sp.pesan) : "Agenda rapat tersimpan.", nada: "sukses" };
  return null;
}

