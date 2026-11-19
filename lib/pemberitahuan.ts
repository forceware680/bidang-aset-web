import { Pool } from "pg";

/** Kanal pg_notify yang diisi pemicu database (`beri_tahu_perubahan()` di db/schema.sql). */
export const KANAL = "aset_perubahan";

/** Isi pesan dari pemicu: tabel yang berubah, aksinya, dan id barisnya. */
export type Pemberitahuan = { tabel: string; aksi: string; id: string };

type Langganan = (p: Pemberitahuan) => void;

type Pagar = {
  pool: Pool;
  pendengar: import("pg").PoolClient | null;
  langganan: Set<Langganan>;
  /** Penyampaian ke semua langganan; disimpan di pagar agar jalur dari kompilasi lain tetap ikut menyampaikannya. */
  kirim: (isi: Pemberitahuan) => void;
  /** Pendengar yang dipasang di klien saat ini, supaya bisa dilepas lagi. */
  dengarPemberitahuan: ((n: import("pg").Notification) => void) | null;
  dengarGalat: (() => void) | null;
};

/**
 * Satu koneksi khusus untuk LISTEN, disimpan di `globalThis` supaya hot reload di `next dev`
 * tidak menumpuk koneksi yang masing-masing masih mendengar kanal. Koneksi hanya dipinjam selama
 * ada halaman yang masih membuka jalur pembaruan; kalau tidak ada lagi, koneksi dilepas.
 */
const ruang = globalThis as { asetPemberitahuan?: Pagar };

function ambilPagar(): Pagar {
  ruang.asetPemberitahuan ??= {
    pool: new Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 10_000 }),
    pendengar: null,
    langganan: new Set<Langganan>(),
    kirim: () => {},
    dengarPemberitahuan: null,
    dengarGalat: null,
  };
  const pagar = ruang.asetPemberitahuan;
  pagar.kirim = (isi) => {
    for (const langganan of [...pagar.langganan]) langganan(isi);
  };
  return pagar;
}

/**
 * Klien khusus yang mendengarkan kanal. Klien lama bisa sudah dilepas ke pool atau sudah tidak punya
 * pendengar lagi (jalur dari kompilasi sebelumnya ditutup tanpa bersih); kalau begitu diganti dengan
 * klien baru. LISTEN selalu dikirim ulang supaya database pasti tahu kita masih mendengarkan.
 */
async function dengar(pagar: Pagar) {
  let client = pagar.pendengar;
  if (!client || (client as { released?: boolean }).released || client.listenerCount("notification") === 0) {
    // Klien lama dilepas ke pool tanpa UNLISTEN masih terdaftar di database, jadi nomornya ikut
    // dihitung sebagai langganan. Di-bersih dulu sebelum dilepas.
    if (client) {
      try {
        await client.query(`UNLISTEN ${KANAL}`);
      } catch {
        // koneksi sudah mati; lepas saja
      }
      // Pendengar dilepas sebelum klien kembali ke pool. Tanpa ini, klien yang sama dipinjam lagi
      // oleh pool dan tiap hot reload menambah pendengar "error" lagi sampai MaxListenersExceeded.
      client.removeListener("notification", pagar.dengarPemberitahuan ?? (() => {}));
      client.removeListener("error", pagar.dengarGalat ?? (() => {}));
      pagar.dengarPemberitahuan = null;
      pagar.dengarGalat = null;
      client.release();
    }
    client = await pagar.pool.connect();
    const mendengar = (n: import("pg").Notification) => {
      if (!n.payload) return;
      let isi: Pemberitahuan;
      try {
        isi = JSON.parse(n.payload) as Pemberitahuan;
      } catch {
        return;
      }
      if (isi.tabel) pagar.kirim(isi);
    };
    client.on("notification", mendengar);
    pagar.dengarPemberitahuan = mendengar;
    // Koneksi putus (restart database, jaringan): langganan berikutnya membuka klien baru.
    const dengarGalat = () => void lepas(pagar);
    client.on("error", dengarGalat);
    pagar.dengarGalat = dengarGalat;
    pagar.pendengar = client;
  }
  await client.query(`LISTEN ${KANAL}`);
}

async function lepas(pagar: Pagar) {
  const client = pagar.pendengar;
  pagar.pendengar = null;
  if (!client) return;
  try {
    await client.query(`UNLISTEN ${KANAL}`);
  } catch {
    // koneksi sudah mati; lepas saja
  }
  client.removeListener("notification", pagar.dengarPemberitahuan ?? (() => {}));
  client.removeListener("error", pagar.dengarGalat ?? (() => {}));
  pagar.dengarPemberitahuan = null;
  pagar.dengarGalat = null;
  client.release();
}

/**
 * Daftar sebagai penerima pemberitahuan. Pengembalianannya berhenti mendengar; kalau tidak ada
 * langganan lagi, koneksi LISTEN dilepas supaya tidak menahan koneksi database.
 */
export async function tambahLangganan(langganan: Langganan): Promise<() => Promise<void>> {
  const pagar = ambilPagar();
  await dengar(pagar);
  pagar.langganan.add(langganan);
  let selesai = false;
  return async () => {
    if (selesai) return;
    selesai = true;
    pagar.langganan.delete(langganan);
    if (pagar.langganan.size === 0) await lepas(pagar);
  };
}
