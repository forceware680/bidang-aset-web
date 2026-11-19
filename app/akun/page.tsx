import { requireUser } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { PasswordForm } from "@/components/password-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AkunPage() {
  const user = await requireUser();

  return (
    <Shell user={user} aktif="akun" judul="Akun Saya">
      <Card aria-labelledby="identitas-akun">
        <CardHeader>
          <CardTitle id="identitas-akun">Identitas akun</CardTitle>
          <CardDescription>{user.email}</CardDescription>
          <CardAction>
            <Badge variant="secondary">{user.role}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium">{user.name}</p>
        </CardContent>
      </Card>

      <Card aria-labelledby="ganti-sandi">
        <CardHeader>
          <CardTitle id="ganti-sandi">Ganti kata sandi</CardTitle>
          <CardDescription>
            Login ini tetap aktif sampai 12 jam atau sampai kamu keluar. Kata sandi lama tetap harus diisi supaya
            sandi tidak bisa diganti oleh orang lain yang membuka halaman ini di komputer kamu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </Shell>
  );
}
