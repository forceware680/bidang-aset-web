import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/// Alamat lama /pengaturan?tab=nama dan /pengaturan/nama masuk ke daftar pertama.
export default async function DaftarNamaIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const bagian = String(sp.bagian ?? "");
  const nama = sp.nama ? `?nama=${encodeURIComponent(String(sp.nama))}` : "";
  redirect(`/pengaturan/nama${bagian ? `/${bagian}` : "/pengirim"}${nama}`);
}
