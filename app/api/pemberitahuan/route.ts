import { isoJakarta } from "@/lib/format";
import { prisma } from "@/lib/db";
import { PESAAN_TOKEN, ikutSebagaiPeserta, jawab, tolak } from "@/lib/api";
import { sesiApi } from "@/lib/api-auth";
import { waktuJakarta } from "@/lib/waktu";

/** Batas pemberitahuan per penyarian; yang lebih banyak diambil pada penyarian berikutnya (kursor `sejak` maju). */
const BATAS = 50;

/**
 * Pemberitahuan peserta untuk aplikasi Android: baris yang dicatat saat seseorang menambahkan peserta ke
 * sebuah agenda dari web. Hanya pemberitahuan yang namanya cocok longgar dengan nama akun yang masuk yang
 * dijawab (pencocokan sama dengan aturan `ikut` di kalender). Param `sejak` (waktu ISO) membatasi ke
 * peristiwa setelah waktu penyarian terakhir yang diingat perangkat.
 */
export async function GET(req: Request) {
  const sesi = await sesiApi(req);
  if (!sesi) return tolak(401, PESAAN_TOKEN);

  const sejakRaw = new URL(req.url).searchParams.get("sejak");
  const sejak = sejakRaw ? waktuJakarta(sejakRaw) : null;
  if (sejakRaw && !sejak) {
    return tolak(400, "Waktu `sejak` tidak dikenali. Gunakan tanggal dan jam, misalnya 2026-11-14T08:00:00+07:00.");
  }

  const baris = await prisma.pemberitahuan_peserta.findMany({
    where: sejak ? { created_at: { gt: sejak } } : {},
    include: { jadwal_rapat: { select: { agenda_rapat: true, tanggal_mulai: true } } },
    orderBy: { created_at: "asc" },
    take: BATAS,
  });
  const milik = baris.filter((b) => ikutSebagaiPeserta([b.nama_peserta], sesi.user.name));
  return jawab(200, {
    pemberitahuan: milik.map((b) => ({
      id: b.id,
      rapat_id: b.rapat_id,
      oleh: b.oleh,
      agenda_rapat: b.jadwal_rapat.agenda_rapat,
      mulai: isoJakarta(b.jadwal_rapat.tanggal_mulai),
      pada_utc: b.created_at.toISOString(),
    })),
    batas: BATAS,
  });
}
