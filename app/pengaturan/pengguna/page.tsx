import { prisma } from "@/lib/db";
import { bolehMengubah, requireUser } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { NavBagian } from "@/components/pengaturan/nav-bagian";
import { BagianAkun } from "@/components/pengaturan/bagian-akun";
import { DialogTambah } from "@/components/pengaturan/dialog-tambah";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { buatPengguna, ubahPengguna } from "@/lib/actions/pengaturan";

export const dynamic = "force-dynamic";

export default async function AkunPenggunaPage() {
  const user = await requireUser();

  const [peran, pengguna, jumlahJenisAktif, jumlahNama, jumlahAudit] = await Promise.all([
    prisma.roles.findMany({ orderBy: { name: "asc" } }),
    prisma.users.findMany({ include: { roles: { select: { name: true } } }, orderBy: { created_at: "desc" } }),
    prisma.jenis_surat.count({ where: { aktif: true } }),
    Promise.all([
      prisma.master_pengirim.count(),
      prisma.master_pejabat.count(),
      prisma.master_pegawai.count(),
      prisma.master_terusan.count(),
      prisma.master_penerima.count(),
    ]).then((n) => n.reduce((a, b) => a + b, 0)),
    prisma.audit_logs.count(),
  ]);

  const daftarPeran = peran.map((r) => ({ id: r.id, name: r.name }));
  const daftarPengguna = pengguna.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.roles.name,
    is_active: u.is_active,
    created_at: u.created_at,
  }));

  const bolehUbah = bolehMengubah(user.role);

  return (
    <Shell
      user={user}
      aktif="pengaturan/pengguna"
      judul="Akun Pengguna"
      aksi={
        bolehUbah ? (
          <DialogTambah
            aksi={buatPengguna}
            label="Buat akun"
            judul="Buat akun baru"
            deskripsi="Kata sandi sementara diberikan ke pengguna dan bisa diganti sendiri dari halaman Akun saya."
            pesanSukses="Akun dibuat."
            anak={
              <>
                <Field>
                  <FieldLabel htmlFor="name">Nama</FieldLabel>
                  <Input id="name" name="name" required maxLength={150} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input className="num" id="email" name="email" type="email" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Kata sandi sementara</FieldLabel>
                  <Input id="password" name="password" type="password" required minLength={8} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="role">Peran</FieldLabel>
                  <NativeSelect id="role" name="role" className="w-full min-w-[13rem]" defaultValue="Petugas Agenda">
                    {daftarPeran.map((r) => (
                      <NativeSelectOption key={r.id} value={r.name}>
                        {r.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </>
            }
          />
        ) : null
      }
    >
      <NavBagian
        aktif="pengguna"
        jumlah={{ pengguna: pengguna.filter((u) => u.is_active).length, jenis: jumlahJenisAktif, nama: jumlahNama, jejak: jumlahAudit, monitor: 1 }}
      />
      {!bolehUbah ? (
        <p className="text-sm text-muted-foreground">
          Peran kamu Pembaca/Pimpinan. Halaman ini hanya menampilkan catatan; tidak ada tombol perubahan.
        </p>
      ) : null}
      <BagianAkun
        bolehUbah={bolehUbah}
        peran={daftarPeran}
        pengguna={daftarPengguna}
        ubahPengguna={ubahPengguna}
      />
    </Shell>
  );
}
