import { buka, jalankan } from "./lib-migrate.mts";

const prisma = await buka();
await jalankan(prisma, "db/migrate-009-rapat-mandiri.sql");

// Agenda tanpa surat harus terbaca di view sekarang.
const mandiri = await prisma.$queryRaw<{ jumlah: bigint }[]>`
  SELECT count(*) AS jumlah FROM v_rapat_aktif WHERE surat_id IS NULL`;
const semua = await prisma.$queryRaw<{ jumlah: bigint }[]>`SELECT count(*) AS jumlah FROM v_rapat_aktif`;
console.log(`rapat dengan surat: ${Number(semua[0].jumlah) - Number(mandiri[0].jumlah)}, agenda mandiri: ${Number(mandiri[0].jumlah)}`);

const hak = await prisma.$queryRaw<{ hak: string }[]>`
  SELECT privilege_type AS hak FROM information_schema.role_table_grants
  WHERE grantee = 'aset_app' AND table_schema = 'public' AND table_name IN ('v_rapat_aktif','v_agenda_monitor')
  ORDER BY table_name, hak`;
console.log("hak aset_app:", hak.map((h) => h.hak).join(", ") || "tidak ada");

// Agenda yang dibatalkan harus terbaca monitor.
const batal = await prisma.$queryRaw<{ jumlah: bigint }[]>`
  SELECT count(*) AS jumlah FROM v_agenda_monitor WHERE status_rapat = 'dibatalkan'`;
const selesai = await prisma.$queryRaw<{ jumlah: bigint }[]>`
  SELECT count(*) AS jumlah FROM v_agenda_monitor WHERE status_rapat = 'selesai'`;
console.log(`agenda dibatalkan yang terbaca: ${Number(batal[0].jumlah)}, agenda selesai yang terbaca: ${Number(selesai[0].jumlah)}`);

await prisma.$disconnect();
