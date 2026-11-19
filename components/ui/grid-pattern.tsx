import { useId } from "react";
import type { ComponentProps } from "react";

import { cn } from "cn";

/**
 * Latar bergaris grid penuh (SVG pattern), gaya garis rambut ala Vercel: satu sel per `width`×`height`,
 * garis tipis dari token `foreground` sehingga ikut tema terang dan gelap. Dekoratif saja:
 * `aria-hidden`, tidak menghalangi klik, dan dirender sebelum isi sehingga teks tetap terbaca.
 */
interface GridPatternProps extends ComponentProps<"svg"> {
  width?: number | string;
  height?: number | string;
  x?: number | string;
  y?: number | string;
  className?: string;
}

export function GridPattern({
  width = 32,
  height = 32,
  x = -1,
  y = -1,
  className,
  ...props
}: GridPatternProps) {
  const id = useId();

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full stroke-foreground/10 md:stroke-foreground/14",
        className,
      )}
      {...props}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          patternContentUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          {/* Dua garis per sel (atas dan kiri) — ketemu dengan sel tetangga jadi grid utuh 1px. */}
          <path fill="none" strokeWidth={1} d={`M.5 ${height}V.5H${width}`} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
    </svg>
  );
}
