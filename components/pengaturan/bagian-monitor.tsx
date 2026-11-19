"use client";

import { useState } from "react";
import { CopyIcon, ExternalLinkIcon, KeyRoundIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { gunakanAksi } from "@/components/aksi-form";
import { rotasiKunciMonitor } from "@/lib/actions/pengaturan";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

/**
 * Kunci layar monitor. Administrator bisa membalas kunci: kunci baru dibuat, kunci lama berhenti berlaku
 * seketika, dan alamat layar di ruang rapat harus diganti dengan alamat yang baru.
 */
export function BagianMonitor({
  token,
  url,
  dibuatPada,
  oleh,
  dariEnv,
  bolehUbah,
}: {
  token: string;
  url: string;
  dibuatPada: string | null;
  oleh: string | null;
  dariEnv: boolean;
  bolehUbah: boolean;
}) {
  const { jalan, mengirim } = gunakanAksi(rotasiKunciMonitor, "Kunci monitor baru dibuat.");
  const [konfirmasi, setKonfirmasi] = useState(false);

  async function salin() {
    try {
      await navigator.clipboard.writeText(url);
      toast("Alamat layar monitor disalin.");
    } catch {
      toast.galat("Peramban tidak bisa menyalin alamat ini.");
    }
  }

  async function balas() {
    const berhasil = await jalan(new FormData());
    if (berhasil) setKonfirmasi(false);
  }

  return (
    <Card aria-labelledby="monitor-kunci">
      <CardHeader>
        <CardTitle id="monitor-kunci" className="flex flex-wrap items-center gap-2">
          <KeyRoundIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          Kunci layar monitor
        </CardTitle>
        <CardDescription>
          Layar /monitor di depan ruang rapat dibuka dengan kunci di alamat. Ganti kunci kalau kunci lama
          sudah tersebar — kunci lama berhenti berlaku begitu kunci baru dibuat.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4">
        {token ? (
          <>
            <Field>
              <FieldLabel htmlFor="monitor-url">Alamat layar</FieldLabel>
              <InputGroup>
                <InputGroupInput id="monitor-url" readOnly value={url} className="num" />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton aria-label="Salin alamat layar" size="icon-sm" onClick={salin}>
                    <CopyIcon />
                  </InputGroupButton>
                  <InputGroupButton asChild aria-label="Buka layar monitor" size="icon-sm">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <ExternalLinkIcon />
                    </a>
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>Pakai alamat ini di TV atau monitor ruang rapat.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="monitor-token">Kunci monitor</FieldLabel>
              <InputGroup>
                <InputGroupInput id="monitor-token" readOnly value={token} className="num" />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton aria-label="Salin kunci monitor" size="icon-sm" onClick={() => void navigator.clipboard.writeText(token).then(() => toast("Kunci monitor disalin."), () => toast.galat("Peramban tidak bisa menyalin kunci ini."))}>
                    <CopyIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Kunci monitor belum dipasang. Pasang <code className="num text-xs">MONITOR_TOKEN</code> di pengaturan
            server, atau buat kunci baru di bawah ini.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{dariEnv ? "Kunci masih dari .env" : dibuatPada ? `Dibuat ${dibuatPada}` : "Kunci dari database"}</Badge>
          {oleh ? <span className="text-sm text-muted-foreground">oleh {oleh}</span> : null}
        </div>

        {bolehUbah ? (
          <div className="flex">
            <AlertDialog open={konfirmasi} onOpenChange={setKonfirmasi}>
              <AlertDialogTrigger asChild>
                <Button variant="default" className="w-full gap-2 md:w-auto">
                  <RefreshCwIcon className={mengirim ? "animate-spin" : ""} />
                  Balas kunci monitor
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Balas kunci monitor?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Kunci baru dibuat acak dan kunci lama berhenti berlaku seketika. Layar yang masih memakai
                    kunci lama akan menolak sampai alamatnya diganti dengan alamat yang baru.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={balas} disabled={mengirim}>
                    {mengirim ? "Membuat kunci baru…" : "Buat kunci baru"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Hanya Administrator yang bisa membalas kunci monitor.</p>
        )}
      </CardContent>
    </Card>
  );
}
