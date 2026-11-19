"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList, useComboboxAnchor } from "@/components/ui/combobox";

/**
 * Pilihan peserta dari pejabat/pegawai yang punya akun aplikasi, dipakai di formulir agenda. Nama
 * yang terpilih dikirim sebagai isian tersembunyi `nama_peserta`; server menolak nama tanpa akun,
 * karena agenda hanya bisa muncul di HP orang yang bisa masuk aplikasi Android.
 *
 * `namaSendiri` hanya ditampilkan sebagai catatan — pembuat agenda otomatis tercatat sebagai peserta
 * oleh server action, jadi tidak perlu dikirim dari formulir.
 */
export function PesertaPilih({
  daftarPegawai,
  idIsian,
  deskripsi,
  namaSendiri,
}: {
  daftarPegawai: string[];
  idIsian: string;
  deskripsi: string;
  namaSendiri?: string;
}) {
  const [terpilih, setTerpilih] = useState<string[]>([]);
  const [ketik, setKetik] = useState("");
  const [sorot, setSorot] = useState<string | null>(null);
  // Nama terakhir yang diketik disimpan sendiri: dropdown mengosongkan isian saat fokus lepas, tanpa itu
  // nama yang diketik tapi tidak dipilih hilang sebelum formulir dikirim.
  const [siap, setSiap] = useState("");
  const tombolTerakhir = useRef("");
  // Dropdown dipatok ke wadah pil, bukan ke elemen terakhir: tanpa patokan daftar bisa muncul di bawah
  // isian dan menimpa keterangan di bawahnya.
  const patok = useComboboxAnchor();

  function tulisSiap(nilai: string) {
    if (nilai.trim()) setSiap(nilai.trim());
    else if (tombolTerakhir.current === "Backspace" || tombolTerakhir.current === "Delete") setSiap("");
  }

  const cocok = daftarPegawai.filter((nama) => !terpilih.includes(nama));
  const diDaftar = new Set(daftarPegawai.map((nama) => nama.toLowerCase()));
  function adaDiDaftar(nama: string) {
    return diDaftar.has(nama.toLowerCase());
  }
  const namaBaru = (siap || ketik).trim();
  const belumAda = namaBaru !== "" && !adaDiDaftar(namaBaru);
  const alamatAkun = "/pengaturan/pengguna";

  // Tab menutup nama yang sedang diketik dan langsung siap untuk nama berikutnya; Enter ikut menambah.
  function tambahNama(event: React.KeyboardEvent<HTMLInputElement>) {
    tombolTerakhir.current = event.key;
    if (event.key !== "Tab" && event.key !== "Enter") return;
    event.preventDefault();
    const nama = sorot ?? event.currentTarget.value.trim();
    if (!nama) {
      setKetik("");
      setSorot(null);
      setSiap("");
      return;
    }
    if (!adaDiDaftar(nama)) return;
    setTerpilih((sebelum) => (sebelum.includes(nama) ? sebelum : [...sebelum, nama]));
    setKetik("");
    setSorot(null);
    setSiap("");
  }

  function lepasFokus() {
    if (siap && adaDiDaftar(siap)) {
      setTerpilih((sebelum) => (sebelum.includes(siap) ? sebelum : [...sebelum, siap]));
      setSiap("");
    }
    setKetik("");
  }

  return (
    <>
      {terpilih.map((nama) => (
        <input key={nama} type="hidden" name="nama_peserta" value={nama} />
      ))}
      {/* Nama yang masih diketik ikut terkirim hanya kalau ada di daftar pegawai. */}
      <input type="hidden" name="nama_peserta" value={siap && adaDiDaftar(siap) ? siap : ""} />
      <Combobox
        multiple
        items={cocok}
        value={terpilih}
        onValueChange={(nilai) => setTerpilih(Array.isArray(nilai) ? nilai : [])}
        inputValue={ketik}
        onInputValueChange={(nilai) => {
          setKetik(nilai);
          tulisSiap(nilai);
        }}
        onItemHighlighted={(nilai) => setSorot(nilai ?? null)}
        autoHighlight
      >
        <ComboboxChips ref={patok}>
          {terpilih.map((nama) => (
            <ComboboxChip key={nama}>{nama}</ComboboxChip>
          ))}
          <ComboboxChipsInput id={idIsian} placeholder="Ketik nama pegawai" value={ketik} onKeyDown={tambahNama} onBlur={lepasFokus} />
        </ComboboxChips>
        <ComboboxContent anchor={patok}>
          <ComboboxList>
            {(nama: string) => (
              <ComboboxItem key={nama} value={nama}>
                {nama}
              </ComboboxItem>
            )}
          </ComboboxList>
          <ComboboxEmpty>
            {belumAda
              ? `Tidak ada nama yang cocok dengan "${namaBaru}" di daftar akun aplikasi.`
              : "Tidak ada nama yang cocok di daftar akun aplikasi."}
          </ComboboxEmpty>
        </ComboboxContent>
      </Combobox>
      <p className="text-sm text-muted-foreground">{deskripsi}</p>
      {namaSendiri ? (
        <p className="text-sm text-muted-foreground">
          Kamu ({namaSendiri}) otomatis tercatat sebagai peserta. {terpilih.length > 0 ? `${terpilih.length} nama dipilih.` : ""}
        </p>
      ) : null}
      {/* Catatan nama baru di luar daftar: isian combobox aria-hidden, jadi tautan tidak boleh di dalamnya. */}
      {belumAda ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Nama "{namaBaru}" belum punya akun aplikasi, jadi belum bisa dijadikan peserta.</span>
          <Link href={alamatAkun} className="text-primary underline underline-offset-4">
            Buat akun di Pengaturan › Pengguna
          </Link>
        </p>
      ) : null}
    </>
  );
}
