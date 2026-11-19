import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Pemberitahuan } from "@/components/pemberitahuan";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Aplikasi Pencatatan Surat Masuk, Keluar dan Jadwal Agenda Bidang Aset BPKAD Kota Magelang",
  description:
    "Aplikasi Pencatatan Surat Masuk, Keluar dan Jadwal Agenda untuk Bidang Aset BPKAD Kota Magelang.",
};

export default function RootLayout({ children, modal }: { children: React.ReactNode; modal?: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={inter.className}>
        {/* Mode gelap adalah tampilan standar (monitor besar di depan Bidang Aset); pengguna
          bisa pindah ke mode terang lewat ikon di nav sidebar (samping avatar), pilihan tersimpan di peramban. */}
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
        />
        <ThemeProvider attribute="class" defaultTheme="dark" storageKey="aset-theme">
          {children}
          {/* Slot @modal: formulir tambah surat dibuka di atas halaman yang sedang dibuka.
            Radix mem-portal dialognya ke body, jadi ia tidak ikut ter-scroll bersama daftar. */}
          {modal}
          {/* Pesan hasil aksi perubahan muncul di sini; posisi atas-tengah supaya tidak bertabrakan
            dengan tombol melayang dan bilah bawah navigasi di pojok bawah. */}
          <Toaster />
          {/* Langganan pemberitahuan realtime: halaman hanya menyegar dirinya bila perubahan yang
            datang memang terlihat di halaman itu. */}
          <Pemberitahuan />
        </ThemeProvider>
      </body>
    </html>
  );
}
