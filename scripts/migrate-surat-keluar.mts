import { buka, jalankan } from "./lib-migrate.mts";

const prisma = await buka();

// jenis_surat.arah ditambahkan lebih dulu supaya migrasi surat keluar bisa memakai arah masuk/keluar.
await prisma.$executeRawUnsafe(`ALTER TABLE jenis_surat ADD COLUMN IF NOT EXISTS arah varchar(10) NOT NULL DEFAULT 'masuk' CHECK (arah IN ('masuk','keluar'))`);

await jalankan(prisma, "db/migrate-004-surat-keluar.sql");
await jalankan(prisma, "db/seed-003-surat-keluar.sql");

const objek = await prisma.$queryRaw<{ nama: string }[]>`
  SELECT table_name AS nama FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name IN ('surat_keluar','lampiran_keluar','master_penerima','keluar_counter')
  UNION ALL
  SELECT table_name FROM information_schema.views WHERE table_schema='public' AND table_name='v_surat_keluar_aktif'
  ORDER BY nama`;
console.log("objek yang ada:", objek.map((o) => o.nama).join(", "));

const trigger = await prisma.$queryRaw<{ nama: string }[]>`
  SELECT tgname AS nama FROM pg_trigger WHERE NOT tgisinternal AND tgrelid::regclass::text IN ('surat_keluar','master_penerima') ORDER BY nama`;
console.log("trigger:", trigger.map((t) => t.nama).join(", "));

const arah = await prisma.$queryRaw<{ arah: string; jumlah: bigint }[]>`SELECT arah, count(*) AS jumlah FROM jenis_surat GROUP BY arah ORDER BY arah`;
console.log("klasifikasi:", arah.map((a) => `${a.arah}=${Number(a.jumlah)}`).join(", "));
const tujuan = await prisma.$queryRaw<{ jumlah: bigint }[]>`SELECT count(*) AS jumlah FROM master_penerima`;
console.log("tujuan surat keluar:", Number(tujuan[0].jumlah));

// Nomor otomatis: coba buat satu, lalu kembalikan penghitungnya supaya nomor asli tidak terbuang.
const contoh = await prisma.$queryRaw<{ nomor: string }[]>`SELECT next_nomor_keluar(EXTRACT(year FROM CURRENT_DATE)::int) AS nomor`;
console.log("contoh nomor:", contoh[0].nomor);
await prisma.$executeRawUnsafe(`UPDATE keluar_counter SET nomor_terakhir = nomor_terakhir - 1 WHERE tahun = EXTRACT(year FROM CURRENT_DATE)::int`);

const hak = await prisma.$queryRaw<{ objek: string; hak: string }[]>`
  SELECT lower(p.table_name) AS objek, p.privilege_type AS hak
  FROM information_schema.role_table_grants p
  WHERE p.grantee = 'aset_app' AND p.table_schema = 'public'
    AND p.table_name IN ('surat_keluar','lampiran_keluar','master_penerima','keluar_counter','v_surat_keluar_aktif')
  ORDER BY objek, hak`;
console.log("hak aset_app:", hak.map((h) => `${h.objek}:${h.hak}`).join(", "));

await prisma.$disconnect();
