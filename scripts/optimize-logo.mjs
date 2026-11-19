import { readFileSync, writeFileSync } from "node:fs";

// Sumber: LOGO Bidang Aset-BPKAD.png (4726px RGBA, ~9 MB). Diubah jadi dua ukuran siap pakai:
// logo.png untuk UI (256px) dan logo-cetak.png untuk kop laporan (512px).
const sumber = "LOGO Bidang Aset-BPKAD.png";
const sharp = (await import("sharp")).default;

async function keluar(target, lebar) {
  const buffer = await sharp(readFileSync(sumber))
    .resize(lebar, lebar, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ palette: true, compressionLevel: 9, quality: 80 })
    .toBuffer();
  writeFileSync(target, buffer);
  const byte = buffer.length;
  console.log(`${target}: ${lebar}x${lebar}, ${Math.round(byte / 1024)} KB`);
}

await keluar("public/logo.png", 256);
await keluar("public/logo-cetak.png", 512);
