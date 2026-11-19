/**
 * Pagar untuk skrip uji yang mengosongkan tabel surat masuk/disposisi/rapat di awal.
 * Data starter hasil impor (1606 surat + 5108 disposisi) adalah data nyata: pengosongan hanya boleh
 * terjadi di database uji. Set UJI_DB=1 untuk menyatakan "ini database uji".
 */
export async function jagaDatabaseNyata(prisma, namaSkrip) {
  if (process.env.UJI_DB === "1") return;
  const surat = await prisma.surat_masuk.count();
  const disposisi = await prisma.disposisi.count();
  if (surat > 0 || disposisi > 0) {
    await prisma.$disconnect();
    throw new Error(
      `${namaSkrip} mengosongkan tabel surat masuk dan disposisi di awal, tetapi database ini berisi data nyata (${surat} surat masuk, ${disposisi} disposisi). Jalankan di database uji dengan UJI_DB=1, atau arahkan DATABASE_URL ke database kosong.`,
    );
  }
}
