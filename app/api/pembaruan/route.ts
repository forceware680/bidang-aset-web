import { currentUser } from "@/lib/auth";
import { tambahLangganan } from "@/lib/pemberitahuan";
import { kunciMonitorCocok } from "@/lib/monitor";

export const dynamic = "force-dynamic";

/** Jeda pengirim: komentar kosong supaya jalur tidak ditutup proxy/peramban yang menganggapnya diam. */
const DETAK_MS = 20_000;
/** Pemeriksaan tertutup: peramban yang menutup jalurnya tidak selalu memberi tahu server, jadi diperiksa berkala. */
const CEK_TUTUP_MS = 2_000;

/**
 * Jalur pembaruan realtime (aliran peristiwa server). Halaman berlangganan lewat `EventSource` di
 * `components/pemberitahuan.tsx`; setiap perubahan data di database (pemicu `trg_memberi_*`) dikirim ke
 * peramban sehingga daftar, kalender, dan layar monitor ikut diperbarui di tempatnya tanpa penyegar berkala.
 *
 * Yang boleh berlangganan: sesi aplikasi (cookie) atau layar monitor dengan kunci monitor. Yang dikirim
 * hanyalah tabel/aksi/id — tidak ada isi surat.
 *
 * Langganan dilepas saat peramban menutup jalurnya: `cancel()` dipanggil ketika tubuh respons dihentikan,
 * dan `request.signal` jadi cadangan. Kalau tidak dilepas, koneksi LISTEN di database tertinggal.
 */
export async function GET(req: Request) {
  const kunci = new URL(req.url).searchParams.get("t") ?? "";
  const sesi = await currentUser();
  if (!sesi && !(await kunciMonitorCocok(kunci))) {
    return Response.json(
      {
        ok: false,
        pesan: "Belum masuk. Untuk layar yang tidak masuk, alamat ditulis dengan bentuk /api/pembaruan?t=kunci-monitor.",
      },
      { status: 401 }
    );
  }

  const kod = new TextEncoder();
  let cabutLangganan: (() => Promise<void>) | null = null;
  let detak: ReturnType<typeof setInterval> | undefined;
  let cekTutup: ReturnType<typeof setInterval> | undefined;
  let bersihJalan = false;

  async function bersih(kirim?: ReadableStreamController<Uint8Array>) {
    if (bersihJalan) return;
    bersihJalan = true;
    if (detak) clearInterval(detak);
    if (cekTutup) clearInterval(cekTutup);
    if (cabutLangganan) await cabutLangganan();
    if (kirim) {
      try {
        kirim.close();
      } catch {
        // tubuh aliran sudah tertutup
      }
    }
  }

  const aliran = new ReadableStream<Uint8Array>({
    async start(kirim) {
      const tulis = (teks: string) => {
        try {
          kirim.enqueue(kod.encode(teks));
        } catch {
          // peramban sudah menutup jalurnya
          void bersih();
        }
      };
      detak = setInterval(() => tulis(": detak\n\n"), DETAK_MS);
      cekTutup = setInterval(() => {
        if (req.signal.aborted) void bersih();
      }, CEK_TUTUP_MS);
      cabutLangganan = await tambahLangganan((p) => tulis(`event: perubahan\ndata: ${JSON.stringify(p)}\n\n`));
      if (bersihJalan || req.signal.aborted) {
        await bersih();
        return;
      }
      tulis(`event: siap\ndata: {"tabel":"siap"}\n\n`);
      req.signal.addEventListener("abort", () => void bersih());
    },
    async cancel() {
      await bersih();
    },
  });

  return new Response(aliran, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
