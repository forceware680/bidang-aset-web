import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';

export default {
  targets: [
    {
      engine: web({ viewport: { width: 1280, height: 900 } }),
      app: {
        url: process.env.APP_URL ?? 'http://localhost:3000',
        // Dev server sudah jalan di repo ini; biarkan tanpa command agar tidak menyalakan server duplikat.
      },
    },
  ],
  credentials: {
    petugas: {
      username: process.env.UJI_EMAIL ?? 'petugas.aset@magelang.go.id',
      password: process.env.UJI_PASSWORD ?? 'BCed08Gkc34dF1RM',
    },
  },
} satisfies E2EConfig;
