import { buka, jalankan } from "./lib-migrate.mts";

const prisma = await buka();
await jalankan(prisma, "db/migrate-012-apk-unduh.sql");

const tabel = await prisma.$queryRaw<{ ada: boolean }[]>`
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='apk_unduh') AS ada`;
console.log("tabel apk_unduh:", tabel[0].ada ? "ada" : "tidak ada");

const hak = await prisma.$queryRaw<{ hak: string }[]>`
  SELECT DISTINCT privilege_type AS hak FROM information_schema.role_table_grants
  WHERE grantee='aset_app' AND table_name='apk_unduh'`;
console.log("hak aset_app:", hak.map((h) => h.hak).join(", "));

await prisma.$disconnect();
