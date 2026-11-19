import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { bolehMengubah, requireUser } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { NavBagian } from "@/components/pengaturan/nav-bagian";
import { NavJenis, type KunciJenis } from "@/components/pengaturan/nav-jenis";
import { MenuSubmenu } from "@/components/pengaturan/menu-submenu";
import { DialogTambah } from "@/components/pengaturan/dialog-tambah";
import { DaftarNama, type ItemDaftar } from "@/components/pengaturan/daftar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { tambahJenis, ubahAktifJenis } from "@/lib/actions/pengaturan";

export const dynamic = "force-dynamic";

const konfigurasi: Record<KunciJenis, { judul: string; ket: string; labelIsian: string; tombol: string; placeholderCari: string; paginasi: string }> = {
  masuk: {
    judul: "Kategori surat masuk",
    ket: "Kategori yang dinonaktifkan tetap tersimpan pada surat yang sudah memakai kategori itu, tetapi tidak muncul lagi di formulir surat masuk dan penyaring daftar surat.",
    labelIsian: "Kategori surat masuk baru",
    tombol: "Tambah kategori surat masuk",
    placeholderCari: "Cari kategori surat masuk",
    paginasi: "kategori surat masuk",
  },
  keluar: {
    judul: "Kategori surat keluar",
    ket: "Kategori yang dinonaktifkan tetap tersimpan pada surat keluar yang sudah memakai kategori itu, tetapi tidak muncul lagi di formulir surat keluar dan penyaring daftar surat.",
    labelIsian: "Kategori surat keluar baru",
    tombol: "Tambah kategori surat keluar",
    placeholderCari: "Cari kategori surat keluar",
    paginasi: "kategori surat keluar",
  },
};

function jenisDaftar(jenis: { id: string; nama: string; aktif: boolean }[]): ItemDaftar[] {
  return jenis.map((j) => ({ id: j.id, nama: j.nama, aktif: j.aktif }));
}

export default async function JenisSuratPage({ params }: { params: Promise<{ arah: string }> }) {
  const arah = (await params).arah;
  if (arah !== "masuk" && arah !== "keluar") redirect("/pengaturan/jenis/masuk");

  const user = await requireUser();
  const cfg = konfigurasi[arah];

  const [daftar, jumlahMasuk, jumlahKeluar, jumlahPenggunaAktif, jumlahNama, jumlahAudit] = await Promise.all([
    prisma.jenis_surat.findMany({ where: { arah }, orderBy: { nama: "asc" } }),
    prisma.jenis_surat.count({ where: { arah: "masuk", aktif: true } }),
    prisma.jenis_surat.count({ where: { arah: "keluar", aktif: true } }),
    prisma.users.count({ where: { is_active: true } }),
    Promise.all([
      prisma.master_pengirim.count(),
      prisma.master_pejabat.count(),
      prisma.master_pegawai.count(),
      prisma.master_terusan.count(),
      prisma.master_penerima.count(),
    ]).then((n) => n.reduce((a, b) => a + b, 0)),
    prisma.audit_logs.count(),
  ]);

  const bolehUbah = bolehMengubah(user.role);
  const item = jenisDaftar(daftar);

  return (
    <Shell
      user={user}
      aktif="pengaturan/jenis"
      judul={`Kategori Surat — ${arah === "keluar" ? "Surat Keluar" : "Surat Masuk"}`}
      aksi={
        <>
          <MenuSubmenu
            judul="Kategori Surat"
            items={[
              { href: "/pengaturan/jenis/masuk", label: "Kategori Surat Masuk", jumlah: jumlahMasuk, aktif: arah === "masuk" },
              { href: "/pengaturan/jenis/keluar", label: "Kategori Surat Keluar", jumlah: jumlahKeluar, aktif: arah === "keluar" },
            ]}
          />
          {bolehUbah ? (
            <DialogTambah
              aksi={tambahJenis}
              label={cfg.tombol}
              judul={cfg.tombol}
              deskripsi={cfg.ket}
              pesanSukses="Kategori surat ditambahkan."
              anak={
                <>
                  <input type="hidden" name="arah" value={arah} />
                  <Field>
                    <FieldLabel htmlFor={`nama_jenis_${arah}`}>{cfg.labelIsian}</FieldLabel>
                    <Input id={`nama_jenis_${arah}`} name="nama" required maxLength={200} placeholder="cth. Undangan" />
                  </Field>
                </>
              }
            />
          ) : null}
        </>
      }
    >
      <NavBagian
        aktif="jenis"
        jumlah={{ pengguna: jumlahPenggunaAktif, jenis: jumlahMasuk + jumlahKeluar, nama: jumlahNama, jejak: jumlahAudit, monitor: 1 }}
      />
      <NavJenis aktif={arah} jumlah={{ masuk: jumlahMasuk, keluar: jumlahKeluar }} />
      {!bolehUbah ? (
        <p className="text-sm text-muted-foreground">
          Peran kamu Pembaca/Pimpinan. Halaman ini hanya menampilkan catatan; tidak ada tombol perubahan.
        </p>
      ) : null}
      <Card aria-labelledby={`daftar-jenis-${arah}`}>
        <CardHeader>
          <CardTitle id={`daftar-jenis-${arah}`} className="flex flex-wrap items-center gap-2">
            {cfg.judul}
            <Badge variant="secondary" className="num">{item.filter((j) => j.aktif).length} aktif dari {item.length}</Badge>
          </CardTitle>
          <CardDescription>{cfg.ket}</CardDescription>
        </CardHeader>
        <CardContent>
          <DaftarNama
            bolehUbah={bolehUbah}
            daftar={item}
            aksiUbahAktif={ubahAktifJenis}
            kunci={`jenis_${arah}`}
            namaPaginasi={cfg.paginasi}
            placeholderCari={cfg.placeholderCari}
            ariaCari={cfg.placeholderCari}
            kolomNama="Kategori surat"
            kosong="Belum ada kategori surat."
          />
        </CardContent>
      </Card>
    </Shell>
  );
}
