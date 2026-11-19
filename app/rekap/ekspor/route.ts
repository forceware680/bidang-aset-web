import ExcelJS from "exceljs";
import { requireUser } from "@/lib/auth";
import { namaBulan } from "@/lib/format";
import { labelStatusSurat, labelStatusSuratKeluar, labelUndangan } from "@/lib/status";
import { rekapPerBulan, rekapPerJenis, suratKeluarPeriode, suratPeriode, tahunSurat, totalPeriode } from "@/lib/rekap";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireUser();
  } catch {
    return new Response("Perlu login untuk mengunduh ekspor.", { status: 401 });
  }

  const url = new URL(req.url);
  const tahunList = await tahunSurat();
  const tahun = Number(url.searchParams.get("tahun") ?? tahunList[0] ?? new Date().getFullYear());
  const mulai = new Date(`${tahun}-01-01T00:00:00Z`);
  const akhir = new Date(`${tahun}-12-31T23:59:59Z`);

  const perBulan = await rekapPerBulan(mulai, akhir);
  const perJenis = await rekapPerJenis(mulai, akhir);
  const surat = await suratPeriode(mulai, akhir);
  const keluar = await suratKeluarPeriode(mulai, akhir);
  const total = totalPeriode(perBulan);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Bidang Aset BPKAD Kota Magelang";

  const bulan = wb.addWorksheet("Rekap per bulan");
  bulan.addRow([
    "Bulan",
    "Surat masuk",
    "Surat keluar",
    "Surat keluar dikirim",
    "Surat beragenda",
    "Surat tanpa agenda",
    "Belum didisposisikan",
    "Disposisi dibuat",
    "Disposisi selesai",
    "Agenda dijadwalkan",
    "Agenda dilaksanakan",
    "Agenda dibatalkan",
  ]);
  for (const b of perBulan) {
    bulan.addRow([
      namaBulan(b.bulan),
      b.surat,
      b.keluar,
      b.keluarDikirim,
      b.undangan,
      b.nonrapat,
      b.belumDidisposisikan,
      b.disposisiTotal,
      b.disposisiSelesai,
      b.rapatDijadwalkan,
      b.rapatDilaksanakan,
      b.rapatDibatalkan,
    ]);
  }
  bulan.addRow([
    `Total ${tahun}`,
    total.surat,
    total.keluar,
    total.keluarDikirim,
    total.undangan,
    total.nonrapat,
    total.belumDidisposisikan,
    total.disposisiTotal,
    total.disposisiSelesai,
    total.rapat,
    total.rapatDilaksanakan,
    total.rapatDibatalkan,
  ]);
  bulan.getColumn(1).width = 22;
  bulan.getRow(1).font = { bold: true };

  const jenis = wb.addWorksheet("Rekap per kategori");
  jenis.addRow(["Kategori surat", "Jumlah surat"]);
  for (const r of perJenis) jenis.addRow([r.jenis, r.surat]);
  jenis.getColumn(1).width = 30;
  jenis.getRow(1).font = { bold: true };

  const daftar = wb.addWorksheet("Daftar surat");
  daftar.addRow([
    "Nomor agenda",
    "Tanggal terima",
    "Pengirim",
    "Nomor surat",
    "Perihal",
    "Status surat",
    "Kaitan surat dengan agenda",
  ]);
  for (const s of surat) {
    daftar.addRow([
      s.nomor_agenda,
      s.tanggal_terima,
      s.pengirim,
      s.nomor_surat ?? "",
      s.perihal,
      labelStatusSurat[s.status_surat],
      labelUndangan[s.status_undangan_rapat],
    ]);
  }
  daftar.getColumn(2).width = 14;
  daftar.getColumn(2).numFmt = "yyyy-mm-dd";
  daftar.getColumn(4).width = 26;
  daftar.getColumn(5).width = 45;
  daftar.getRow(1).font = { bold: true };

  const daftarKeluar = wb.addWorksheet("Daftar surat keluar");
  daftarKeluar.addRow([
    "Nomor surat",
    "Tanggal surat",
    "Tujuan",
    "Kategori surat",
    "Perihal",
    "Status surat",
    "Tanggal kirim",
    "Jumlah lampiran",
  ]);
  for (const s of keluar) {
    daftarKeluar.addRow([
      s.nomor_surat,
      s.tanggal_surat,
      s.tujuan,
      s.jenis ?? "",
      s.perihal,
      labelStatusSuratKeluar[s.status_surat],
      s.tanggal_kirim ?? "",
      Number(s.lampiran ?? 0),
    ]);
  }
  daftarKeluar.getColumn(2).width = 14;
  daftarKeluar.getColumn(2).numFmt = "yyyy-mm-dd";
  daftarKeluar.getColumn(7).numFmt = "yyyy-mm-dd";
  daftarKeluar.getColumn(3).width = 26;
  daftarKeluar.getColumn(5).width = 45;
  daftarKeluar.getRow(1).font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rekap-agenda-aset-${tahun}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
