import type { Page } from "playwright";

/** Coba selesaikan challenge Turnstile di browser nyata (chrome headful): klik checkbox lewat
   daftar frame lalu tunggu token. Bila widget tidak menghasilkan token (browser headless),
   lanjut saja — uji otomatis jalan dengan TURNSTILE_SKIP=1 di dev server. */
export async function selesaikanTurnstile(page: Page): Promise<void> {
  const adaToken = () => {
    const el = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement | null;
    return el && el.value.length > 0;
  };
  try {
    await page.waitForFunction(adaToken, { timeout: 8_000, polling: 250 });
    return;
  } catch {
    /* token belum ada — coba klik checkbox challenge */
  }
  const batas = Date.now() + 12_000;
  while (Date.now() < batas) {
    if (await page.evaluate(adaToken)) return;
    for (const f of page.frames()) {
      if (!f.url().includes("challenges.cloudflare.com")) continue;
      try {
        await f.locator('input[type="checkbox"]').click({ timeout: 2000 });
        await page.waitForFunction(adaToken, { timeout: 8_000 });
        return;
      } catch {
        /* frame belum berisi checkbox */
      }
    }
    await page.waitForTimeout(1500);
  }
  // Widget tidak menghasilkan token (kemungkinan browser tanpa challenge) — lanjut.
}
