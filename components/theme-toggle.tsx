"use client"

import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

/** Satu glypher untuk kedua mode: ikon Tabler "sun" (matahari dan bulan dalam satu gambar).
   Di mode gelap glyphernya diputar 180° lewat CSS, jadi arah sinar berbalik — tidak ada dua ikon
   yang saling sembunyi, dan tidak ada nilai theme saat render sehingga tidak ada mismatch hidrasi. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      data-slot="theme-toggle"
      aria-label="Ganti mode gelap dan terang"
      className="max-md:size-11 dark:rotate-180 motion-safe:transition-transform motion-safe:duration-500"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {/* Di luar komponen UI, jadi ditulis sebagai SVG inline: stroke mengikuti warna teks tombol. */}
      <svg
        className="size-4.5"
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
        <path d="M12 3l0 18" />
        <path d="M12 9l4.65 -4.65" />
        <path d="M12 14.3l7.37 -7.37" />
        <path d="M12 19.6l8.85 -8.85" />
      </svg>
    </Button>
  )
}
