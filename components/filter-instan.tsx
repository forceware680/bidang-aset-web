"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDaysIcon, ChevronDownIcon, FilterIcon, RotateCcwIcon, SearchIcon, XIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputIkon } from "@/components/input-ikon";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { id } from "react-day-picker/locale";

type Kolom = {
  nama: string;
  label: string;
  /// teks diketik langsung ( dicari dengan jeda ), pilihan langsung berlaku saat dipilih, tanggal lewat pemilih tanggal native,
  /// rentang = satu tombol yang membuka kalender: klik tanggal mulai lalu tanggal akhir (query dari/sampai).
  tipe: "teks" | "teks-ikon" | "pilihan" | "tanggal" | "rentang";
  placeholder?: string;
  inputMode?: "numeric" | "text" | "search";
  kelas: string;
  /// Lebar minimum supaya opsi panjang tidak terpotong; bisa px atau fungsi ukuran seperti min(14ch, 100%).
  minWidth?: string | number;
  opsi?: { value: string; label: string }[];
};

/**
 * Filter daftar surat yang berlaku sendiri: tiap perubahan (ketikan dengan jeda 350ms, pilihan langsung)
 * mengirim query ke halaman, tanpa tombol "Terapkan filter". Halaman hasil kembali ke 1 setiap filter
 * berubah. Tombol Reset mengosongkan semua filter dan kembali ke daftar tanpa filter.
 */
export function FilterInstan({
  rute,
  nilai,
  kolom,
}: {
  rute: string;
  nilai: Record<string, string>;
  kolom: Kolom[];
}) {
  const router = useRouter();
  // Kolom rentang dibangun dari nilai dari/sampai yang sudah ada di URL, jadi filter lama tetap hidup.
  const [isi, setIsi] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const k of kolom) {
      if (k.tipe === "rentang") init[k.nama] = nilai.dari ? `${nilai.dari}..${nilai.sampai ?? nilai.dari}` : "";
      else init[k.nama] = nilai[k.nama] ?? "";
    }
    return init;
  });
  const pertama = useRef(true);
  // Snapshot nilai awal (dari URL). Tanpa guard ini, double-invoke effect di StrictMode dev
  // jalan setelah mount pertama lewat → commit 350ms router.replace yang TIDAK membawa
  // ?halaman=N, jadi halaman yang baru diklik dari paginasi senyap balik ke halaman 1.
  const nilaiAwal = useRef({ ...isi });
  // kolom/rute bisa berganti identitas tiap render (props dari server), jadi disimpan di ref:
  // kalau jadi dependensi effect, setiap render ulang mengirim navigasi dan halaman tak pernah tenang.
  const kolomRef = useRef(kolom);
  kolomRef.current = kolom;
  const ruteRef = useRef(rute);
  ruteRef.current = rute;

  useEffect(() => {
    if (pertama.current) {
      pertama.current = false;
      return;
    }
    const unchanged = kolomRef.current.every((k) => (isi[k.nama] ?? "") === (nilaiAwal.current[k.nama] ?? ""));
    if (unchanged) return;
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      for (const k of kolomRef.current) {
        const v = isi[k.nama];
        if (!v) continue;
        if (k.tipe === "rentang") {
          const [d, s] = v.split("..");
          if (d) {
            p.set("dari", d);
            p.set("sampai", s || d);
          }
        } else p.set(k.nama, v);
      }
      const qs = p.toString();
      const tujuan = qs ? `${ruteRef.current}?${qs}` : ruteRef.current;
      if (window.location.pathname + window.location.search !== tujuan) router.replace(tujuan);
      // Snapshot diperbarui ke kondisi yang baru dikomit — tanpa ini, menghapus kata kunci yang
      // baru diketik dianggap "sama dengan nilai awal saat mount" dan navigasi tidak pernah jalan.
      nilaiAwal.current = { ...isi };
    }, 350);
    return () => clearTimeout(t);
  }, [isi, router]);

  function reset() {
    const kosong = Object.fromEntries(kolom.map((k) => [k.nama, ""]));
    setIsi(kosong);
    nilaiAwal.current = kosong;
    router.replace(rute);
  }

  function kosongkan(nama: string) {
    setIsi((s) => ({ ...s, [nama]: "" }));
  }

  const adaFilter = kolom.some((k) => isi[k.nama]);
  // Pencarian utama (teks-ikon) bukan bagian filter lanjutan — selalu tampil di atas.
  const isianUtama = kolom.filter((k) => k.tipe === "teks-ikon");
  const isianLanjutan = kolom.filter((k) => k.tipe !== "teks-ikon");
  const jumlahLanjutan = isianLanjutan.filter((k) => isi[k.nama]).length;
  // Isian lanjutan tertutup oleh default, tapi otomatis terbuka kalau URL sudah membawa filter
  // supaya hasil filter lama tetap terlihat dan bisa diubah/reset tanpa klik tambahan.
  const [terbuka, setTerbuka] = useState(() => isianLanjutan.some((k) => nilai[k.nama]));

  function isian(k: Kolom) {
    return (
      <Field key={k.nama} className={k.kelas} style={k.minWidth ? { minWidth: k.minWidth } : undefined}>
        <FieldLabel htmlFor={k.nama}>{k.label}</FieldLabel>
        {k.tipe === "pilihan" ? (
          <NativeSelect
            id={k.nama}
            className="w-full"
            value={isi[k.nama]}
            onChange={(e) => setIsi((s) => ({ ...s, [k.nama]: e.target.value }))}
          >
            {k.opsi?.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : k.tipe === "teks-ikon" ? (
          <InputIkon
            ikon={SearchIcon}
            id={k.nama}
            className={isi[k.nama] ? "pr-9" : ""}
            value={isi[k.nama]}
            placeholder={k.placeholder}
            onChange={(e) => setIsi((s) => ({ ...s, [k.nama]: e.target.value }))}
          >
            {isi[k.nama] ? <TombolKosong label={k.label} onKosongkan={() => kosongkan(k.nama)} /> : null}
          </InputIkon>
        ) : k.tipe === "rentang" ? (
          <RentangPicker nama={k.nama} label={k.label} nilai={isi[k.nama]} onPilih={(v) => setIsi((s) => ({ ...s, [k.nama]: v }))} />
        ) : k.tipe === "tanggal" ? (
          <Input id={k.nama} className="num" type="date" value={isi[k.nama]} onChange={(e) => setIsi((s) => ({ ...s, [k.nama]: e.target.value }))} />
        ) : (
          <div className="relative w-full">
            <Input
              id={k.nama}
              className={`num ${isi[k.nama] ? "pr-9" : ""}`}
              value={isi[k.nama]}
              placeholder={k.placeholder}
              inputMode={k.inputMode}
              onChange={(e) => setIsi((s) => ({ ...s, [k.nama]: e.target.value }))}
            />
            {isi[k.nama] ? <TombolKosong label={k.label} onKosongkan={() => kosongkan(k.nama)} /> : null}
          </div>
        )}
      </Field>
    );
  }

  return (
    <div className="w-full">
      {isianUtama.length > 0 ? (
        <FieldGroup className="flex w-full flex-row flex-wrap items-end gap-3">{isianUtama.map(isian)}</FieldGroup>
      ) : null}
      {isianLanjutan.length > 0 ? (
        <Collapsible className="mt-3 w-full" open={terbuka} onOpenChange={setTerbuka}>
          <div className="flex flex-row flex-wrap items-end gap-3">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant={jumlahLanjutan > 0 ? "default" : "outline"}
                className="group w-full md:w-auto"
                aria-label="Filter lanjutan"
              >
                <FilterIcon data-icon="inline-start" />
                Filter lanjutan
                {jumlahLanjutan > 0 ? <span className="num">{jumlahLanjutan}</span> : null}
                <ChevronDownIcon data-icon="inline-end" className="transition-transform duration-200 motion-safe:group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            {/* Reset di luar panel supaya selalu terlihat — filter sudah jalan sendiri, sisa hanya cara mengembalikannya (juga pencarian). */}
            <div className="w-full md:w-auto">
              <Button
                type="button"
                variant={adaFilter ? "default" : "outline"}
                className="w-full md:w-auto"
                onClick={reset}
                disabled={!adaFilter}
                aria-label="Reset filter"
              >
                <RotateCcwIcon data-icon="inline-start" />
                Reset
              </Button>
            </div>
          </div>
          <CollapsibleContent>
            <FieldGroup className="mt-3 flex w-full flex-row flex-wrap items-end gap-3">{isianLanjutan.map(isian)}</FieldGroup>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}

/** Satu tombol rentang tanggal: popover membuka kalender, klik tanggal mulai lalu tanggal akhir; hasil navigasi pakai dari/sampai. */
function RentangPicker({ nama, label, nilai, onPilih }: { nama: string; label: string; nilai: string; onPilih: (v: string) => void }) {
  const [terbuka, setTerbuka] = useState(false);
  const [mulai, setMulai] = useState<Date | undefined>(undefined);
  const [dari, sampai] = nilai ? nilai.split("..") : [];
  const dipilih = mulai ? { from: mulai } : dari ? { from: new Date(`${dari}T00:00:00`), to: sampai ? new Date(`${sampai}T00:00:00`) : undefined } : undefined;
  function commit(from: Date, to: Date) {
    onPilih(`${isoOf(from)}..${isoOf(to)}`);
    setMulai(undefined);
  }
  function singkat(iso: string) {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }
  const teks = dari ? (sampai && sampai !== dari ? `${singkat(dari)} – ${singkat(sampai)}` : singkat(dari)) : "Pilih rentang tanggal";
  return (
    <Popover
      open={terbuka}
      onOpenChange={(b) => {
        setTerbuka(b);
        if (!b && mulai) commit(mulai, mulai); // satu tanggal saja kalau popover ditutup sebelum akhir dipilih
      }}
    >
      <PopoverTrigger asChild>
        <Button id={nama} type="button" variant="outline" className="num w-full justify-between font-normal" aria-label={label}>
          {teks}
          <CalendarDaysIcon data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          locale={id}
          mode="range"
          selected={dipilih}
          min={1} // klik pertama hanya menandai awal (to masih undefined) — belum ke-query
          resetOnSelect // kalau sudah ada rentang lengkap, klik berikutnya mulai rentang baru
          disabled={mulai ? { before: mulai } : undefined} // setelah awal dipilih, tanggal sebelum awal tidak bisa dipilih
          onSelect={(r) => {
            if (!r?.from) {
              onPilih("");
              setMulai(undefined);
              return;
            }
            if (r.to) {
              commit(r.from, r.to);
              setTerbuka(false);
            } else {
              setMulai(r.from); // klik pertama: tunggu tanggal akhir, belum ke-query
            }
          }}
        />
        {nilai ? (
          <div className="flex items-center justify-between gap-2 border-t border-(--border)/50 px-3 py-2">
            <span className="num text-xs text-muted-foreground">{teks}</span>
            <Button size="icon-sm" variant="ghost" className="size-8 p-0 shadow-none" aria-label="Hapus rentang tanggal" onClick={() => { onPilih(""); setTerbuka(false); }}>
              <XIcon />
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** Tanggal lokal (tanpa pergeseran zona waktu) jadi yyyy-mm-dd untuk query. */
function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Tombol X di ujung isian ketik: satu klik mengosongkan filter itu saja dan hasil ikut berubah. */
function TombolKosong({ label, onKosongkan }: { label: string; onKosongkan: () => void }) {
  return (
    <button
      type="button"
      onClick={onKosongkan}
      aria-label={`Kosongkan ${label}`}
      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <XIcon className="size-4" aria-hidden />
    </button>
  );
}
