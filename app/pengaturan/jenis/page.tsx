import { redirect } from "next/navigation";

/** Halaman jenis sekarang dipisah: satu daftar per arah. Alamat lama tanpa arah tetap diterima. */
export default async function JenisSuratIndexPage() {
  redirect("/pengaturan/jenis/masuk");
}
