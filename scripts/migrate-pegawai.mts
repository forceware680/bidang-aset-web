import { buka, jalankan } from "./lib-migrate.mts";

const prisma = await buka();
await jalankan(prisma, "db/migrate-006-master-pegawai.sql");

const tabel = await prisma.$queryRaw<{ ada: boolean }[]>`
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='master_pegawai') AS ada`;
console.log("tabel master_pegawai:", tabel[0].ada ? "ada" : "tidak ada");

const hak = await prisma.$queryRaw<{ hak: string }[]>`
  SELECT DISTINCT privilege_type AS hak FROM information_schema.role_table_grants
  WHERE grantee='aset_app' AND table_name='master_pegawai'`;
console.log("hak aset_app:", hak.map((h) => h.hak).join(", "));

const isi = await prisma.$queryRaw<{ jumlah: bigint }[]>`SELECT count(*) AS jumlah FROM master_pegawai`;
console.log("nama pegawai tersimpan:", Number(isi[0].jumlah));

await prisma.$disconnect();
