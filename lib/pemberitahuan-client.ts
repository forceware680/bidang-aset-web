import { useCallback, startTransition, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

let tersambung = false;
const pendengar = new Set<() => void>();

export function beriTersambung(nilai: boolean) {
  if (tersambung === nilai) return;
  tersambung = nilai;
  for (const p of pendengar) p();
}

/**
 * Apakah jalur pembaruan sedang aktif. Aksi perubahan memakai ini sebagai penentu: kalau jalur
 * tertutup, halaman menyegar sendiri; kalau terbuka, pemberitahuan dari database yang membawanya.
 */
export function gunakanTersambung(): boolean {
  return useSyncExternalStore(
    (ulang) => {
      pendengar.add(ulang);
      return () => pendengar.delete(ulang);
    },
    () => tersambung,
    () => false
  );
}

/**
 * Penyegar diurutkan di satu tempat: redirect server action dan penyegar dari pemberitahuan tidak boleh
 * render() bersamaan — dua renderan yang saling menyusul membuat React kehilangan simpul di DOM
 * ("Cannot read properties of null (reading 'parentNode')"). Satu penyegar jalan sekarang, sisanya antre
 * dan dijalankan setelah renderan terakhir selesai (dan setelah aksi selesai).
 */
let aksiSedang = false;
let muatSedang = false;
let jobAntre: (() => void) | null = null;
let jamSetel: number | undefined;
let jamAntre: number | undefined;

const JEDA_SETEL_MS = 600;
const JEDA_ANTRE_MS = 250;

function jalanAntre() {
  clearTimeout(jamAntre);
  if (!jobAntre) return;
  if (aksiSedang || muatSedang) {
    jamAntre = window.setTimeout(jalanAntre, JEDA_ANTRE_MS);
    return;
  }
  const jalan = jobAntre;
  jobAntre = null;
  muatSedang = true;
  startTransition(jalan);
  clearTimeout(jamSetel);
  jamSetel = window.setTimeout(() => {
    muatSedang = false;
    jalanAntre();
  }, JEDA_SETEL_MS);
}

/** Jalankan penyegar; kalau sedang ada aksi atau penyegar lain berjalan, masuk antrean. */
export function mintaPenyegar(jalan: () => void): void {
  if (aksiSedang || muatSedang) {
    jobAntre = jalan;
    clearTimeout(jamAntre);
    jamAntre = window.setTimeout(jalanAntre, JEDA_ANTRE_MS);
    return;
  }
  muatSedang = true;
  startTransition(jalan);
  clearTimeout(jamSetel);
  jamSetel = window.setTimeout(() => {
    muatSedang = false;
    jalanAntre();
  }, JEDA_SETEL_MS);
}

/** Tandai bahwa sebuah aksi perubahan sedang berjalan supaya penyegar menunggu aksi selesai. */
export function mulaiAksi(): void {
  aksiSedang = true;
}

export function selesaiAksi(): void {
  aksiSedang = false;
  jalanAntre();
}

/**
 * Penyegar halaman setelah sebuah aksi tersimpan. Selama jalur pembaruan aktif, aksi itu sendiri sudah
 * memicu pemberitahuan dari database, jadi tidak perlu menyegar manual; kalau jalur tertutup (jaringan
 * putus, peramban menutup aliran), halaman menyegar dirinya sendiri supaya perubahan tetap terlihat.
 */
export function gunakanPenyegar(): () => void {
  const router = useRouter();
  const terhubung = gunakanTersambung();
  return useCallback(() => {
    if (terhubung) return;
    mintaPenyegar(() => router.refresh());
  }, [router, terhubung]);
}

/**
 * Bungkus aksi server (untuk useActionState) supaya penyegar dari pemberitahuan menunggu aksi selesai:
 * redirect aksi dan penyegar tidak boleh render bersamaan.
 */
export function aksiTundaPemberitahuan<State, Payload>(
  aksi: (state: State, payload: Payload) => Promise<State>
): (state: State, payload: Payload) => Promise<State> {
  return async (state, payload) => {
    mulaiAksi();
    try {
      return await aksi(state, payload);
    } finally {
      selesaiAksi();
    }
  };
}
