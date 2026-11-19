import { isoHari } from "./format";

/**
 * Waktu yang dikirim UI (`datetime-local`) maupun aplikasi Android dibaca sebagai jam Asia/Jakarta.
 * Nilai tanpa offset ("2026-11-16T09:00") dianggap jam Asia/Jakarta; nilai yang membawa offset atau Z
 * (yang biasa dikirim aplikasi Android) dipakai apa adanya.
 */
export function waktuJakarta(nilai: string): Date | null {
  const teks = nilai.trim();
  // Nilai yang datang dari query string sering membawa "+07:00" yang berubah jadi spasi; spasi dianggap offset lagi.
  const pulihOffset = teks.replace(/^(\d{4}-\d{2}-\d{2}T[\d:]+)\s([+-]\d{2}:\d{2})$/, "$1$2");
  const lokal = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(pulihOffset);
  if (lokal) {
    const [, tanggal, jam, detik] = lokal;
    const d = new Date(`${tanggal}T${jam}:${detik ?? "00"}+07:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const beroffset = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(pulihOffset);
  if (beroffset) {
    const d = new Date(teks);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Batas hari Asia/Jakarta untuk rentang kalender: `akhir=false` → 00:00 hari itu, `akhir=true` → 00:00 hari berikutnya. */
export function batasHari(hari: string, akhir: boolean): Date | null {
  const cocok = /^(\d{4}-\d{2}-\d{2})$/.exec(hari.trim());
  if (!cocok) return null;
  const awal = new Date(`${cocok[1]}T00:00:00+07:00`);
  if (Number.isNaN(awal.getTime())) return null;
  return akhir ? new Date(awal.getTime() + 24 * 60 * 60 * 1000) : awal;
}

/** Awal hari ini di Asia/Jakarta, dipakai sebagai batas bawah kalender bila pemanggil tidak menyebutkan tanggal. */
export function awalHariIni(): Date {
  return batasHari(isoHari(new Date()), false) ?? new Date();
}
