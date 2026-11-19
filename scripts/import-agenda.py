#!/usr/bin/env python3
# Susun lembar agenda Excel ke JSON siap import ke tabel surat_masuk + disposisi.
# Aturan: nomor register berantai; bila nomor header duplikat (salah drag di Excel),
# nomor baru = nomor terakhir + 1 (persis angka yang muncul di baris lanjutan).
import openpyxl, re, json, sys
from datetime import datetime, date

SRC = r"C:\Bidang Aset App\0 Agenda Surat Masuk Bidang Aset (1).xlsx"
OUT = r"C:\Bidang Aset App\tmp\agenda-import.json"

def parse_date(v):
    if isinstance(v, datetime): return v.date().isoformat()
    if isinstance(v, date): return v.isoformat()
    if isinstance(v, str):
        s = v.strip()
        m = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$", s)
        if m:
            d, mo, y = (int(x) for x in m.groups())
            return date(y, mo, d).isoformat()
    return None

def text(v, limit=None):
    if v is None: return None
    s = re.sub(r"\s+", " ", str(v)).strip()
    s = re.sub(r"\n+", " | ", str(v).strip()).strip()
    if not s or s == "-": return None
    if limit and len(s) > limit: s = s[:limit]
    return s

def multiline(v):
    if v is None: return None
    s = str(v).strip()
    if not s or s == "-": return None
    return s

wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb["Surat Masuk 2024-2026"]

blocks = []          # daftar surat
last_max = 0         # nomor register tertinggi yang sudah dipakai
used = set()
rows = []
for r in range(3, ws.max_row + 1):
    cells = [ws.cell(r, c).value for c in range(1, 13)]
    if all(v is None or str(v).strip() == "" for v in cells):
        continue
    no_raw = str(cells[0]).strip() if cells[0] is not None else ""
    is_header = bool(re.search(r"\d", no_raw)) and (cells[2] or cells[5]) and cells[1] is not None
    if is_header:
        n = int(re.search(r"\d+", no_raw).group())
        repaired = False
        if n in used:
            n = last_max + 1
            repaired = True
        used.add(n)
        last_max = max(last_max, n)
        blocks.append({
            "nomor_agenda": str(n),
            "nomor_asli": no_raw,
            "nomor_diperbaiki": repaired,
            "tanggal_terima": parse_date(cells[1]),
            "pengirim": text(cells[2], 200) or "-",
            "nomor_surat": text(cells[3], 150),
            "tanggal_surat": parse_date(cells[4]),
            "perihal": text(cells[5], 500) or "-",
            "kategori": text(cells[11]),
            "disposisi": [],
        })
        if cells[6] or cells[7] or cells[8] or cells[9]:
            rows.append(blocks[-1]["disposisi"])
        cur = blocks[-1]["disposisi"]
    else:
        if not blocks:
            continue
        cur = blocks[-1]["disposisi"]
    # baris disposisi / penerusan
    td, pb, isi, ter, tt = cells[6], cells[7], cells[8], cells[9], cells[10]
    if pb:
        cur.append({"sumber_baris": r, "tanggal": parse_date(td), "pemberi": text(pb, 200),
                    "isi": multiline(isi), "penerima": text(ter, 200), "tanggal_diteruskan": parse_date(tt)})

# rapikan: tanggal/pemberi diwarisi dari baris sebelumnya dalam surat yang sama;
# baris hanya-penerusan (tanpa pemberi) jadi disposisi sendiri atas nama penerus sebelumnya.
for b in blocks:
    cleaned = []
    last_td = b["tanggal_terima"]; last_pb = None
    for d in b["disposisi"]:
        pb = d["pemberi"]
        td = d["tanggal"] or last_td
        isi = d["isi"] or (f"Diteruskan ke {d['penerima']}" if d["penerima"] else "-")
        if pb is None:
            if d["penerima"] is None: continue
            pb = last_pb or "(penerusan)"
            isi = d["isi"] or f"Diteruskan ke {d['penerima']}"
        cleaned.append({"tanggal_disposisi": td or last_td or b["tanggal_terima"],
                        "pemberi_disposisi": pb, "isi_disposisi": isi,
                        "penerima_disposisi": d["penerima"], "tanggal_diteruskan": d["tanggal_diteruskan"]})
        last_td = td; last_pb = pb
    b["disposisi"] = cleaned
    b["status_surat"] = "didisposisikan" if cleaned else "belum_disposisi"

kategori_vals = sorted({b["kategori"] for b in blocks if b["kategori"]})
pengirim = sorted({b["pengirim"] for b in blocks})
pemberi = sorted({d["pemberi_disposisi"] for b in blocks for d in b["disposisi"]})
penerima = sorted({d["penerima_disposisi"] for b in blocks for d in b["disposisi"] if d["penerima_disposisi"]})

json.dump({"surat": blocks, "kategori": kategori_vals, "pengirim": pengirim,
           "pemberi": pemberi, "penerima": penerima}, open(OUT, "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

dups = [b for b in blocks if b["nomor_diperbaiki"]]
print(f"surat: {len(blocks)}, disposisi: {sum(len(b['disposisi']) for b in blocks)}")
print(f"nomor duplikat diperbaiki ke urutan: {len(dups)} -> {[b['nomor_agenda'] for b in dups][:12]} ...")
print(f"tanggal terima: {min(b['tanggal_terima'] for b in blocks)} s.d. {max(b['tanggal_terima'] for b in blocks)}")
print(f"tanpa tanggal surat: {sum(1 for b in blocks if not b['tanggal_surat'])}")
print(f"tanpa nomor surat: {sum(1 for b in blocks if not b['nomor_surat'])}")
print(f"kategori: {kategori_vals}")
print(f"pengirim unik: {len(pengirim)}, pemberi unik: {len(pemberi)}, terusan unik: {len(penerima)}")
print(f"tersimpan: {OUT}")
