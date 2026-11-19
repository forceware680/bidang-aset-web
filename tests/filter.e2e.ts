/** Filter daftar: penolakan rentang mustahil, tombol X pengosong isian. */
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('rentang sampai < dari ditolak terang di /surat', { session: 'petugas' }, async ({ app, screen }) => {
  await app.open('/surat?dari=2026-12-31&sampai=2026-01-01');
  await expect(screen.getByText(/Filter tidak cocok/)).toBeVisible();
});

test('rentang tahun di luar rentang ditolak terang di /surat', { session: 'petugas' }, async ({ app, screen }) => {
  await app.open('/surat?tahun=2025&dari=2026-01-01');
  await expect(screen.getByText(/Filter tidak cocok/)).toBeVisible();
});

test('X mengosongkan isian tahun terima', { session: 'petugas' }, async ({ app, screen, browser }) => {
  await app.open('/surat');
  const sebelum = await browser.locator('text=/\\d+ surat ditemukan/').first().textContent();

  await screen.getByLabel('Tahun terima').fill('2025');
  await expect(screen.getByText('3 surat ditemukan')).toBeVisible();

  await screen.getByRole('button', 'Kosongkan Tahun terima').tap();
  await expect(browser.locator(`text=${sebelum}`).first()).toBeVisible();
  await expect(screen.getByRole('button', 'Kosongkan Tahun terima')).toHaveCount(0);
});
