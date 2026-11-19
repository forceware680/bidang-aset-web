import { buka, jalankan } from "./lib-migrate.mts";

const prisma = await buka();
await jalankan(prisma, "db/migrate-008-memberi.sql");

// Pemicunya harus ada di semua tabel yang dikirim ke kanal, bukan hanya satu.
const pemicu = await prisma.$queryRaw<{ tabel: string; jumlah: bigint }[]>`
  SELECT t.relname AS tabel, count(*) AS jumlah
  FROM pg_trigger tg
  JOIN pg_class t ON t.oid = tg.tgrelid
  WHERE tg.tgname LIKE 'trg_memberi_%' AND NOT tg.tgisinternal
  GROUP BY t.relname
  ORDER BY t.relname`;
console.log("pemicu pemberitahuan:", pemicu.map((p) => `${p.tabel} (${Number(p.jumlah)})`).join(", ") || "tidak ada");

// Kanal harus bisa dipicu oleh akun aplikasi (pemicu berjalan sebagai pengguna yang menulis baris).
const hakFungsi = await prisma.$queryRaw<{ ada: boolean }[]>`
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE p.proname = 'beri_tahu_perubahan'
      AND has_function_privilege('aset_app', p.oid, 'EXECUTE')
  ) AS ada`;
console.log("aset_app boleh memicu beri_tahu_perubahan:", hakFungsi[0].ada ? "ya" : "tidak");

// Uji sungguhan: satu tulis dan satu hapus harus keluar lewat kanal.
const { Client } = await import("pg");
const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
await pg.query("LISTEN aset_perubahan");
const pesan: string[] = [];
pg.on("notification", (n) => pesan.push(n.payload ?? ""));

const nomor = "UJI/Pemberitahuan-008";
await prisma.$executeRaw`INSERT INTO surat_masuk (nomor_agenda, tanggal_terima, pengirim, nomor_surat, tanggal_surat, perihal)
  VALUES ('UJI/PG-008', now(), 'Uji pemberitahuan', ${nomor}, now(), 'Uji kanal pemberitahuan')`;
await pg.query("SELECT 1");
await prisma.$executeRaw`DELETE FROM surat_masuk WHERE nomor_surat = ${nomor}`;
await pg.query("SELECT 1");

await pg.end();
console.log("pesan lewat kanal:", pesan.length ? pesan.join(" | ") : "tidak ada");
await prisma.$disconnect();
