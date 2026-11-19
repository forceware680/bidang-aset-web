"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { gunakanPenyegar, mulaiAksi, selesaiAksi } from "@/lib/pemberitahuan-client";
import type { Hasil } from "@/lib/hasil";

/**
 * Menjalankan aksi perubahan tanpa reload halaman: pesan hasil jadi toast, dan perubahan baris di
 * database memicu pemberitahuan realtime sehingga daftar/badge diperbarui di tempat yang sama. Kalau
 * jalur pembaruan sedang tertutup (jaringan putus atau aliran ditutup peramban), halaman menyegar
 * payload-nya sendiri. Aksi yang menolak (validasi, surat terarsipkan) menampilkan toast galat dan
 * tidak menyegarkan — tampilan tetap seperti sebelum pengguna menekan tombol.
 */
export function AksiForm({
  aksi,
  pesanSukses,
  padaSukses,
  className,
  children,
}: {
  aksi: (form: FormData) => Promise<Hasil>;
  pesanSukses?: string;
  /// Untuk panel inline: panel ditutup setelah perubahan tersimpan.
  padaSukses?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const segar = gunakanPenyegar();
  const [mengirim, setMengirim] = useState(false);

  async function kirim(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mengirim) return;
    setMengirim(true);
    mulaiAksi();
    const hasil = await aksi(new FormData(e.currentTarget));
    setMengirim(false);
    selesaiAksi();
    if (hasil.ok) {
      toast(hasil.pesan ?? pesanSukses ?? "Tersimpan.");
      padaSukses?.();
      segar();
    } else {
      toast.galat(hasil.pesan);
    }
  }

  return (
    <form onSubmit={kirim} className={className} data-mengirim={mengirim ? "" : undefined}>
      {children}
    </form>
  );
}

/** Versi tanpa <form>: dipakai tombol yang mengumpulkan FormData sendiri (dialog konfirmasi hapus). */
export function gunakanAksi(
  aksi: (form: FormData) => Promise<Hasil>,
  pesanSukses?: string,
  setelah?: { arah?: string },
  lokal?: { sebelumJalan?: () => void; padaGalat?: () => void }
) {
  const router = useRouter();
  const segar = gunakanPenyegar();
  const [mengirim, setMengirim] = useState(false);

  async function jalan(form: FormData) {
    if (mengirim) return false;
    setMengirim(true);
    mulaiAksi();
    lokal?.sebelumJalan?.();
    const hasil = await aksi(form);
    setMengirim(false);
    selesaiAksi();
    if (hasil.ok) {
      toast(hasil.pesan ?? pesanSukses ?? "Tersimpan.");
      if (setelah?.arah) router.push(setelah.arah);
      else segar();
      return true;
    }
    lokal?.padaGalat?.();
    toast.galat(hasil.pesan);
    return false;
  }

  return { jalan, mengirim };
}
