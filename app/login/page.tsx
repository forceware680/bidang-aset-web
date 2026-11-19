import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LoginForm } from "@/components/login-form";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { GridPattern } from "@/components/ui/grid-pattern";

/** Halaman login dikosongkan ala Vercel: satu kanvas penuh dengan grid garis rambut
   (GridPattern bermasker radial, opacity dinaikkan agar jelas terlihat di kedua tema) dan
   kartu form di tengah — tanpa panel cover/logo besar. Kartu bg-background supaya teks terbaca. */
export default async function LoginPage() {
  if (await currentUser()) redirect("/dashboard");

  // Tombol unduh APK Android di pojok kiri atas — tautannya diatur lewat Pengaturan > Perangkat.
  const apk = await prisma.apk_unduh.findFirst({ where: { id: "tunggal" } });

  return (
    <main className="relative grid min-h-dvh place-items-center bg-background p-6">
      <GridPattern className="stroke-foreground/20 md:stroke-foreground/24 [mask-image:radial-gradient(70%_70%,white_35%,transparent_100%)]" />

      {apk ? (
        <div className="absolute left-4 top-4">
          <Button asChild variant="outline">
            <a href={apk.url} target="_blank" rel="noopener noreferrer">
              {/* Logo Android sebagai pil kecil: shadcn/lucide tidak punya ikon brand Android
                 (ikon brand sudah deprecated), jadi dipakai SVG inline Tabler "brand-android"
                 seperti glyph tombol mode — stroke mengikuti warna teks tombol. */}
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <svg
                  className="size-3.5"
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
                  <path d="M4 10l0 6" />
                  <path d="M20 10l0 6" />
                  <path d="M7 9h10v8a1 1 0 0 1 -1 1h-8a1 1 0 0 1 -1 -1v-8a5 5 0 0 1 10 0" />
                  <path d="M8 3l1 2" />
                  <path d="M16 3l-1 2" />
                  <path d="M9 18l0 3" />
                  <path d="M15 18l0 3" />
                </svg>
              </span>
              Unduh APK
            </a>
          </Button>
        </div>
      ) : null}

      {/* Pengalih mode di pojok kanan atas: user bisa memilih mode sebelum masuk, pilihan
          tersimpan di peramban seperti di sidebar. Diletakkan setelah GridPattern supaya
          berada di atas garis grid tanpa perlu z-index negatif. */}
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative flex w-full max-w-xs flex-col gap-6 rounded-xl border bg-background p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <img src="/logo.svg" alt="" className="size-10 shrink-0" />
          <h1 className="text-2xl font-bold">Masuk ke aplikasi</h1>
          <p className="text-balance text-sm text-muted-foreground">
            Gunakan akun yang terdaftar di Bidang Aset.
          </p>
        </div>
        <LoginForm />
        {/* Tautan kode sumber di bawah keterangan hak cipta: ikon Tabler "brand-github" SVG inline
            (ikon brand lucide sudah deprecated), stroke mengikuti warna teks. */}
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Bidang Aset.
          </p>
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Buka kode sumber aplikasi di GitHub"
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <a href="https://github.com/forceware680/bidang-aset-web" target="_blank" rel="noopener noreferrer">
              <svg
                className="size-4"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            </a>
          </Button>
        </div>
      </div>
    </main>
  );
}
