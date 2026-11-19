import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * Kronologi surat: satu jalur vertikal dengan titik bernomor, tiap bagian diberi jarak supaya
 * terbaca sebagai urutan langkah (identitas → dokumen → undangan → disposisi → rapat → pengelolaan).
 * Nomor langkah menyesuaikan bagian yang benar-benar tampil, jadi tidak ada nomor yang loncat.
 */
export function Kronologi({ children }: { children: ReactNode }) {
  return <ol className="kronologi">{children}</ol>;
}

/** Satu langkah dalam kronologi. `id` dipakai navigasi bagian untuk gulung ke bagian ini.
 *  `tertutup` menyembunyikan langkah yang sedang tidak dipilih; saat dicetak semua langkah tetap tampil. */
export function Langkah({ nomor, id, tertutup = false, children }: { nomor: number; id: string; tertutup?: boolean; children: ReactNode }) {
  return (
    <li id={id} tabIndex={-1} className={cn("scroll-mt-28", tertutup && "langkah-tertutup")}>
      <span className="kronologi-titik">{nomor}</span>
      {children}
    </li>
  );
}
