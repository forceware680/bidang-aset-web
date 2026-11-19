import { prisma } from "@/lib/db";
import { bolehMengubah, requireUser } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { NavBagian } from "@/components/pengaturan/nav-bagian";
import { daftarNama, NavNama, type KunciNama } from "@/components/pengaturan/nav-nama";
import { MenuSubmenu } from "@/components/pengaturan/menu-submenu";
import { DialogTambah } from "@/components/pengaturan/dialog-tambah";
import { DaftarNama, type ItemDaftar } from "@/components/pengaturan/daftar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { InfoIcon } from "lucide-react";
import {
  tambahPegawai,
  tambahPejabat,
  tambahPengirim,
  tambahPenerima,
  tambahTerusan,
  ubahAktifPegawai,
  ubahAktifPejabat,
  ubahAktifPengirim,
  ubahAktifPenerima,
  ubahAktifTerusan,
} from "@/lib/actions/master";

export const dynamic = "force-dynamic";

type Konfigurasi = {
  judul: string;
  ket: string;
  kolomNama: string;
  kolomKeterangan?: string;
  namaPaginasi: string;
  labelIsian: string;
  tombolTambah: string;
  placeholderCari: string;
  kosong: string;
  aksiTambah: (form: FormData) => Promise<import("@/lib/hasil").Hasil>;
  aksiUbahAktif: (form: FormData) => Promise<import("@/lib/hasil").Hasil>;
};

const konfigurasi: Record<KunciNama, Konfigurasi> = {
  pengirim: {
    judul: "Pengirim Surat",
    ket: "Instansi atau pihak yang mengirim surat. Pilihan pengirim di formulir surat memakai daftar ini.",
    kolomNama: "Nama pengirim",
    namaPaginasi: "pengirim",
    labelIsian: "Pengirim baru",
    tombolTambah: "Tambah pengirim",
    placeholderCari: "Cari nama pengirim",
    kosong: "Belum ada pengirim.",
    aksiTambah: tambahPengirim,
    aksiUbahAktif: ubahAktifPengirim,
  },
  pejabat: {
    judul: "Pemberi Disposisi",
    ket: "Pejabat yang memberi disposisi. Daftar ini dipakai lagi di formulir disposisi, berantai sampai pemegang terakhir.",
    kolomNama: "Nama",
    kolomKeterangan: "Jabatan",
    namaPaginasi: "pemberi disposisi",
    labelIsian: "Pejabat baru",
    tombolTambah: "Tambah pejabat",
    placeholderCari: "Cari nama pejabat",
    kosong: "Belum ada pejabat.",
    aksiTambah: tambahPejabat,
    aksiUbahAktif: ubahAktifPejabat,
  },
  pegawai: {
    judul: "Pegawai Bidang Aset",
    ket: "Pegawai di Bidang Aset. Daftar ini dipakai saat memilih peserta agenda di detail surat; peserta hanya bisa dipilih dari daftar ini.",
    kolomNama: "Nama",
    kolomKeterangan: "Jabatan",
    namaPaginasi: "pegawai",
    labelIsian: "Pegawai baru",
    tombolTambah: "Tambah pegawai",
    placeholderCari: "Cari nama pegawai",
    kosong: "Belum ada pegawai.",
    aksiTambah: tambahPegawai,
    aksiUbahAktif: ubahAktifPegawai,
  },
  terusan: {
    judul: "Tujuan Diteruskan",
    ket: "Setelah disposisi terakhir, surat diteruskan ke subid atau orang tertentu. Daftar ini jadi pilihan tujuan di formulir disposisi.",
    kolomNama: "Nama tujuan",
    kolomKeterangan: "Bentuk",
    namaPaginasi: "tujuan diteruskan",
    labelIsian: "Tujuan baru",
    tombolTambah: "Tambah tujuan",
    placeholderCari: "Cari nama tujuan",
    kosong: "Belum ada tujuan diteruskan.",
    aksiTambah: tambahTerusan,
    aksiUbahAktif: ubahAktifTerusan,
  },
  penerima: {
    judul: "Tujuan Surat Keluar",
    ket: "Instansi atau orang yang dikirimi surat keluar. Daftar ini jadi pilihan tujuan di formulir surat keluar.",
    kolomNama: "Nama tujuan",
    kolomKeterangan: "Bentuk",
    namaPaginasi: "tujuan surat keluar",
    labelIsian: "Tujuan baru",
    tombolTambah: "Tambah tujuan",
    placeholderCari: "Cari nama tujuan surat keluar",
    kosong: "Belum ada tujuan surat keluar.",
    aksiTambah: tambahPenerima,
    aksiUbahAktif: ubahAktifPenerima,
  },
};

async function ambilDaftar(kunci: KunciNama): Promise<ItemDaftar[]> {
  if (kunci === "pengirim") {
    const daftar = await prisma.master_pengirim.findMany({ orderBy: { nama: "asc" } });
    return daftar.map((m) => ({ id: m.id, nama: m.nama, aktif: m.aktif }));
  }
  if (kunci === "pejabat") {
    const daftar = await prisma.master_pejabat.findMany({ orderBy: { nama: "asc" } });
    return daftar.map((m) => ({ id: m.id, nama: m.nama, aktif: m.aktif, keterangan: m.jabatan }));
  }
  if (kunci === "pegawai") {
    const daftar = await prisma.master_pegawai.findMany({ orderBy: { nama: "asc" } });
    return daftar.map((m) => ({ id: m.id, nama: m.nama, aktif: m.aktif, keterangan: m.jabatan }));
  }
  if (kunci === "terusan") {
    const daftar = await prisma.master_terusan.findMany({ orderBy: [{ jenis: "asc" }, { nama: "asc" }] });
    return daftar.map((m) => ({ id: m.id, nama: m.nama, aktif: m.aktif, lencana: m.jenis === "orang" ? "Orang" : "Subid/unit" }));
  }
  const daftar = await prisma.master_penerima.findMany({ orderBy: [{ jenis: "asc" }, { nama: "asc" }] });
  return daftar.map((m) => ({ id: m.id, nama: m.nama, aktif: m.aktif, lencana: m.jenis === "orang" ? "Orang" : "Instansi/unit" }));
}

export default async function DaftarNamaPage({
  params,
  searchParams,
}: {
  params: Promise<{ bagian: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const { bagian } = await params;
  const sp = await searchParams;
  const kunci = bagian in konfigurasi ? (bagian as KunciNama) : "pengirim";
  const namaAwal = sp.nama ? String(sp.nama) : "";

  const daftar = await ambilDaftar(kunci);
  const [lain, jumlahNama] = await Promise.all([
    Promise.all([
      prisma.users.count({ where: { is_active: true } }),
      prisma.jenis_surat.count({ where: { aktif: true } }),
      prisma.audit_logs.count(),
    ]),
    Promise.all([
      prisma.master_pengirim.count(),
      prisma.master_pejabat.count(),
      prisma.master_pegawai.count(),
      prisma.master_terusan.count(),
      prisma.master_penerima.count(),
    ]),
  ]);
  const jumlahPill: Record<KunciNama, number> = {
    pengirim: jumlahNama[0],
    pejabat: jumlahNama[1],
    pegawai: jumlahNama[2],
    terusan: jumlahNama[3],
    penerima: jumlahNama[4],
  };
  const bolehUbah = bolehMengubah(user.role);
  const k = konfigurasi[kunci];

  return (
    <Shell
      user={user}
      aktif={`pengaturan/nama/${kunci}`}
      judul={`Daftar Nama — ${k.judul}`}
      aksi={
        <>
          <MenuSubmenu
            judul="Daftar Nama"
            items={daftarNama.map((d) => ({ href: d.href, label: d.label, jumlah: jumlahPill[d.kunci], aktif: d.kunci === kunci }))}
          />
          {bolehUbah ? (
            <DialogTambah
              aksi={k.aksiTambah}
              label={k.tombolTambah}
              judul={k.tombolTambah}
              deskripsi={k.ket}
              pesanSukses="Nama ditambahkan ke daftar."
              anak={
                <>
                  {kunci === "pegawai" && namaAwal ? (
                    <>
                      <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
                        <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>Nama "{namaAwal}" belum ada di daftar. Tambahkan supaya bisa dipilih sebagai peserta.</span>
                      </div>
                      <input type="hidden" name="nama_awal" value={namaAwal} />
                    </>
                  ) : null}
                  <Field>
                    <FieldLabel htmlFor={`nama_${kunci}`}>{k.labelIsian}</FieldLabel>
                    <Input id={`nama_${kunci}`} name="nama" required maxLength={200} defaultValue={kunci === "pegawai" ? namaAwal : ""} />
                  </Field>
                  {kunci === "pejabat" || kunci === "pegawai" ? (
                    <Field>
                      <FieldLabel htmlFor={`jabatan_${kunci}`}>Jabatan (opsional)</FieldLabel>
                      <Input id={`jabatan_${kunci}`} name="jabatan" maxLength={120} />
                    </Field>
                  ) : kunci === "terusan" ? (
                    <Field>
                      <FieldLabel htmlFor="jenis_terusan">Bentuk</FieldLabel>
                      <NativeSelect id="jenis_terusan" name="jenis" defaultValue="unit">
                        <NativeSelectOption value="unit">Subid/unit</NativeSelectOption>
                        <NativeSelectOption value="orang">Orang</NativeSelectOption>
                      </NativeSelect>
                    </Field>
                  ) : kunci === "penerima" ? (
                    <Field>
                      <FieldLabel htmlFor="jenis_penerima">Bentuk</FieldLabel>
                      <NativeSelect id="jenis_penerima" name="jenis" defaultValue="unit">
                        <NativeSelectOption value="unit">Instansi/unit</NativeSelectOption>
                        <NativeSelectOption value="orang">Orang</NativeSelectOption>
                      </NativeSelect>
                    </Field>
                  ) : null}
                </>
              }
            />
          ) : null}
        </>
      }
    >
      <NavBagian aktif="nama" jumlah={{ pengguna: lain[0], jenis: lain[1], nama: jumlahNama.reduce((a, b) => a + b, 0), jejak: lain[2], monitor: 1 }} />
      <NavNama aktif={kunci} jumlah={jumlahPill} />
      {!bolehUbah ? (
        <p className="text-sm text-muted-foreground">
          Peran kamu Pembaca/Pimpinan. Halaman ini hanya menampilkan catatan; tidak ada tombol perubahan.
        </p>
      ) : null}

      <Card aria-labelledby={`daftar-${kunci}`}>
        <CardHeader>
          <CardTitle id={`daftar-${kunci}`} className="flex flex-wrap items-center gap-2">
            {k.judul}
            <Badge variant="secondary" className="num">{daftar.filter((m) => m.aktif).length} aktif dari {daftar.length}</Badge>
          </CardTitle>
          <CardDescription>{k.ket}</CardDescription>
        </CardHeader>
        <CardContent>
          <DaftarNama
            bolehUbah={bolehUbah}
            daftar={daftar}
            aksiUbahAktif={k.aksiUbahAktif}
            kunci={kunci}
            namaPaginasi={k.namaPaginasi}
            placeholderCari={k.placeholderCari}
            ariaCari={k.placeholderCari}
            kolomNama={k.kolomNama}
            kolomKeterangan={k.kolomKeterangan}
            kosong={k.kosong}
          />
        </CardContent>
      </Card>
    </Shell>
  );
}
