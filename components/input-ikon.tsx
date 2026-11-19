import type { ComponentType } from "react";
import { Input } from "@/components/ui/input";

/// Input dengan ikon di kiri. Ikon hanya hiasan (aria-hidden), label teks tetap
/// diperlukan supaya form masih terbaca oleh pembaca layar.
export function InputIkon({
  ikon: Ikon,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "className"> & {
  ikon: ComponentType<{ className?: string }>;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative w-full">
      <Ikon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input className={`pl-8 ${className ?? ""}`} {...props} />
      {children}
    </div>
  );
}
