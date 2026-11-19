"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/// Tombol aksi berupa ikon: desktop hanya ikon + tooltip, layar kecil tetap menampilkan
/// teks supaya jelas saat disentuh. Nama akses selalu ada lewat aria-label.
/// Ikon dilewatkan sebagai children — komponen React tidak bisa dikirim sebagai prop
/// dari Server Component ke Client Component.
export function AksiIkon({
  label,
  children,
  teks,
  variant = "outline",
  type = "submit",
  className,
  onClick,
}: {
  label: string;
  children: ReactNode;
  /// Teks pendek untuk layar kecil; `label` tetap jadi nama aksesibel dan tooltip.
  teks?: string;
  variant?: "outline" | "secondary" | "default" | "destructive";
  type?: "submit" | "button";
  className?: string;
  onClick?: () => void;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type={type}
            variant={variant}
            aria-label={label}
            onClick={onClick}
            className={`h-11 w-auto gap-1.5 px-3 sm:h-8 sm:w-8 sm:gap-0 sm:px-0 ${className ?? ""}`}
          >
            {children}
            <span className="sm:hidden">{teks ?? label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
