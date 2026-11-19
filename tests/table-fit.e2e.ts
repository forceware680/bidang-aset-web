/** Daftar surat muat tanpa gulir mendatar di layar desktop; kolom rapat bernama 'Agenda'. */
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

async function gulirMendatar(browser: any): Promise<number[]> {
  return browser.evaluate(() =>
    Array.from(document.querySelectorAll('[data-slot=table-container]')).map(
      (e) => (e as HTMLElement).scrollWidth - (e as HTMLElement).clientWidth,
    ),
  );
}

test('daftar surat masuk muat tanpa gulir mendatar', { session: 'petugas' }, async ({ app, browser, screen }) => {
  await app.open('/surat');
  expect((await gulirMendatar(browser)).every((g) => g <= 1)).toBe(true);
  await expect(screen.getByRole('columnheader', 'Agenda')).toBeVisible();
  await expect(screen.getByRole('columnheader', 'Rapat')).toHaveCount(0);
});

test('daftar surat keluar muat tanpa gulir mendatar', { session: 'petugas' }, async ({ app, browser }) => {
  await app.open('/keluar');
  expect((await gulirMendatar(browser)).every((g) => g <= 1)).toBe(true);
});

test('tabel dashboard muat tanpa gulir mendatar', { session: 'petugas' }, async ({ app, browser }) => {
  await app.open('/dashboard');
  expect((await gulirMendatar(browser)).every((g) => g <= 1)).toBe(true);
});
