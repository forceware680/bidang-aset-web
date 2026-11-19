import { useId } from "react";
import type { ComponentProps } from "react";

import { cn } from "cn";

/**
 * Latar bertitik penuh (SVG pattern). Dekoratif saja: `aria-hidden`, tidak menghalangi klik, dan
 * posisinya di dalam elemen yang di-render lebih dulu sehingga teks di atasnya tetap terbaca.
 * Titik memakai token `foreground` supaya warnanya ikut tema terang dan gelap.
 */
interface DotPatternProps extends ComponentProps<"svg"> {
  width?: number | string;
  height?: number | string;
  x?: number | string;
  y?: number | string;
  cx?: number | string;
  cy?: number | string;
  cr?: number | string;
  className?: string;
}

export function DotPattern({
  width = 24,
  height = 24,
  x = 0,
  y = 0,
  cx = 1,
  cy = 0.5,
  cr = 0.5,
  className,
  ...props
}: DotPatternProps) {
  const id = useId();

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full fill-foreground/10 md:fill-foreground/14",
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
          <circle id="pattern-circle" cx={cx} cy={cy} r={cr} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
    </svg>
  );
}
