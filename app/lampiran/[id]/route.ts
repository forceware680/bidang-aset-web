import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { pathAbsolut } from "@/lib/uploads";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Semua peran yang login boleh membaca dokumen; daftar surat juga terbaca oleh Pembaca.
  try {
    await requireUser();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { id } = await ctx.params;
  // Satu alamat unduhan untuk dua tabel lampiran; surat masuk dan surat keluar memakai folder yang sama.
  const lampiran =
    (await prisma.lampiran_surat.findUnique({ where: { id } })) ??
    (await prisma.lampiran_keluar.findUnique({ where: { id } }));
  if (!lampiran) {
    return new NextResponse("Lampiran tidak ditemukan.", { status: 404 });
  }

  let isi: Buffer;
  try {
    isi = await readFile(pathAbsolut(lampiran.path_file));
  } catch {
    return new NextResponse(`Berkas ${lampiran.nama_asli} sudah tidak tersimpan di aplikasi.`, { status: 410 });
  }

  return new NextResponse(new Uint8Array(isi), {
    status: 200,
    headers: {
      "Content-Type": lampiran.mime_type,
      "Content-Length": String(isi.length),
      // Nama asli dipertahankan agar file tersimpan dengan nama yang dikenali petugas.
      "Content-Disposition": `${lampiran.mime_type.startsWith("image/") ? "inline" : "attachment"}; filename="${lampiran.nama_asli}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
