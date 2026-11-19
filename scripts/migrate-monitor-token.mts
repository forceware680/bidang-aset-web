import { buka, jalankan } from "./lib-migrate.mts";

const prisma = await buka();
await jalankan(prisma, "db/migrate-010-monitor-token.sql");

const tabel = await prisma.$queryRaw<{ ada: boolean }[]>`
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='monitor_token') AS ada`;
console.log("tabel monitor_token:", tabel[0].ada ? "ada" : "tidak ada");

const hak = await prisma.$queryRaw<{ hak: string }[]>`
  SELECT DISTINCT privilege_type AS hak FROM information_schema.role_table_grants
  WHERE grantee='aset_app' AND table_name='monitor_token'`;
console.log("hak aset_app:", hak.map((h) => h.hak).join(", "));

await prisma.$disconnect();
