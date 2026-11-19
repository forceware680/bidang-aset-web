const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();
const dump = {
  surat: await p.surat_masuk.findMany(),
  disposisi: await p.disposisi.findMany(),
  rapat: await p.jadwal_rapat.findMany(),
  riwayat: await p.riwayat_jadwal_rapat.findMany(),
  peserta: await p.peserta_rapat.findMany(),
  lampiran: await p.lampiran_surat.findMany(),
  counter: await p.agenda_counter.findMany(),
  audit: await p.audit_logs.findMany(),
};
for (const [k, v] of Object.entries(dump)) {
  for (const row of v) {
    for (const [key, val] of Object.entries(row)) {
      if (val instanceof Date) row[key] = val.toISOString();
      else if (typeof val === "bigint") row[key] = val.toString();
    }
  }
}
const file = ".shots/db-backup.json";
await (await import("node:fs/promises")).writeFile(file, JSON.stringify(dump, null, 1));
console.log(
  Object.entries(dump)
    .map(([k, v]) => `${k}=${v.length}`)
    .join(" ") + ` → ${file}`,
);
await p.$disconnect();
