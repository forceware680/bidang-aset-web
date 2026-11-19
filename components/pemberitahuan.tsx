"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { beriTersambung, mintaPenyegar } from "@/lib/pemberitahuan-client";
import { perubahanTerkait } from "@/lib/pemberitahuan-rute";

/** Jeda pendek: satu aksi bisa menghasilkan beberapa perubahan baris (surat + disposisi + agenda). */
const TUNGGU_GABUNG_MS = 350;

/**
 * Langganan pemberitahuan realtime. Halaman mendengar jalur `/api/pembaruan`; setiap perubahan data
 * di database datang ke sini dan halaman hanya menyegar payload-nya bila perubahan itu memang terlihat
 * di halaman yang sedang dibuka. Tidak ada penyegar berkala: yang bergerak hanya yang berubah.
 *
 * Layar monitor tidak masuk (ia membuka alamat dengan kunci monitor), jadi kunci ikut dibawa saat
 * halaman itu yang berlangganan.
 */
export function Pemberitahuan() {
  const router = useRouter();
  const pathname = usePathname();
  // Penyegar ditahan sementara aksi masih berjalan (redirect server action juga lewat jalur yang sama),
  // supaya dua aliran payload tidak saling menyusul — itu yang bikin React kehilangan simpul di DOM.

  useEffect(() => {
    const kunci = new URLSearchParams(window.location.search).get("t");
    const alamat = pathname === "/monitor" ? `/api/pembaruan?t=${encodeURIComponent(kunci ?? "")}` : "/api/pembaruan";

    let jeda: number | undefined;
    const sumber = new EventSource(alamat);

    sumber.addEventListener("siap", () => beriTersambung(true));
    sumber.addEventListener("open", () => beriTersambung(true));
    sumber.addEventListener("perubahan", (e) => {
      let isi: { tabel?: string };
      try {
        isi = JSON.parse(e.data) as { tabel?: string };
      } catch {
        return;
      }
      if (!isi.tabel || !perubahanTerkait(isi.tabel, pathname)) return;
      clearTimeout(jeda);
      jeda = window.setTimeout(() => mintaPenyegar(() => router.refresh()), TUNGGU_GABUNG_MS);
    });
    sumber.addEventListener("error", () => beriTersambung(false));

    return () => {
      clearTimeout(jeda);
      sumber.close();
      beriTersambung(false);
    };
  }, [pathname, router]);

  return null;
}
