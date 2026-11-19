import { logAudit } from "@/lib/auth";
import { PESAAN_TOKEN, jawab, tolak } from "@/lib/api";
import { cabutApi, sesiApi } from "@/lib/api-auth";

/**
 * Keluar dari aplikasi Android: token perangkat dicabut, jadi token yang tersimpan di perangkat tidak bisa
 * dipakai lagi. Kata sandi tidak berubah dan akun di aplikasi web tetap masuk.
 */
export async function POST(req: Request) {
  const sesi = await sesiApi(req);
  if (!sesi) return tolak(401, PESAAN_TOKEN);

  await cabutApi(sesi.tokenId);
  await logAudit(sesi.user, "logout", "users", sesi.user.id, `${sesi.user.name} keluar dari aplikasi Android`);
  return jawab(200, { pesan: "Token perangkat ini sudah tidak berlaku." });
}
