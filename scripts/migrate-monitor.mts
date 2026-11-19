import { buka, jalankan } from "./lib-migrate.mts";

const prisma = await buka();
await jalankan(prisma, "db/migrate-005-monitor-publish.sql");

const kolom = await prisma.$queryRaw<{ ada: boolean }[]>`
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jadwal_rapat' AND column_name='terbit') AS ada`;
console.log("kolom terbit:", kolom[0].ada ? "ada" : "tidak ada");

const view = await prisma.$queryRaw<{ jumlah: bigint }[]>`SELECT count(*) AS jumlah FROM v_agenda_monitor`;
console.log("agenda yang tampil di monitor:", Number(view[0].jumlah));

const hak = await prisma.$queryRaw<{ objek: string; hak: string }[]>`
  SELECT lower(p.table_name) AS objek, p.privilege_type AS hak
  FROM information_schema.role_table_grants p
  WHERE p.grantee = 'aset_app' AND p.table_schema = 'public'
    AND p.table_name IN ('v_agenda_monitor','jadwal_rapat')
  ORDER BY objek, hak`;
console.log("hak aset_app:", hak.map((h) => `${h.objek}:${h.hak}`).join(", "));

const indeks = await prisma.$queryRaw<{ nama: string }[]>`
  SELECT indexname AS nama FROM pg_indexes WHERE tablename='jadwal_rapat' AND indexname='idx_rapat_terbit'`;
console.log("indeks terbit:", indeks.length ? indeks[0].nama : "tidak ada");

await prisma.$disconnect();
