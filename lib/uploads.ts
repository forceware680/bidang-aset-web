import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { BATAS_LAMPIRAN } from "@/lib/format";

// Jenis file yang diterima mengikuti constraint mime di database. File lain ditolak
// sebelum ditulis ke disk supaya folder uploads tidak menampung berkas asing.
const jenisDiterima = new Map<string, string>([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
]);

/** path_file di database disimpan sebagai nama berkas saja; foldernya tetap satu lokasi. */
export const folderLampiran = path.join(process.cwd(), "uploads");

export function pathAbsolut(namaBerkas: string) {
  return path.join(folderLampiran, namaBerkas);
}

export async function simpanLampiran(file: File) {
  const ekstensi = jenisDiterima.get(file.type);
  if (!ekstensi) {
    throw new Error("Berkas yang bisa diunggah hanya PDF, JPG, atau PNG.");
  }
  if (file.size === 0) {
    throw new Error("Berkas kosong, tidak disimpan.");
  }
  if (file.size > BATAS_LAMPIRAN) {
    throw new Error(`Berkas terlalu besar, maksimal 20 MB. Berkas ini ${Math.round(file.size / 1024 / 1024)} MB.`);
  }

  const namaAsli = file.name.replace(/[^\w.\-\s]/g, "_").slice(0, 200) || `lampiran.${ekstensi}`;
  const namaBerkas = `${crypto.randomUUID()}.${ekstensi}`;

  await mkdir(folderLampiran, { recursive: true });
  await writeFile(pathAbsolut(namaBerkas), Buffer.from(await file.arrayBuffer()));

  return { namaAsli, namaBerkas };
}

export async function hapusLampiranDisk(namaBerkas: string) {
  await rm(pathAbsolut(namaBerkas), { force: true });
}
