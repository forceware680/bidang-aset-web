import Link from "next/link";
import { RotateCwIcon, SaveIcon } from "lucide-react";
import { bolehMengubah, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Shell } from "@/components/shell";
import { KeluarEditForm } from "@/components/keluar-edit-form";
import { HapusKonfirmasi } from "@/components/hapus-konfirmasi";
import { AksiForm } from "@/components/aksi-form";
import { StatusPilih } from "@/components/status-pilih";
import { CetakButton } from "@/components/cetak-button";
import { LampiranForm } from "@/components/lampiran-form";
import { LampiranItem } from "@/components/lampiran-item";
import { BilahLangkah } from "@/components/bilah-langkah";
import { Kronologi, Langkah } from "@/components/kronologi";
import { NavLangkah } from "@/components/nav-langkah";
import { SectionNav } from "@/components/section-nav";
import { TombolKembali } from "@/components/tombol-kembali";
import { arsipkanSuratKeluar, hapusSuratKeluar, pulihkanSuratKeluar, simpanStatusKeluar } from "@/lib/actions/keluar";
import { hapusLampiranKeluar, unggahLampiranKeluar } from "@/lib/actions/lampiran";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { labelStatusSuratKeluar, tone } from "@/lib/status";
import { tanggal, tanggalJamText, ukuranFile, jenisBerkas, isoHari, isoWaktu } from "@/lib/format";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

export default async function KeluarDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;

  let galat = "";
  const surat = await prisma.surat_keluar
    .findUnique({
      where: { id },
      include: {
        jenis_surat: { select: { nama: true, arah: true } },
        surat_masuk: { select: { id: true, nomor_agenda: true, perihal: true, deleted_at: true } },
        created_by_user: { select: { name: true } },
        lampiran_keluar: {
          include: { users: { select: { name: true } } },
          orderBy: { created_at: "desc" },
        },
      },
    })
    .catch((e: unknown) => {
      galat = e instanceof Error ? e.message : "Server data belum bisa dihubungi.";
      return null;
    });

  const kembali = <TombolKembali href="/keluar" label="Kembali ke daftar surat keluar" />;

  if (galat) {
    return (
      <Shell user={user} aktif="keluar" judul="Detail surat keluar" aksi={kembali}>
        <Alert variant="destructive">
          <AlertDescription>Detail surat keluar gagal dimuat: {galat}</AlertDescription>
        </Alert>
      </Shell>
    );
  }

  if (!surat || surat.deleted_at) {
    return (
      <Shell user={user} aktif="keluar" judul="Detail surat keluar" aksi={kembali}>
        <Alert>
          <AlertDescription>
            Surat keluar dengan id <span className="num">{id}</span> tidak ditemukan.
          </AlertDescription>
        </Alert>
      </Shell>
    );
  }

  const bolehKelola = bolehMengubah(user.role);
  // Surat yang diarsipkan tertutup: isinya tidak diubah sampai dikeluarkan dari arsip.
  const tertutup = surat.status_surat === "arsip";
  const bolehUbah = bolehKelola && !tertutup;

  const ubahIdentitas = bolehKelola && !tertutup && sp.keluar === "ubah";
  // Daftar tujuan resmi + nama yang sudah tersimpan, supaya nilai lama tidak hilang dari pilihan.
  const penerimaUbah = ubahIdentitas
    ? [...new Set([surat.tujuan, ...(await prisma.master_penerima.findMany({ where: { aktif: true }, orderBy: { nama: "asc" } })).map((m) => m.nama)])]
    : [];
  const kategoriUbah = ubahIdentitas
    ? [
        ...(await prisma.jenis_surat.findMany({ where: { aktif: true, arah: "keluar" }, orderBy: { nama: "asc" } })),
        ...(surat.jenis_surat_id && !(await prisma.jenis_surat.findFirst({ where: { id: surat.jenis_surat_id, aktif: true, arah: "keluar" } }))
          ? await prisma.jenis_surat.findMany({ where: { id: surat.jenis_surat_id } })
          : []),
      ]
    : [];
  // Surat asal yang sudah ditautkan tetap bisa dipilih walau bukan surat terbaru; daftar lainnya dibatasi 60 surat.
  const asalUbah = ubahIdentitas
    ? [
        ...(surat.surat_masuk && !surat.surat_masuk.deleted_at ? [surat.surat_masuk] : []),
        ...(await prisma.surat_masuk.findMany({
          where: { deleted_at: null },
          orderBy: { tanggal_terima: "desc" },
          take: 60,
          select: { id: true, nomor_agenda: true, perihal: true },
        })).filter((s) => s.id !== surat.surat_asal_id),
      ]
    : [];

  // Nomor langkah kronologi mengikuti bagian yang benar-benar tampil, supaya nomornya tidak loncat.
  const nomorLangkah = new Map(
    [
      { id: "bagian-identitas", tampil: true },
      { id: "bagian-dokumen", tampil: true },
      { id: "bagian-status", tampil: bolehUbah },
      { id: "bagian-pengelolaan", tampil: bolehKelola },
    ]
      .filter((l) => l.tampil)
      .map((l, i) => [l.id, i + 1]),
  );

  const bagianSurat = [
    { id: "bagian-identitas", label: "Identitas surat", nomor: nomorLangkah.get("bagian-identitas") },
    ...(ubahIdentitas ? [{ id: "bagian-ubah-identitas", label: "Ubah identitas" }] : []),
    { id: "bagian-dokumen", label: "Dokumen", jumlah: surat.lampiran_keluar.length, nomor: nomorLangkah.get("bagian-dokumen") },
    ...(bolehUbah ? [{ id: "bagian-status", label: "Status surat", nomor: nomorLangkah.get("bagian-status") }] : []),
    ...(bolehKelola ? [{ id: "bagian-pengelolaan", label: "Pengelolaan surat", nomor: nomorLangkah.get("bagian-pengelolaan") }] : []),
  ];

  // Mode langkah demi langkah (bawaan): satu bagian tampil per layar. ?semua=1 menampilkan semuanya,
  // termasuk saat dicetak — lembar cetak tidak boleh kehilangan bagian.
  const daftarLangkah = bagianSurat
    .filter((b) => b.nomor !== undefined)
    .map((b) => ({ id: b.id, label: b.label, jumlah: b.jumlah }));
  const semuaBagian = sp.semua === "1";
  // Tautan mode ubah membuka langkah yang panelnya memang sedang diisi (?keluar=ubah → identitas),
  // supaya form tidak tersembunyi di langkah lain.
  const langkahParam = sp.keluar === "ubah" ? nomorLangkah.get("bagian-identitas") : undefined;
  const langkahAktif = semuaBagian
    ? 0
    : Math.min(Math.max(Number(sp.langkah) || (langkahParam ?? 1), 1), daftarLangkah.length);

  function tanda(nomorTujuan: number) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "langkah" && k !== "semua") q.set(k, v);
    const bagianId = daftarLangkah[nomorTujuan - 1]?.id ?? "";
    q.set("langkah", String(nomorTujuan));
    return `/keluar/${id}${q.size ? `?${q}` : ""}${bagianId ? `#${bagianId}` : ""}`;
  }
  const hrefSemua = (() => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "langkah" && k !== "semua") q.set(k, v);
    q.set("semua", "1");
    return `/keluar/${id}${q.size ? `?${q}` : ""}`;
  })();
  const langkahLangkah = daftarLangkah.map((l, i) => ({ ...l, href: tanda(i + 1) }));
  const tampilLangkah = (bagianId: string) => semuaBagian || nomorLangkah.get(bagianId) === langkahAktif;
  // Berikutnya/Sebelumnya berada di pinggir bagian yang sedang dibuka, bukan di bilah atas.
  const langkahSebelum = langkahAktif > 1 ? { href: langkahLangkah[langkahAktif - 2].href, label: langkahLangkah[langkahAktif - 2].label } : undefined;
  const langkahBerikut = langkahAktif < daftarLangkah.length ? { href: langkahLangkah[langkahAktif].href, label: langkahLangkah[langkahAktif].label } : undefined;
  // Langkah terakhir = akhir perjalanan surat keluar: tombol Selesai balik ke daftar surat keluar.
  const selesai = !semuaBagian && langkahAktif === daftarLangkah.length ? { href: "/keluar", label: "Selesai" } : undefined;

  const halangHapus: string[] = [];
  if (surat.lampiran_keluar.length > 0) halangHapus.push(`hapus ${surat.lampiran_keluar.length} lampiran dulu`);

  return (
    <Shell user={user} aktif="keluar" judul={`${surat.nomor_surat} — ${surat.perihal}`} aksi={kembali}>
      {sp.ok === "1" ? (
        <Alert variant="default" role="status">
          <AlertDescription>Surat keluar tersimpan dengan nomor surat otomatis bila nomor tidak diketik.</AlertDescription>
        </Alert>
      ) : null}

      {/* Kop surat hanya muncul saat dicetak; di layar judul surat sudah ada di header aplikasi. */}
      <div className="hidden flex-col items-center gap-3 border-b pb-4 text-center print:flex" aria-hidden="true">
        <img src="/logo-cetak.png" alt="" className="size-24" />
        <div>
          <p className="text-base font-semibold">BPKAD Kota Magelang</p>
          <p className="text-sm">Bidang Aset</p>
        </div>
        <p className="num text-sm">Nomor surat: {surat.nomor_surat}</p>
        <p className="text-sm">Tanggal surat: {tanggal(surat.tanggal_surat)}</p>
      </div>

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
                <CardTitle id="identitas">Identitas surat keluar</CardTitle>
                <CardAction>
                  <Badge variant={tone(surat.status_surat) as BadgeVariant}>{labelStatusSuratKeluar[surat.status_surat]}</Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-y-3 sm:grid-cols-2">
                  <Baris label="Nomor surat" nilai={surat.nomor_surat} num />
                  <Baris label="Tanggal surat" nilai={tanggal(surat.tanggal_surat)} />
                  <Baris label="Tujuan surat" nilai={surat.tujuan} />
                  <Baris label="Kategori surat" nilai={surat.jenis_surat?.nama ?? "Belum ditentukan"} />
                  <Baris
                    label="Dikirim pada"
                    nilai={surat.tanggal_kirim ? `${tanggalJamText(surat.tanggal_kirim)}${surat.status_surat === "draf" ? " — belum ditandai dikirim" : ""}` : "Belum dikirim"}
                  />
                  <Baris label="Dicatat oleh" nilai={surat.created_by_user?.name ?? "Tidak tercatat"} />
                  <Baris label="Perihal" nilai={surat.perihal} />
                  {surat.surat_masuk && !surat.surat_masuk.deleted_at ? (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Balasan dari surat masuk</dt>
                      <dd className="mt-1">
                        <Link href={`/surat/${surat.surat_masuk.id}`} className="num text-primary underline underline-offset-4">
                          {surat.surat_masuk.nomor_agenda}
                        </Link>
                        <span className="ml-2 text-sm">{surat.surat_masuk.perihal}</span>
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {surat.isi_ringkas ? <p className="mt-3 text-sm leading-normal">{surat.isi_ringkas}</p> : null}
                {surat.catatan ? <p className="mt-2 text-sm text-muted-foreground">Catatan: {surat.catatan}</p> : null}
              </CardContent>
            </Card>

            {ubahIdentitas ? (
              <div id="bagian-ubah-identitas" tabIndex={-1} className="mt-4 scroll-mt-28">
                <KeluarEditForm
                  suratId={id}
                  nomorSurat={surat.nomor_surat}
                  awal={{
                    tanggal_surat: isoHari(surat.tanggal_surat),
                    waktu_kirim: isoWaktu(surat.tanggal_kirim),
                    tujuan: surat.tujuan,
                    nomor_surat: surat.nomor_surat,
                    perihal: surat.perihal,
                    isi_ringkas: surat.isi_ringkas ?? "",
                    catatan: surat.catatan ?? "",
                    jenis_surat_id: surat.jenis_surat_id ?? "",
                    surat_asal_id: surat.surat_asal_id ?? "",
                  }}
                  kategori={kategoriUbah}
                  penerima={penerimaUbah}
                  asal={asalUbah}
                />
              </div>
            ) : null}

            {/* Surat keluar yang sudah bisa dikirim dicetak untuk ditandatangani; isinya diambil dari catatan aplikasi. */}
            <div className="hidden border-t pt-4 print:block" aria-hidden="true">
              <p className="mt-2 font-medium">{surat.perihal}</p>
              <p className="mt-3 text-sm leading-normal">{surat.isi_ringkas ?? "Isi surat tidak diringkas di aplikasi."}</p>
              {surat.catatan ? <p className="mt-2 text-sm text-muted-foreground">{surat.catatan}</p> : null}
            </div>
          </Langkah>

          <Langkah nomor={nomorLangkah.get("bagian-dokumen")!} id="bagian-dokumen" tertutup={!tampilLangkah("bagian-dokumen")}>
            <Card aria-labelledby="dokumen">
              <CardHeader>
                <CardTitle id="dokumen">Dokumen surat keluar</CardTitle>
                <CardDescription>
                  {surat.lampiran_keluar.length === 0
                    ? "Belum ada lampiran untuk surat ini."
                    : `${surat.lampiran_keluar.length} lampiran. Unduh memakai nama asli berkas.`}
                </CardDescription>
                {bolehKelola ? (
                  <CardAction>
                    <CetakButton className="tanpa-cetak" />
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent>
                {surat.lampiran_keluar.length > 0 ? (
                  <div className="mb-4">
                    {surat.lampiran_keluar.map((l) => (
                      <LampiranItem
                        key={l.id}
                        id={l.id}
                        suratId={surat.id}
                        nama={l.nama_asli}
                        meta={`${ukuranFile(l.ukuran_byte)} · ${jenisBerkas(l.mime_type)} · diunggah ${tanggalJamText(l.created_at)} oleh ${l.users?.name ?? "tidak tercatat"}`}
                        bolehUbah={bolehUbah}
                        hapusAction={hapusLampiranKeluar}
                      />
                    ))}
                  </div>
                ) : null}
                {bolehUbah ? <LampiranForm suratId={surat.id} aksi={unggahLampiranKeluar} label="Scan dokumen atau tanda tangan" /> : null}
              </CardContent>
            </Card>
          </Langkah>

          {bolehUbah ? (
            <Langkah nomor={nomorLangkah.get("bagian-status")!} id="bagian-status" tertutup={!tampilLangkah("bagian-status")}>
              <Card aria-labelledby="status" variant="inset">
                <CardHeader>
                  <CardTitle id="status">Status surat keluar</CardTitle>
                  <CardDescription>
                    Surat bergerak maju: draf → dikirim → selesai. Surat yang sudah dikirim tidak bisa kembali menjadi draf.
                    Waktu kirim dicatat otomatis saat surat ditandai dikirim; bila surat keluar pada waktu lain, tulis waktunya
                    lewat <span className="num">Ubah identitas surat</span>.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full">
                    <FieldGroup className="flex flex-row flex-wrap items-end gap-4">
                      <Field className="w-full sm:w-auto">
                        <FieldLabel htmlFor="status_surat">Pilihan</FieldLabel>
                        {/* Pilihan langsung disimpan — tidak ada tombol simpan lagi. */}
                        <StatusPilih
                          aksi={simpanStatusKeluar}
                          nama="status_surat"
                          nilai={surat.status_surat === "arsip" ? "draf" : surat.status_surat}
                          id="status_surat"
                          kelas="w-[12rem]"
                          tambahan={{ surat_id: id }}
                          label="Status surat keluar"
                          opsi={Object.entries(labelStatusSuratKeluar)
                            .filter(([kode]) => kode !== "arsip")
                            .map(([kode, label]) => ({ kode, label }))}
                        />
                      </Field>
                    </FieldGroup>
                  </div>
                </CardContent>
              </Card>
            </Langkah>
          ) : null}

          {bolehKelola ? (
            <Langkah nomor={nomorLangkah.get("bagian-pengelolaan")!} id="bagian-pengelolaan" tertutup={!tampilLangkah("bagian-pengelolaan")}>
              <Card aria-labelledby="pengelolaan" variant="inset">
                <CardHeader>
                  <CardTitle id="pengelolaan">Pengelolaan surat keluar ini</CardTitle>
                  <CardDescription>
                    Mengoreksi identitas surat, mengarsipkan surat yang sudah keluar, dan menghapus surat secara permanen.
                    Penghapusan permanen baru bisa dilakukan setelah lampirannya dibersihkan.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2">
                    {tertutup ? null : (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/keluar/${id}?keluar=ubah`}>Ubah identitas surat</Link>
                      </Button>
                    )}
                    {tertutup ? (
                      <AksiForm aksi={pulihkanSuratKeluar} className="flex items-center gap-2">
                        <input type="hidden" name="surat_id" value={id} />
                        <Button size="sm" variant="outline" type="submit">
                          <RotateCwIcon data-icon="inline-start" />
                          Keluarkan dari arsip
                        </Button>
                      </AksiForm>
                    ) : (
                      <AksiForm aksi={arsipkanSuratKeluar} className="flex items-center gap-2">
                        <input type="hidden" name="surat_id" value={id} />
                        <Button size="sm" variant="outline" type="submit" disabled={surat.status_surat === "draf"}>
                          Arsipkan surat
                        </Button>
                      </AksiForm>
                    )}
                    <HapusKonfirmasi
                      judul={`Hapus surat ${surat.nomor_surat} secara permanen?`}
                      keterangan={
                        halangHapus.length > 0
                          ? `Belum bisa dihapus: ${halangHapus.join(", ")}.`
                          : "Surat hilang dari daftar surat keluar. Jejak perubahannya tetap tersimpan di pengaturan. Tindakan ini tidak bisa dibatalkan."
                      }
                      labelTrigger="Hapus surat"
                      labelKonfirmasi="Hapus permanen"
                      aksi={hapusSuratKeluar}
                      hidden={{ surat_id: id }}
                      arahSetelah="/keluar"
                    />
                  </div>
                  {surat.status_surat === "draf" ? (
                    <p className="mt-2 text-xs text-muted-foreground">Belum bisa diarsipkan: surat masih draf, tandai dikirim dulu.</p>
                  ) : null}
                  {halangHapus.length > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">Belum bisa dihapus permanen: {halangHapus.join(", ")}</p>
                  ) : null}
                  {tertutup ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Surat diarsipkan: identitas, lampiran, dan statusnya tidak bisa diubah sampai surat dikeluarkan dari arsip.
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
