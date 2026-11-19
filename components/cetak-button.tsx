"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Dialog cetak browser dipakai untuk menyimpan PDF: tidak ada PDF generator di server. */
export function CetakButton({ className }: { className?: string }) {
  return (
    // Di HP hanya icon printer yang tampil — aksinya jelas dari icon dan nama aksesibelnya.
    <Button
      size="sm"
      variant="outline"
      onClick={() => window.print()}
      aria-label="Cetak atau simpan PDF"
      data-ikon-saja
      className={className}
    >
      <PrinterIcon />
      <span className="hidden md:inline">Cetak atau simpan PDF</span>
    </Button>
  );
}
