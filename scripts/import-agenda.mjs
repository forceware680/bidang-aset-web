// Import lembar agenda lama (tmp/agenda-import.json) ke surat_masuk + disposisi.
// Idempoten: surat dengan nomor_agenda yang sudah ada dilewati. Schema tidak diubah.
// Jalan: node --env-file=.env scripts/import-agenda.mjs [--dry]
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const dry = process.argv.includes("--dry");
const data = JSON.parse(readFileSync("tmp/agenda-import.json", "utf8"));
const p = new PrismaClient();
const day = (iso) => (iso ? new Date(iso + "T00:00:00Z") : null);

const UNIT = /^(subid|arsip|sub\.?bid|bidang)/i;
const jenisId = {};
if (!dry) for (const nama of data.kategori) {
  const j = await p.jenis_surat.upsert({
    where: { nama },
    update: {},
    create: { nama, arah: "masuk" },
  });
  jenisId[nama] = j.id;
}
if (!dry) for (const nama of data.pengirim) await p.master_pengirim.upsert({ where: { nama }, update: {}, create: { nama } });
if (!dry) for (const nama of data.pemberi) await p.master_pejabat.upsert({ where: { nama }, update: {}, create: { nama } });
if (!dry) for (const nama of data.penerima)
  await p.master_terusan.upsert({
    where: { nama },
    update: {},
    create: { nama, jenis: UNIT.test(nama) ? "unit" : "orang" },
  });

const ada = new Set((await p.surat_masuk.findMany({ select: { nomor_agenda: true } })).map((s) => s.nomor_agenda));
const baru = data.surat.filter((b) => !ada.has(b.nomor_agenda));
console.log(`surat di file: ${data.surat.length}, sudah ada di DB: ${data.surat.length - baru.length}, akan import: ${baru.length}`);

let masuk = 0, dispo = 0, gagal = 0;
for (let i = 0; i < baru.length; i += 100) {
  const chunk = baru.slice(i, i + 100);
  if (dry) { masuk += chunk.length; dispo += chunk.reduce((n, b) => n + b.disposisi.length, 0); continue; }
  try {
    await p.$transaction(chunk.map((b) =>
      p.surat_masuk.create({
        data: {
          nomor_agenda: b.nomor_agenda,
          tanggal_terima: day(b.tanggal_terima),
          pengirim: b.pengirim,
          nomor_surat: b.nomor_surat,
          tanggal_surat: day(b.tanggal_surat),
          perihal: b.perihal,
          jenis_surat_id: b.kategori ? jenisId[b.kategori] : null,
          status_surat: b.status_surat,
          status_undangan_rapat: "belum",
          disposisi: {
            create: b.disposisi.map((d) => ({
              tanggal_disposisi: day(d.tanggal_disposisi),
              pemberi_disposisi: d.pemberi_disposisi,
              penerima_disposisi: d.penerima_disposisi,
              tanggal_diteruskan: day(d.tanggal_diteruskan),
              isi_disposisi: d.isi_disposisi,
              status_tindak_lanjut: "belum",
            })),
          },
        },
      })
    ));
    masuk += chunk.length;
    dispo += chunk.reduce((n, b) => n + b.disposisi.length, 0);
  } catch (e) {
    gagal += chunk.length;
    console.error(`gagal chunk ${i}: ${e.message?.slice(0, 200)}`);
  }
}
if (!dry && masuk > 0) {
  await p.audit_logs.create({
    data: {
      action: "import_agenda",
      entity_type: "surat_masuk",
      description: `Import lembar agenda lama: ${masuk} surat masuk, ${dispo} disposisi (${baru.length - masuk} surat gagal)`,
    },
  });
}
console.log(`selesai: surat=${masuk} disposisi=${dispo} gagal=${gagal}${dry ? " (dry run, tidak menulis)" : ""}`);
await p.$disconnect();
