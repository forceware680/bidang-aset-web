"use client";

import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";

/**
 * Hasil yang dibawa query (`?agenda=ok`, `?rapat=buat&pesan=...`) jadi toast, bukan banner di atas
 * halaman. Server action tetap redirect supaya datanya terbaca ulang; komponen ini hanya menyampaikan
 * pesannya sekali saat halaman ditampilkan.
 */
export function ToastKuer({ teks, nada }: { teks: string; nada: "sukses" | "galat" }) {
  const sudah = useRef(false);
  useEffect(() => {
    if (sudah.current) return;
    sudah.current = true;
    if (nada === "sukses") toast(teks);
    else toast.galat(teks);
  }, [teks, nada]);
  return null;
}
