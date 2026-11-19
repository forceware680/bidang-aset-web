/** Login sekali, simpan sesi 'petugas' untuk test lain. */
import { test } from '@e2e-dev/web';
import { expect, credentials } from 'e2e';

test.setup('login sebagai petugas', { sessions: ['petugas'] }, async ({ app, screen, session, browser }) => {
  const u = credentials.user('petugas');

  await app.open('/login');
  await screen.getByLabel('Email').fill(u.username);
  await screen.getByLabel('Kata sandi').fill(u.password);
  await screen.getByRole('button', 'Masuk').tap();

  await expect(browser).toHaveURL('/dashboard');
  await session.save('petugas');
});
