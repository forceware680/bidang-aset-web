import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Di layar sentuh header sudah penuh oleh tombol sidebar + judul halaman, jadi aksi utama
 * "Tambah Surat" menjadi tombol melayang di pojok kanan bawah — selalu dalam jangkauan jempol.
 * Dipakai untuk surat masuk dan surat keluar; hanya tujuan dan labelnya yang berbeda.
 */
export function FabTambahSurat({
  href = "/surat/baru",
  label = "Tambah Surat",
  ariaLabel = "Tambah surat masuk baru",
}: {
  href?: string;
  label?: string;
  ariaLabel?: string;
}) {
  return (
    <Button
      asChild
      data-fab
      className="tanpa-cetak fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 rounded-full shadow-[0_12px_28px_-12px_oklch(0.20_0.03_322/0.55)] md:hidden"
    >
      <Link href={href} aria-label={ariaLabel}>
        <PlusIcon data-icon="inline-start" />
        {label}
      </Link>
    </Button>
  );
}
