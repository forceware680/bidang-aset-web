import { PESAAN_TOKEN, jawab, tolak } from "@/lib/api";
import { sesiApi } from "@/lib/api-auth";

/**
 * Pemeriksaan token yang tersimpan di perangkat. Aplikasi Android memanggil ini saat dibuka; bila jawabannya
 * 401, perangkat harus minta masuk lagi. Hanya identitas akun yang dikembalikan — tidak ada data surat.
 */
export async function GET(req: Request) {
  const sesi = await sesiApi(req);
  if (!sesi) return tolak(401, PESAAN_TOKEN);
  return jawab(200, {
    nama: sesi.user.name,
    email: sesi.user.email,
    peran: sesi.user.role,
    perangkat: sesi.perangkat,
    kedaluwarsa: sesi.kedaluwarsa.toISOString(),
  });
}
