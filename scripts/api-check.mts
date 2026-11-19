/**
 * Pemeriksa REST API untuk aplikasi Android: masuk dengan akun yang sama, kalender bidang untuk semua akun,
 * dan hanya agenda milik sendiri yang bisa diubah atau dihapus. Surat masuk, disposisi, surat keluar,
 * lampiran, dan rekap tidak dibuka lewat API — alamatnya memang tidak ada.
 * Jalankan: npm run test:api (butuh server dev di http://localhost:3000)
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3000";
const PASSWORD_PETUGAS = "BCed08Gkc34dF1RM";
const PASSWORD_PIMPINAN = "mMs3HSiLBJPOdR5X";
const EMAIL_PETUGAS = "petugas.aset@magelang.go.id";
const EMAIL_PIMPINAN = "pimpinan@magelang.go.id";

const hasil: string[] = [];
function cat(nama: string, ok: boolean, detail = "") {
  hasil.push(`${ok ? "PASS" : "FAIL"} ${nama}${detail ? `  (${detail})` : ""}`);
}

async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, json };
}

const teks = (json: Record<string, unknown> | null, kunci: string) => String(json?.[kunci] ?? "");
const daftar = (json: Record<string, unknown> | null) => (Array.isArray(json?.agenda) ? (json!.agenda as Record<string, unknown>[]) : []);
// Daftar Nama yang hadir: API mengirimnya sebagai daftar, bukan satu teks, karena nama orang bisa mengandung koma.
const pesertaDari = (item: Record<string, unknown> | null) => (Array.isArray(item?.peserta) ? (item!.peserta as string[]) : null);
// Daftar pemberitahuan peserta dari /api/pemberitahuan: satu baris per peserta yang ditambahkan orang lain.
const pemberitahuanDari = (json: Record<string, unknown> | null) => (Array.isArray(json?.pemberitahuan) ? (json!.pemberitahuan as Record<string, unknown>[]) : []);
const mulaiHari = (item: Record<string, unknown>) => teks(item, "mulai").slice(0, 10);

// uuid kosong yang sah: dipakai bila sebuah agenda gagal dibuat, supaya alamat /api/agenda/<id> tetap
// menjawab 404 dan bukan melempar galat format uuid.
const ID_NILAI = "00000000-0000-0000-0000-000000000000";

const prisma = new PrismaClient();
const mulaiUji = new Date();

// Data uji: satu surat masuk yang jadi undangan rapat (agendanya datang dari surat) dan akun sementara nonaktif.
const suratLama = await prisma.surat_masuk.findFirst({ where: { nomor_agenda: "UJ/API-surat" }, select: { id: true } });
if (suratLama) {
  await prisma.jadwal_rapat.deleteMany({ where: { surat_id: suratLama.id } });
  await prisma.surat_masuk.delete({ where: { id: suratLama.id } });
}
const rolePetugas = await prisma.roles.findFirst({ where: { name: "Petugas Agenda" }, select: { id: true } });
const akunNonaktif = await prisma.users.create({
  data: {
    name: "Uji API akun nonaktif",
    email: `uji.api.nonaktif.${Date.now()}@magelang.go.id`,
    password_hash: await bcrypt.hash("sandiujiapi", 10),
    role_id: rolePetugas?.id ?? (await prisma.roles.findFirst({ select: { id: true } }))!.id,
    is_active: false,
  },
  select: { id: true, email: true },
});
const besok = new Date(Date.now() + 24 * 60 * 60 * 1000);
const hariBesok = besok.toISOString().slice(0, 10);
const surat = await prisma.surat_masuk.create({
  data: {
    nomor_agenda: "UJ/API-surat",
    tanggal_terima: mulaiUji,
    pengirim: "Uji API kalender",
    perihal: "Uji agenda dari surat untuk API Android",
    status_undangan_rapat: "ya",
  },
  select: { id: true, nomor_agenda: true },
});
const rapatSurat = await prisma.jadwal_rapat.create({
  data: {
    surat_id: surat.id,
    agenda_rapat: "Uji API agenda dari surat",
    tanggal_mulai: new Date(`${hariBesok}T10:00:00+07:00`),
    tempat: "Ruang rapat uji",
  },
  select: { id: true },
});
const idAkunUji = [surat.id, rapatSurat.id, akunNonaktif.id];

// Peserta agenda dari surat: nama yang hadir ikut terbaca oleh aplikasi Android, urut nama.
const pesertaUji = ["Uji Peserta Satu", "Uji Peserta Dua"].sort();
await prisma.peserta_rapat.createMany({
  data: pesertaUji.map((nama) => ({ rapat_id: rapatSurat.id, nama_peserta: nama, instansi_bidang: "BPKAD - Bidang Aset" })),
});
await prisma.$disconnect();

const baru: string[] = [];
try {
  // --- masuk ---
  const masukPetugas = await api("POST", "/api/masuk", undefined, { email: EMAIL_PETUGAS, password: PASSWORD_PETUGAS, perangkat: "HP petugas uji" });
  cat("masuk petugas mengirim token", masukPetugas.status === 200 && teks(masukPetugas.json, "token").length > 20, `status ${masukPetugas.status}`);
  cat("masuk menyebut nama dan peran akun", teks(masukPetugas.json, "nama").length > 0 && teks(masukPetugas.json, "peran").length > 0, `${teks(masukPetugas.json, "nama")} / ${teks(masukPetugas.json, "peran")}`);
  cat("masuk menyebut batas token kedaluwarsa", teks(masukPetugas.json, "kedaluwarsa").length > 0);
  const tokenPetugas = teks(masukPetugas.json, "token");

  const masukPimpinan = await api("POST", "/api/masuk", undefined, { email: EMAIL_PIMPINAN, password: PASSWORD_PIMPINAN, perangkat: "HP pimpinan uji" });
  const tokenPimpinan = teks(masukPimpinan.json, "token");
  cat("masuk pimpinan mengirim token sendiri", masukPimpinan.status === 200 && tokenPimpinan !== tokenPetugas);

  const salahKata = await api("POST", "/api/masuk", undefined, { email: EMAIL_PETUGAS, password: "salahsekali" });
  cat("kata sandi salah ditolak 401", salahKata.status === 401 && teks(salahKata.json, "pesan").includes("kata sandi"), `status ${salahKata.status}`);

  const emailAsing = await api("POST", "/api/masuk", undefined, { email: "tidak.ada@magelang.go.id", password: PASSWORD_PETUGAS });
  cat("email yang tidak ada ditolak 401", emailAsing.status === 401 && emailAsing.json?.ok === false);

  const akunNonaktifMasuk = await api("POST", "/api/masuk", undefined, { email: akunNonaktif.email, password: "sandiujiapi" });
  cat("akun nonaktif ditolak 403 dengan penjelasan", akunNonaktifMasuk.status === 403 && teks(akunNonaktifMasuk.json, "pesan").includes("dinonaktifkan"), `status ${akunNonaktifMasuk.status}`);

  const tanpaIsian = await api("POST", "/api/masuk", undefined, { email: "", password: "" });
  cat("email dan kata sandi kosong ditolak 400", tanpaIsian.status === 400 && teks(tanpaIsian.json, "pesan").includes("wajib"));

  const bukanJson = await fetch(`${BASE}/api/masuk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "bukan json" });
  cat("isi permintaan yang bukan JSON ditolak 400", bukanJson.status === 400);

  // --- sesi ---
  const sesi = await api("GET", "/api/sesi", tokenPetugas);
  cat("sesi membaca akun yang masuk", sesi.status === 200 && teks(sesi.json, "email") === EMAIL_PETUGAS);
  const sesiTanpa = await api("GET", "/api/sesi");
  cat("sesi tanpa token ditolak 401", sesiTanpa.status === 401 && teks(sesiTanpa.json, "pesan").includes("Masuk lagi"));
  const sesiAcak = await api("GET", "/api/sesi", "token-yang-bukan-milik-aplikasi");
  cat("token acak ditolak 401", sesiAcak.status === 401);

  // --- tambah agenda sendiri ---
  const buat = await api("POST", "/api/agenda", tokenPetugas, {
    agenda_rapat: "Uji API agenda mandiri petugas",
    tanggal_mulai: `${hariBesok}T08:30`,
    tanggal_selesai: `${hariBesok}T10:30`,
    tempat: "Ruang Rapat A uji",
    penyelenggara: "Bidang Aset uji",
    catatan: "Uji untuk API Android",
  });
  const idSendiri = teks((buat.json?.agenda as Record<string, unknown> | undefined) ?? null, "id") || ID_NILAI;
  if (idSendiri) baru.push(idSendiri);
  cat("agenda sendiri tersimpan (201)", buat.status === 201 && idSendiri.length > 0, `status ${buat.status}`);
  const itemSendiri = (buat.json?.agenda as Record<string, unknown> | undefined) ?? null;
  cat("agenda sendiri ditandai dapat diubah dan dapat dihapus", itemSendiri?.dapat_diubah === true && itemSendiri?.dapat_dihapus === true);
  cat("agenda sendiri menyebut sumbernya agenda sendiri", teks(itemSendiri, "sumber") === "agenda sendiri");
  cat("waktu agenda memakai offset Asia/Jakarta (+07:00)", teks(itemSendiri, "mulai").endsWith("+07:00"), teks(itemSendiri, "mulai"));
  cat("waktu agenda juga dikirim dalam UTC", teks(itemSendiri, "mulai_utc").endsWith("Z"));
  cat("status awal agenda adalah terjadwal", teks(itemSendiri, "status_rapat") === "terjadwal" && teks(itemSendiri, "status_label") === "Terjadwal");

  const tanpaToken = await api("POST", "/api/agenda", undefined, { agenda_rapat: "Uji API tanpa token", tanggal_mulai: `${hariBesok}T08:00` });
  cat("menambah agenda tanpa token ditolak 401", tanpaToken.status === 401);

  const judulPendek = await api("POST", "/api/agenda", tokenPetugas, { agenda_rapat: "ab", tanggal_mulai: `${hariBesok}T08:00` });
  cat("agenda yang terlalu pendek ditolak 400", judulPendek.status === 400 && teks(judulPendek.json, "pesan").includes("minimal 3"));

  const waktuSalah = await api("POST", "/api/agenda", tokenPetugas, { agenda_rapat: "Uji API waktu salah", tanggal_mulai: "kemarin" });
  cat("waktu mulai yang tidak dikenali ditolak 400 dengan contoh", waktuSalah.status === 400 && teks(waktuSalah.json, "pesan").includes("2026"));

  const selesaiMendahului = await api("POST", "/api/agenda", tokenPetugas, { agenda_rapat: "Uji API selesai mendahului", tanggal_mulai: `${hariBesok}T11:00`, tanggal_selesai: `${hariBesok}T09:00` });
  cat("waktu selesai yang mendahului waktu mulai ditolak 400", selesaiMendahului.status === 400 && teks(selesaiMendahului.json, "pesan").includes("setelah"));

  const tempatPanjang = await api("POST", "/api/agenda", tokenPetugas, { agenda_rapat: "Uji API tempat panjang", tanggal_mulai: `${hariBesok}T08:00`, tempat: "x".repeat(301) });
  cat("tempat yang terlalu panjang ditolak 400", tempatPanjang.status === 400 && teks(tempatPanjang.json, "pesan").includes("300"));

  // --- peserta saat membuat agenda sendiri lewat API ---
  const namaPetugas = (await prisma.users.findFirst({ where: { email: EMAIL_PETUGAS }, select: { name: true } }))?.name ?? "";
  const namaPimpinan = (await prisma.users.findFirst({ where: { email: EMAIL_PIMPINAN }, select: { name: true } }))?.name ?? "";
  const buatPeserta = await api("POST", "/api/agenda", tokenPetugas, {
    agenda_rapat: "Uji API agenda dengan peserta",
    tanggal_mulai: `${hariBesok}T16:00`,
    peserta: namaPimpinan ? [namaPimpinan] : [],
  });
  const idPeserta = teks((buatPeserta.json?.agenda as Record<string, unknown> | undefined) ?? null, "id") || ID_NILAI;
  if (idPeserta) baru.push(idPeserta);
  cat("agenda dengan peserta berakun tersimpan (201)", buatPeserta.status === 201 && idPeserta.length > 0, `status ${buatPeserta.status}`);
  const harapanPeserta = [namaPetugas, namaPimpinan].filter(Boolean).sort();
  cat("pembuat agenda otomatis ikut dan yang dipilih ikut tercatat", JSON.stringify((pesertaDari(buatPeserta.json?.agenda as Record<string, unknown> | undefined) ?? []).slice().sort()) === JSON.stringify(harapanPeserta), JSON.stringify(pesertaDari(buatPeserta.json?.agenda as Record<string, unknown> | undefined)));

  const pesertaLuar = await api("POST", "/api/agenda", tokenPetugas, {
    agenda_rapat: "Uji API peserta tanpa akun",
    tanggal_mulai: `${hariBesok}T16:00`,
    peserta: ["Nama uji tidak punya akun xyz"],
  });
  cat("peserta tanpa akun aplikasi ditolak 400", pesertaLuar.status === 400 && teks(pesertaLuar.json, "pesan").includes("akun aplikasi"), teks(pesertaLuar.json, "pesan"));

  const pesertaBanyak = await api("POST", "/api/agenda", tokenPetugas, {
    agenda_rapat: "Uji API peserta terlalu banyak",
    tanggal_mulai: `${hariBesok}T16:00`,
    peserta: Array.from({ length: 26 }, (_, i) => `Uji peserta ${i}`),
  });
  cat("lebih dari 25 peserta ditolak 400", pesertaBanyak.status === 400 && teks(pesertaBanyak.json, "pesan").includes("25"), teks(pesertaBanyak.json, "pesan"));

  // --- pemberitahuan peserta: bel notifikasi di aplikasi Android ---
  // Baris peserta lama bisa berbeda ejaan dengan nama akun (mis. hasil impor Excel), jadi pencocokan
  // pemberitahuan memakai aturan longgar yang sama dengan `ikut` di kalender.
  await prisma.pemberitahuan_peserta.create({
    data: { rapat_id: rapatSurat.id, nama_peserta: `${namaPimpinan} S., H.`, oleh: namaPetugas },
  });

  const papanPimpinan = await api("GET", "/api/pemberitahuan", tokenPimpinan);
  const papanPimpinanIsi = pemberitahuanDari(papanPimpinan.json);
  cat(
    "pemberitahuan peserta sampai di HP peserta",
    papanPimpinan.status === 200 && papanPimpinanIsi.some((p) => teks(p, "agenda_rapat") === "Uji API agenda dengan peserta" && teks(p, "oleh") === namaPetugas),
    `jumlah ${papanPimpinanIsi.length}`,
  );
  cat(
    "nama peserta longgar cocok dengan nama akun",
    papanPimpinanIsi.some((p) => teks(p, "agenda_rapat").startsWith("Uji API agenda dari surat")),
    JSON.stringify(papanPimpinanIsi.map((p) => teks(p, "agenda_rapat"))),
  );
  cat("pemberitahuan menyebut waktu agenda dan rapatnya", papanPimpinanIsi.every((p) => teks(p, "mulai").length > 0 && teks(p, "rapat_id").length > 0));

  const papanPetugas = await api("GET", "/api/pemberitahuan", tokenPetugas);
  cat(
    "pembuat tidak mendapat pemberitahuan tentang dirinya sendiri",
    pemberitahuanDari(papanPetugas.json).every((p) => teks(p, "agenda_rapat") !== "Uji API agenda dengan peserta"),
    `jumlah ${pemberitahuanDari(papanPetugas.json).length}`,
  );

  const papanTanpa = await api("GET", "/api/pemberitahuan");
  cat("pemberitahuan tanpa token ditolak 401", papanTanpa.status === 401);

  const papanSekarang = await api("GET", `/api/pemberitahuan?sejak=${encodeURIComponent(new Date().toISOString())}`, tokenPimpinan);
  cat("sejak hanya menampilkan peristiwa yang lebih baru", papanSekarang.status === 200 && pemberitahuanDari(papanSekarang.json).length === 0, `jumlah ${pemberitahuanDari(papanSekarang.json).length}`);

  const papanSejakSalah = await api("GET", "/api/pemberitahuan?sejak=bukan-waktu", tokenPimpinan);
  cat("waktu sejak yang tidak dikenali ditolak 400", papanSejakSalah.status === 400 && teks(papanSejakSalah.json, "pesan").includes("sejak"));

  // agenda pimpinan dibuat lewat API, supaya ada agenda milik orang lain
  const buatPimpinan = await api("POST", "/api/agenda", tokenPimpinan, { agenda_rapat: "Uji API agenda pimpinan", tanggal_mulai: `${hariBesok}T14:00` });
  const idPimpinan = teks((buatPimpinan.json?.agenda as Record<string, unknown> | undefined) ?? null, "id") || ID_NILAI;
  if (idPimpinan) baru.push(idPimpinan);
  cat("agenda pimpinan tersimpan lewat token pimpinan", buatPimpinan.status === 201 && idPimpinan.length > 0);

  // --- kalender ---
  const kalender = await api("GET", "/api/kalender", tokenPetugas);
  const agendaKalender = daftar(kalender.json);
  cat("kalender terbaca untuk petugas", kalender.status === 200 && agendaKalender.length > 0, `${agendaKalender.length} agenda`);
  cat("kalender bawaan mulai dari hari ini", teks(kalender.json, "mulai") === mulaiUji.toISOString().slice(0, 10) || teks(kalender.json, "mulai").length === 10, teks(kalender.json, "mulai"));
  cat("kalender urut dari waktu paling awal", agendaKalender.every((a, i) => i === 0 || teks(a, "mulai_utc") >= teks(agendaKalender[i - 1], "mulai_utc")));
  cat("agenda milik sendiri terbaca sebagai dapat diubah", agendaKalender.some((a) => teks(a, "id") === idSendiri && a.dapat_diubah === true));
  cat("agenda milik sendiri ditandai ikut oleh pembuatnya", agendaKalender.some((a) => teks(a, "id") === idSendiri && a.ikut === true && a.pejabat_lain === false));
  cat("agenda milik orang lain ditandai pejabat lain untuk akun ini", agendaKalender.some((a) => teks(a, "id") === idPimpinan && a.dapat_diubah === false && a.dapat_dihapus === false && a.ikut === false && a.pejabat_lain === true));
  cat("agenda dari surat terbaca dengan nomor suratnya", agendaKalender.some((a) => teks(a, "id") === rapatSurat.id && teks(a, "sumber") === "surat masuk" && teks(a, "nomor_surat") === surat.nomor_agenda && a.dapat_diubah === false));
  cat("agenda dari surat tidak boleh dihapus dari Android", agendaKalender.some((a) => teks(a, "id") === rapatSurat.id && a.dapat_dihapus === false));
  cat("agenda dari surat tidak ikut di akun yang bukan peserta", agendaKalender.some((a) => teks(a, "id") === rapatSurat.id && a.ikut === false && a.pejabat_lain === true));
  cat("agenda dari surat mengirim nama yang hadir", agendaKalender.some((a) => teks(a, "id") === rapatSurat.id && JSON.stringify(pesertaDari(a)) === JSON.stringify(pesertaUji) && a.jumlah_peserta === 2), JSON.stringify(pesertaDari(agendaKalender.find((a) => teks(a, "id") === rapatSurat.id) ?? null)));
  cat("agenda tanpa peserta terpilih tetap punya pembuatnya sebagai peserta", agendaKalender.some((a) => teks(a, "id") === idSendiri && JSON.stringify(pesertaDari(a)) === JSON.stringify([namaPetugas]) && a.jumlah_peserta === 1), JSON.stringify(pesertaDari(agendaKalender.find((a) => teks(a, "id") === idSendiri) ?? null)));
  cat("kalender menyebut jumlah agenda dan tidak memotong yang kecil", kalender.json?.jumlah === agendaKalender.length && kalender.json?.dipotong === false, `jumlah ${String(kalender.json?.jumlah)}`);

  const satuHari = await api("GET", `/api/kalender?hari=${hariBesok}`, tokenPetugas);
  const agendaHari = daftar(satuHari.json);
  cat("kalender satu tanggal hanya menampilkan tanggal itu", satuHari.status === 200 && agendaHari.length > 0 && agendaHari.every((a) => mulaiHari(a) === hariBesok), `${agendaHari.length} agenda`);
  cat("kalender satu tanggal tidak mencantumkan tanggal lain", agendaHari.every((a) => a.selesai === null || String(a.selesai).slice(0, 10) === hariBesok || String(a.selesai).slice(0, 10) > hariBesok));

  const rentang = await api("GET", `/api/kalender?mulai=${hariBesok}&selesai=${hariBesok}`, tokenPetugas);
  cat("rentang satu hari terbaca", rentang.status === 200 && daftar(rentang.json).length === agendaHari.length);

  const rentangLuas = await api("GET", `/api/kalender?mulai=${mulaiUji.toISOString().slice(0, 10)}&selesai=${hariBesok}`, tokenPetugas);
  cat("rentang luas menampilkan agenda dari kedua ujungnya", rentangLuas.status === 200 && daftar(rentangLuas.json).some((a) => mulaiHari(a) === hariBesok));

  const tanggalSalah = await api("GET", "/api/kalender?mulai=kemarin", tokenPetugas);
  cat("tanggal yang tidak dikenali ditolak 400", tanggalSalah.status === 400 && teks(tanggalSalah.json, "pesan").includes("yyyy-mm-dd"));

  const rentangBalik = await api("GET", `/api/kalender?mulai=${hariBesok}&selesai=${mulaiUji.toISOString().slice(0, 10)}`, tokenPetugas);
  cat("rentang yang selesai mendahului mulai ditolak 400", rentangBalik.status === 400 && teks(rentangBalik.json, "pesan").includes("setelah"));

  const campur = await api("GET", `/api/kalender?hari=${hariBesok}&mulai=${hariBesok}`, tokenPetugas);
  cat("hari dan rentang sekaligus ditolak 400", campur.status === 400 && teks(campur.json, "pesan").includes("salah satu"));

  const statusFilter = await api("GET", `/api/kalender?hari=${hariBesok}&status=terjadwal`, tokenPetugas);
  cat("filter status hanya menampilkan status itu", statusFilter.status === 200 && daftar(statusFilter.json).every((a) => teks(a, "status_rapat") === "terjadwal"));

  const statusSalah = await api("GET", `/api/kalender?hari=${hariBesok}&status=ramai`, tokenPetugas);
  cat("status yang tidak dikenali ditolak 400 dengan daftar pilihan", statusSalah.status === 400 && teks(statusSalah.json, "pesan").includes("terjadwal"));

  const sejakDepan = await api("GET", `/api/kalender?mulai=${mulaiUji.toISOString().slice(0, 10)}&sejak=${encodeURIComponent("2030-01-01T00:00:00+07:00")}`, tokenPetugas);
  cat("sejak di masa depan tidak menampilkan apa pun", sejakDepan.status === 200 && daftar(sejakDepan.json).length === 0 && sejakDepan.json?.jumlah === 0);

  const sejakSekarang = await api("GET", `/api/kalender?mulai=${mulaiUji.toISOString().slice(0, 10)}&sejak=${mulaiUji.toISOString()}`, tokenPetugas);
  cat("sejak menampilkan agenda yang baru diubah", sejakSekarang.status === 200 && daftar(sejakSekarang.json).some((a) => teks(a, "id") === idSendiri));

  const sejakSalah = await api("GET", `/api/kalender?sejak=bukan-waktu`, tokenPetugas);
  cat("waktu sejak yang tidak dikenali ditolak 400", sejakSalah.status === 400 && teks(sejakSalah.json, "pesan").includes("sejak"));

  const kalenderTanpaToken = await api("GET", "/api/kalender");
  cat("kalender tanpa token ditolak 401", kalenderTanpaToken.status === 401);

  // --- detail satu agenda ---
  const detail = await api("GET", `/api/agenda/${idSendiri}`, tokenPetugas);
  const detailAgenda = (detail.json?.agenda as Record<string, unknown> | undefined) ?? null;
  cat("agenda milik sendiri terbaca lewat detail", detail.status === 200 && teks(detailAgenda, "id") === idSendiri, `${detail.status} / ${teks(detailAgenda, "id")}`);
  const detailMilikLain = await api("GET", `/api/agenda/${idPimpinan}`, tokenPetugas);
  cat("agenda milik orang lain tetap terbaca lewat detail", detailMilikLain.status === 200 && (detailMilikLain.json?.agenda as Record<string, unknown>)?.dapat_diubah === false);
  const detailSurat = await api("GET", `/api/agenda/${rapatSurat.id}`, tokenPetugas);
  const agendaSurat = (detailSurat.json?.agenda as Record<string, unknown> | undefined) ?? null;
  cat("detail agenda dari surat mengirim nama yang hadir", detailSurat.status === 200 && JSON.stringify(pesertaDari(agendaSurat)) === JSON.stringify(pesertaUji), JSON.stringify(pesertaDari(agendaSurat)));
  const detailTidakAda = await api("GET", "/api/agenda/00000000-0000-0000-0000-000000000000", tokenPetugas);
  cat("agenda yang tidak ada dijawab 404", detailTidakAda.status === 404 && teks(detailTidakAda.json, "pesan").includes("tidak ditemukan"));

  // --- koreksi agenda sendiri ---
  const ubahTempat = await api("PATCH", `/api/agenda/${idSendiri}`, tokenPetugas, { tempat: "Ruang rapat uji ubah", catatan: null });
  const itemUbah = (ubahTempat.json?.agenda as Record<string, unknown> | undefined) ?? null;
  cat("tempat agenda sendiri bisa diubah", ubahTempat.status === 200 && teks(itemUbah, "tempat") === "Ruang rapat uji ubah");
  cat("catatan bisa dikosongkan dari Android", itemUbah?.catatan === null);
  cat("mengubah tempat tidak mengubah status agenda", teks(itemUbah, "status_rapat") === "terjadwal");

  const geser = await api("PATCH", `/api/agenda/${idSendiri}`, tokenPetugas, { tanggal_mulai: `${hariBesok}T15:00`, tanggal_selesai: null, alasan: "Undangan berubah dari Android uji" });
  const itemGeser = (geser.json?.agenda as Record<string, unknown> | undefined) ?? null;
  cat("waktu agenda sendiri bisa digeser", geser.status === 200 && teks(itemGeser, "mulai").includes(`${hariBesok}T15:00`) && teks(itemGeser, "mulai").endsWith("+07:00"), `${geser.status} / ${teks(itemGeser, "mulai")}`);
  cat("waktu selesai bisa dikosongkan lewat null", itemGeser?.selesai === null && itemGeser?.selesai_utc === null);

  // Riwayat diperiksa sekarang: menghapus agenda ikut menghapus riwayatnya.
  const prismaTengah = new PrismaClient();
  const riwayatGeser = await prismaTengah.riwayat_jadwal_rapat.findMany({ where: { rapat_id: idSendiri }, select: { alasan_perubahan: true } });
  cat("geser waktu dari Android tercatat pada riwayat jadwal", riwayatGeser.length === 1 && (riwayatGeser[0].alasan_perubahan ?? "").includes("Android"), `${riwayatGeser.length} riwayat`);
  await prismaTengah.$disconnect();
  cat("agenda yang digeser berubah status menjadi dijadwalkan ulang", teks(itemGeser, "status_rapat") === "dijadwalkan_ulang" && teks(itemGeser, "status_label") === "Dijadwalkan ulang");

  const ubahOtomatis = await api("PATCH", `/api/agenda/${idSendiri}`, tokenPetugas, { status_rapat: "berlangsung" });
  cat("status berlangsung ditolak dari Android karena berubah sendiri", ubahOtomatis.status === 400 && String(ubahOtomatis.json?.pesan ?? "").includes("berubah sendiri"), `${ubahOtomatis.status}`);

  const ubahSelesai = await api("PATCH", `/api/agenda/${idSendiri}`, tokenPetugas, { status_rapat: "selesai" });
  cat("status selesai bisa dipilih dari Android", ubahSelesai.status === 200 && teks((ubahSelesai.json?.agenda as Record<string, unknown>) ?? null, "status_rapat") === "selesai");

  const ubahStatus = await api("PATCH", `/api/agenda/${idSendiri}`, tokenPetugas, { status_rapat: "dibatalkan" });
  cat("status agenda sendiri bisa diubah", ubahStatus.status === 200 && teks((ubahStatus.json?.agenda as Record<string, unknown>) ?? null, "status_rapat") === "dibatalkan");

  const ubahStatusSalah = await api("PATCH", `/api/agenda/${idSendiri}`, tokenPetugas, { status_rapat: "ramai" });
  cat("status yang tidak dikenali ditolak 400", ubahStatusSalah.status === 400);

  const ubahWaktuSalah = await api("PATCH", `/api/agenda/${idSendiri}`, tokenPetugas, { tanggal_mulai: "besok pagi" });
  cat("waktu koreksi yang tidak dikenali ditolak 400", ubahWaktuSalah.status === 400 && teks(ubahWaktuSalah.json, "pesan").includes("Waktu mulai"));

  const ubahSelesaiMendahului = await api("PATCH", `/api/agenda/${idSendiri}`, tokenPetugas, { tanggal_mulai: `${hariBesok}T16:00`, tanggal_selesai: `${hariBesok}T15:00` });
  cat("koreksi dengan selesai mendahului mulai ditolak 400", ubahSelesaiMendahului.status === 400);

  const ubahKosong = await api("PATCH", `/api/agenda/${idSendiri}`, tokenPetugas, {});
  cat("koreksi tanpa bagian yang diisi ditolak 400", ubahKosong.status === 400 && teks(ubahKosong.json, "pesan").includes("Tidak ada yang diubah"));

  const ubahBukanMilik = await api("PATCH", `/api/agenda/${idPimpinan}`, tokenPetugas, { tempat: "Ruang orang lain" });
  cat("agenda milik orang lain tidak bisa diubah petugas (403)", ubahBukanMilik.status === 403 && teks(ubahBukanMilik.json, "pesan").includes("pembuat"));

  const ubahDariSurat = await api("PATCH", `/api/agenda/${rapatSurat.id}`, tokenPetugas, { tempat: "Ruang surat" });
  cat("agenda dari surat tidak bisa diubah dari Android (403)", ubahDariSurat.status === 403 && teks(ubahDariSurat.json, "pesan").includes("halaman suratnya"));

  const ubahTanpaToken = await api("PATCH", `/api/agenda/${idSendiri}`, undefined, { tempat: "Tanpa token" });
  cat("koreksi tanpa token ditolak 401", ubahTanpaToken.status === 401);

  // --- hapus agenda sendiri ---
  const hapusMilikLain = await api("DELETE", `/api/agenda/${idPimpinan}`, tokenPetugas);
  cat("agenda milik orang lain tidak bisa dihapus petugas (403)", hapusMilikLain.status === 403);
  const hapusDariSurat = await api("DELETE", `/api/agenda/${rapatSurat.id}`, tokenPetugas);
  cat("agenda dari surat tidak bisa dihapus dari Android (403)", hapusDariSurat.status === 403);

  const hapusSendiri = await api("DELETE", `/api/agenda/${idSendiri}`, tokenPetugas);
  cat("agenda sendiri bisa dihapus dari Android", hapusSendiri.status === 200 && teks(hapusSendiri.json, "pesan").includes("dihapus"));
  const setelahHapus = await api("GET", `/api/agenda/${idSendiri}`, tokenPetugas);
  cat("agenda yang dihapus tidak lagi terbaca", setelahHapus.status === 404);

  // --- token yang masih dipakai diperpanjang, diperiksa sebelum ada yang keluar ---
  const prismaToken = new PrismaClient();
  const idPimpinanUji = await prismaToken.users.findFirst({ where: { email: EMAIL_PIMPINAN }, select: { id: true } });
  const tokenDipakai = idPimpinanUji ? await prismaToken.api_token.findFirst({ where: { user_id: idPimpinanUji.id }, orderBy: { created_at: "desc" } }) : null;
  cat("token yang masih dipakai diperpanjang waktunya", !!tokenDipakai && tokenDipakai.expires_at.getTime() > mulaiUji.getTime() + 89 * 24 * 60 * 60 * 1000, tokenDipakai ? tokenDipakai.expires_at.toISOString() : "tidak ada token");
  await prismaToken.$disconnect();

  // --- ubah kata sandi dari Android ---
  const SANDI_BARU = "sandiBaruUjiAndroid";
  const sandiTanpaToken = await api("POST", "/api/sandi", undefined, { password_lama: PASSWORD_PIMPINAN, password_baru: SANDI_BARU, password_konfirmasi: SANDI_BARU });
  cat("ubah sandi tanpa token ditolak 401", sandiTanpaToken.status === 401);

  const sandiPendek = await api("POST", "/api/sandi", tokenPimpinan, { password_lama: PASSWORD_PIMPINAN, password_baru: "abc", password_konfirmasi: "abc" });
  cat("sandi baru di bawah 8 karakter ditolak 400", sandiPendek.status === 400 && teks(sandiPendek.json, "pesan").includes("minimal 8"));

  const sandiBedah = await api("POST", "/api/sandi", tokenPimpinan, { password_lama: PASSWORD_PIMPINAN, password_baru: SANDI_BARU, password_konfirmasi: "sandi lain" });
  cat("konfirmasi yang tidak sama ditolak 400", sandiBedah.status === 400 && teks(sandiBedah.json, "pesan").includes("tidak sama"));

  const sandiSama = await api("POST", "/api/sandi", tokenPimpinan, { password_lama: PASSWORD_PIMPINAN, password_baru: PASSWORD_PIMPINAN, password_konfirmasi: PASSWORD_PIMPINAN });
  cat("sandi baru yang sama dengan yang lama ditolak 400", sandiSama.status === 400 && teks(sandiSama.json, "pesan").includes("tidak boleh sama"));

  const sandiSalah = await api("POST", "/api/sandi", tokenPimpinan, { password_lama: "sandiLamaSalah123", password_baru: SANDI_BARU, password_konfirmasi: SANDI_BARU });
  cat("sandi lama yang salah ditolak 400", sandiSalah.status === 400 && teks(sandiSalah.json, "pesan").includes("sandi lama salah"));

  const sandiGanti = await api("POST", "/api/sandi", tokenPimpinan, { password_lama: PASSWORD_PIMPINAN, password_baru: SANDI_BARU, password_konfirmasi: SANDI_BARU });
  cat("sandi berhasil diganti dari Android", sandiGanti.status === 200 && teks(sandiGanti.json, "pesan").includes("berhasil"));

  const masukSandiBaru = await api("POST", "/api/masuk", undefined, { email: EMAIL_PIMPINAN, password: SANDI_BARU });
  cat("masuk lagi dengan sandi baru diterima", masukSandiBaru.status === 200 && teks(masukSandiBaru.json, "token").length > 20);

  const masukSandiLama = await api("POST", "/api/masuk", undefined, { email: EMAIL_PIMPINAN, password: PASSWORD_PIMPINAN });
  cat("masuk dengan sandi lama ditolak setelah diganti", masukSandiLama.status === 401);

  const sesiSetelahSandi = await api("GET", "/api/sesi", tokenPimpinan);
  cat("token perangkat tetap berlaku setelah sandi diganti", sesiSetelahSandi.status === 200);

  const sandiPulih = await api("POST", "/api/sandi", tokenPimpinan, { password_lama: SANDI_BARU, password_baru: PASSWORD_PIMPINAN, password_konfirmasi: PASSWORD_PIMPINAN });
  cat("sandi dipulihkan ke nilai semula", sandiPulih.status === 200);

  const keluarSandiBaru = await api("POST", "/api/keluar", teks(masukSandiBaru.json, "token"));
  cat("token dari masuk dengan sandi baru ikut dicabut", keluarSandiBaru.status === 200);

  // --- keluar ---
  const keluar = await api("POST", "/api/keluar", tokenPetugas);
  cat("keluar mencabut token perangkat", keluar.status === 200 && teks(keluar.json, "pesan").includes("tidak berlaku"));
  const sesiSetelahKeluar = await api("GET", "/api/sesi", tokenPetugas);
  cat("token yang dicabut tidak lagi dipakai (401)", sesiSetelahKeluar.status === 401);
  const kalenderSetelahKeluar = await api("GET", "/api/kalender", tokenPetugas);
  cat("kalender dengan token yang dicabut ditolak 401", kalenderSetelahKeluar.status === 401);
  const keluarPimpinan = await api("POST", "/api/keluar", tokenPimpinan);
  cat("keluar pimpinan mencabut token pimpinannya sendiri", keluarPimpinan.status === 200);

  // --- jejak dan perpanjangan token ---
  const prismaCek = new PrismaClient();
  const jejak = await prismaCek.audit_logs.findMany({
    where: { created_at: { gte: mulaiUji }, description: { contains: "aplikasi Android" } },
    select: { action: true, description: true },
  });
  cat("jejak mencatat masuk dari Android", jejak.some((j) => j.action === "login"));
  cat("jejak mencatat keluar dari Android", jejak.some((j) => j.action === "logout"));
  cat("jejak mencatat agenda yang dibuat dari Android", jejak.some((j) => j.action === "buat_agenda" && j.description?.includes("Uji API agenda mandiri petugas")));
  cat("jejak mencatat geser waktu dari Android", jejak.some((j) => j.action === "geser_rapat"));
  cat("jejak mencatat penghapusan agenda dari Android", jejak.some((j) => j.action === "hapus_agenda"));
  cat("jejak mencatat ubah sandi dari Android", jejak.some((j) => j.action === "update" && (j.description ?? "").includes("aplikasi Android")));

  const riwayatTersisa = await prismaCek.riwayat_jadwal_rapat.findMany({ where: { rapat_id: { in: baru } }, select: { id: true } });
  cat("agenda yang dihapus dari Android tidak meninggalkan riwayat", riwayatTersisa.length === 0, `${riwayatTersisa.length} riwayat tersisa`);

  const sisaToken = await prismaCek.api_token.findMany({ where: { created_at: { gte: mulaiUji } }, select: { id: true } });
  cat("token yang dicabut tidak tertinggal di data yang tersimpan", sisaToken.length === 0, `${sisaToken.length} token tersisa`);

  await prismaCek.$disconnect();
} catch (e) {
  cat("pemeriksaan selesai tanpa kesalahan", false, e instanceof Error ? e.message : String(e));
}

// Bersihkan data uji: agenda, surat, akun sementara, dan token yang dibuat pemeriksa ini.
const prismaBersihkan = new PrismaClient();
const idUji = baru.filter((id) => id && id.length > 0);
if (idUji.length > 0) {
  await prismaBersihkan.peserta_rapat.deleteMany({ where: { rapat_id: { in: idUji } } });
  await prismaBersihkan.riwayat_jadwal_rapat.deleteMany({ where: { rapat_id: { in: idUji } } });
  await prismaBersihkan.jadwal_rapat.deleteMany({ where: { id: { in: idUji } } });
}
await prismaBersihkan.audit_logs.deleteMany({ where: { created_at: { gte: mulaiUji }, description: { contains: "aplikasi Android" } } });
await prismaBersihkan.jadwal_rapat.deleteMany({ where: { surat_id: surat.id } });
await prismaBersihkan.surat_masuk.delete({ where: { id: surat.id } });
await prismaBersihkan.users.delete({ where: { id: akunNonaktif.id } });
const emailUji = [EMAIL_PETUGAS, EMAIL_PIMPINAN];
const idAkunUji2 = await prismaBersihkan.users.findMany({ where: { email: { in: emailUji } }, select: { id: true } });
await prismaBersihkan.api_token.deleteMany({ where: { user_id: { in: idAkunUji2.map((u) => u.id) }, created_at: { gte: mulaiUji } } });
await prismaBersihkan.$disconnect();

const lulus = hasil.filter((h) => h.startsWith("PASS")).length;
const gagal = hasil.filter((h) => h.startsWith("FAIL")).length;
console.log(hasil.filter((h) => h.startsWith("FAIL")).join("\n"));
console.log(`\nAPI Android: ${lulus} PASS, ${gagal} FAIL dari ${hasil.length} pemeriksaan${idAkunUji.length ? ` (data uji: surat ${surat.nomor_agenda})` : ""}`);
process.exit(gagal > 0 ? 1 : 0);
