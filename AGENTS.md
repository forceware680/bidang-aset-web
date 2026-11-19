<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Aturan uji — jangan berlebihan

- **Perubahan kecil yang tidak menyentuh data/API/logika** (CSS, kelas Tailwind, teks UI, tata letak): cukup `npx tsc --noEmit`. **Jangan** jalankan skrip `test:*` — itu integration Playwright yang makan waktu menit sampai puluhan menit.
- **Perubahan yang menyentuh server action, SQL, API, status agenda, SSE, ekspor Excel**: jalankan hanya skrip yang terkait (mis. `test:rapat`, `test:api`, `test:keluar`, `test:sse`, `test:rapat-waktu`), bukan seluruh suite.
- **Cek visual**: screenshot Playwright kecil untuk halaman yang berubah saja (mode terang dan gelap, 1280px dan 375px). Simpan di `tmp/` (gitignored), jangan jadi tes.
- Repo ini **tidak punya unit runner** — vitest/jest belum dipasang. Semua `test:*` di `package.json` adalah integration browser.
- `npm run lint` **tidak jalan**: `next lint` sudah dihapus di Next 16 (error `Invalid project directory ... lint`). Cek statis yang benar cuma `npx tsc --noEmit`.
- **Testing tidak boleh menghapus data hasil impor Excel**: 1606 surat + 5108 disposisi dari agenda surat masuk adalah **starter yang harus selalu ada** di database (impor ulang 2026-11-15: blok disposisi diperbaiki mulai dari baris surat sendiri, semua disposisi default `selesai`, kategori masuk 10 compact) — jangan pernah dihapus, di-wipe, atau di-reset. Yang boleh dihapus hanya data buatan skrip uji itu sendiri: skrip uji harus menandai record buatannya (mis. nomor agenda khas test atau id yang disimpan saat insert) dan hanya membersihkan record itu setelah selesai — bukan seluruh tabel. Kalau sebuah tes butuh tabel kosong, pakai database terpisah, bukan DB ini.
- **Tiga skrip menyapu tabel di awal**: `scripts/click-through.mts` (`test:klik`), `scripts/contrast.mjs` (`test:kontras`), dan `scripts/layout-check.mjs` (`test:layout`) melakukan `deleteMany({})` pada surat masuk, disposisi, rapat, lampiran, surat keluar, counter, dan jejak perubahan. Mereka sekarang dipagar `scripts/pagar-uji.mjs`: di database berisi data nyata skrip berhenti dengan pesan jelas. Untuk jalan, pakai database uji dan set `UJI_DB=1` (atau `DATABASE_URL` ke database kosong).
- **Jangan jalankan `npm run db:apply` di database berisi data**: `psql -d agenda_aset -f db/schema.sql` membuat ulang skema dan mengosongkan tabel.

## Dev kalau Turbopack crash

Di PC ini Turbopack bisa panic: child process PostCSS gagal inisialisasi DLL (`node process exited ... exit code: 0xc0000142`), semua rute balas 500 dengan "An unexpected Turbopack error occurred".

- Jalanin dengan webpack: `npm run dev:webpack` (`next dev --webpack`). Build rilis tetap `npm run build` (Turbopack).
- Kalau port 3000 masih dipegang proses mati: `powershell -NoProfile -Command "Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force"` lalu start lagi.
