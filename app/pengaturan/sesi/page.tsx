import { SmartphoneIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { FormAPK } from "@/components/pengaturan/form-apk";
import { TombolCabut } from "@/components/pengaturan/tombol-cabut";
import { Shell } from "@/components/shell";
import { NavBagian } from "@/components/pengaturan/nav-bagian";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tanggalJamText } from "@/lib/format";

export const dynamic = "force-dynamic";

type Perangkat = {
  id: string;
  perangkat: string | null;
  created_at: Date;
  terakhir_pakai: Date | null;
  expires_at: Date;
  users: { name: string; email: string; roles: { name: string } };
};

export default async function PengaturanSesiPage() {
  const user = await requireUser();
  const bolehCabut = user.role === "Administrator";

  const [token, apk, jumlahPenggunaAktif, jumlahJenisAktif, jumlahNama, jumlahAudit] = await Promise.all([
    prisma.api_token.findMany({
      include: { users: { select: { name: true, email: true, roles: { select: { name: true } } } } },
      orderBy: { created_at: "desc" },
    }),
    prisma.apk_unduh.findFirst({ where: { id: "tunggal" } }),
    prisma.users.count({ where: { is_active: true } }),
    prisma.jenis_surat.count({ where: { aktif: true } }),
    Promise.all([
      prisma.master_pengirim.count(),
      prisma.master_pejabat.count(),
      prisma.master_pegawai.count(),
      prisma.master_terusan.count(),
      prisma.master_penerima.count(),
    ]).then((a) => a.reduce((x, y) => x + y, 0)),
    prisma.audit_logs.count(),
  ]);

  const sekarang = new Date();
  const daftar = token.map((t) => ({ ...t, aktif: t.expires_at > sekarang }));
  const jumlahAktif = daftar.filter((t) => t.aktif).length;

  return (
    <Shell user={user} aktif="pengaturan/sesi" judul="Perangkat">
      <NavBagian
        aktif="sesi"
        jumlah={{ pengguna: jumlahPenggunaAktif, jenis: jumlahJenisAktif, nama: jumlahNama, jejak: jumlahAudit, monitor: 1 }}
      />
      {!bolehCabut ? (
        <p className="text-sm text-muted-foreground">
          Peran kamu bukan Administrator. Daftar ini hanya dibaca — hanya Administrator yang bisa mencabut token.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Perangkat yang masuk lewat aplikasi Android</CardTitle>
          <CardDescription>
            <span className="num">{jumlahAktif}</span> token aktif dari <span className="num">{daftar.length}</span> token yang pernah dibuat.
            Token kedaluwarsa otomatis 90 hari setelah pemakaian terakhir. Cabut berarti keluar dari jauh: perangkat itu
            harus masuk lagi saat pemeriksaan sesi berikutnya.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {daftar.length === 0 ? (
            <Empty className="px-4 pb-4">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SmartphoneIcon />
                </EmptyMedia>
                <EmptyTitle>Belum ada perangkat yang masuk</EmptyTitle>
                <EmptyDescription>
                  Perangkat muncul begitu seseorang masuk lewat aplikasi Android di HP-nya.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              {/* Di ponsel daftar menumpuk jadi kartu per perangkat. */}
              <div className="flex flex-col gap-3 p-4 md:hidden">
                {daftar.map((t) => (
                  <div key={t.id} className="rounded-xl border border-(--border)/50 p-3">
                    <p className="font-medium">{t.users.name}</p>
                    <p className="text-sm text-muted-foreground">{t.users.email} · {t.users.roles.name}</p>
                    <p className="mt-1 text-sm">
                      Perangkat: <span className="num">{t.perangkat ?? "(tidak tercatat)"}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Masuk {tanggalJamText(t.created_at)} · terakhir dipakai {t.terakhir_pakai ? tanggalJamText(t.terakhir_pakai) : "belum pernah"}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant={t.aktif ? "secondary" : "outline"}>{t.aktif ? "aktif" : "kedaluwarsa"}</Badge>
                      {bolehCabut ? <TombolCabut id={t.id} className="ml-auto" /> : null}
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden border-t border-(--border) pt-4 md:block md:overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Peran</TableHead>
                      <TableHead>Perangkat</TableHead>
                      <TableHead>Masuk</TableHead>
                      <TableHead>Terakhir dipakai</TableHead>
                      <TableHead>Kedaluwarsa</TableHead>
                      {bolehCabut ? <TableHead>Aksi</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {daftar.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap">{t.users.name}</TableCell>
                        <TableCell className="whitespace-nowrap">{t.users.email}</TableCell>
                        <TableCell className="whitespace-nowrap">{t.users.roles.name}</TableCell>
                        <TableCell className="whitespace-nowrap">{t.perangkat ?? "(tidak tercatat)"}</TableCell>
                        <TableCell className="num whitespace-nowrap">{tanggalJamText(t.created_at)}</TableCell>
                        <TableCell className="num whitespace-nowrap">{t.terakhir_pakai ? tanggalJamText(t.terakhir_pakai) : "—"}</TableCell>
                        <TableCell className="num whitespace-nowrap">
                          {tanggalJamText(t.expires_at)} <Badge variant={t.aktif ? "secondary" : "outline"}>{t.aktif ? "aktif" : "kedaluwarsa"}</Badge>
                        </TableCell>
                        {bolehCabut ? (
                          <TableCell>
                            <TombolCabut id={t.id} className="whitespace-nowrap" />
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

      <Card aria-labelledby="apk">
        <CardHeader>
          <CardTitle id="apk">Tautan unduh APK Android</CardTitle>
          <CardDescription>
            Tombol "Unduh APK" muncul di pojok kiri atas halaman login kalau tautan ini terisi.
            Kosongkan tautan untuk menghapus tombol dari login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bolehCabut ? (
            <FormAPK urlAwal={apk?.url ?? ""} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {apk
                ? <>Tautan saat ini: <span className="num break-all">{apk.url}</span></>
                : "Belum ada tautan — tombol tidak tampil di halaman login."}
            </p>
          )}
        </CardContent>
      </Card>
    </Shell>
  );
}
