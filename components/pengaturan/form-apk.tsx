"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { aturTautanAPK } from "@/lib/actions/pengaturan";

/**
 * Isian tautan APK untuk halaman login. Simpan lewat server action dengan umpan toast,
 * lalu refresh supaya nilai baru terbaca lagi di halaman ini dan di login.
 */
export function FormAPK({ urlAwal }: { urlAwal: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(urlAwal);
  const [mengirim, mulai] = useTransition();

  const simpan = () =>
    mulai(async () => {
      const form = new FormData();
      form.set("url", url.trim());
      const hasil = await aturTautanAPK(form);
      if (hasil.ok) {
        toast(hasil.pesan ?? "Tautan tersimpan.");
        router.refresh();
      } else {
        toast.galat(hasil.pesan);
      }
    });

  return (
    <FieldGroup className="flex w-full flex-row flex-wrap items-end gap-3">
      <Field className="w-full md:w-96">
        <FieldLabel htmlFor="apk_url">Tautan APK</FieldLabel>
        <Input
          id="apk_url"
          value={url}
          placeholder="https://example.com/bidang-aset.apk"
          onChange={(e) => setUrl(e.target.value)}
        />
      </Field>
      <div className="w-full md:w-auto">
        <Button type="button" variant="default" disabled={mengirim} onClick={simpan}>
          <DownloadIcon data-icon="inline-start" />
          {mengirim ? "Menyimpan..." : url ? "Simpan tautan" : "Hapus tautan"}
        </Button>
      </div>
    </FieldGroup>
  );
}
