"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cabutTokenPerangkat } from "@/lib/actions/pengaturan";

/// Tombol cabut dengan umpan: pesan aksi tampil sebagai toast dan daftar diperbarui lewat
/// router.refresh() setelah sukses — bukan diam-d seperti form submit polos.
export function TombolCabut({ id, className }: { id: string; className?: string }) {
  const router = useRouter();
  const [mengirim, mulai] = useTransition();

  const cabut = () =>
    mulai(async () => {
      const form = new FormData();
      form.set("id", id);
      const hasil = await cabutTokenPerangkat(form);
      if (hasil.ok) {
        toast(hasil.pesan ?? "Token dicabut.");
        router.refresh();
      } else {
        toast.galat(hasil.pesan);
      }
    });

  return (
    <Button type="button" variant="outline" size="sm" disabled={mengirim} className={className} onClick={cabut}>
      {mengirim ? "Mencabut..." : "Cabut"}
    </Button>
  );
}
