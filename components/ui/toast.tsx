"use client"

import * as React from "react"
import { cn } from "cn"
import { Toast as ToastPrimitive } from "radix-ui"

type Nada = "sukses" | "galat" | "info"

type Item = {
  id: number
  judul: string
  keterangan?: string
  nada: Nada
  terbuka: boolean
}

/** Isi toast yang paling baru saja; yang lebih tua dilengserkan. */
const BATAS = 3

let daftar: Item[] = []
let nomor = 0
const pendengar = new Set<(daftar: Item[]) => void>()

function tulis(baru: Item[]) {
  daftar = baru
  for (const dengar of pendengar) dengar(daftar)
}

function tambah(judul: string, nada: Nada, keterangan?: string) {
  const item: Item = { id: ++nomor, judul, keterangan, nada, terbuka: true }
  tulis([...daftar, item].slice(-BATAS))
}

/** Ditutup oleh Radix (timer) atau oleh pengguna; hilang setelah animasi keluar. */
function tutup(id: number) {
  tulis(daftar.map((t) => (t.id === id ? { ...t, terbuka: false } : t)))
  window.setTimeout(() => tulis(daftar.filter((t) => t.id !== id)), 200)
}

export function useDaftarToast(): Item[] {
  return React.useSyncExternalStore(
    (dengar) => {
      pendengar.add(dengar)
      return () => pendengar.delete(dengar)
    },
    () => daftar,
    () => daftar,
  )
}

export type OpsiToast = { keterangan?: string; nada?: Nada }

export const toast = Object.assign(
  (judul: string, opsi?: OpsiToast) => tambah(judul, opsi?.nada ?? "sukses", opsi?.keterangan),
  {
    galat: (judul: string, opsi?: OpsiToast) => tambah(judul, "galat", opsi?.keterangan),
    info: (judul: string, opsi?: OpsiToast) => tambah(judul, "info", opsi?.keterangan),
    tutup,
  },
)

export { ToastPrimitive }
export type { Item, Nada }

export function Toast({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Root>) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        "group pointer-events-auto relative flex w-full items-start gap-3 rounded-xl bg-popover px-3.5 py-3 shadow-sm ring-1 ring-[var(--input)] outline-none",
        "transition-[transform,opacity] duration-200 ease-out",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-60 data-[state=closed]:slide-out-to-top-2",
        "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
        "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:animate-out data-[swipe=end]:fade-out-60",
        className,
      )}
      {...props}
    />
  )
}

export function ToastViewport({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 py-3 outline-none pointer-events-none",
        // toast duduk di bawah header (48px + 8px) supaya judul halaman tetap terbaca;
        // safe-area insets dijaga agar tidak menempel notch di HP
        "pt-[max(3.5rem,env(safe-area-inset-top))]",
        "md:gap-3 md:px-4 md:pt-[max(3.5rem,env(safe-area-inset-top))]",
        className,
      )}
      {...props}
    />
  )
}

export function ToastTitle({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Title>) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("text-sm font-medium text-popover-foreground leading-snug", className)}
      {...props}
    />
  )
}

export function ToastDescription({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Description>) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("text-[13px] text-muted-foreground leading-snug", className)}
      {...props}
    />
  )
}

export function ToastClose({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Close>) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      title="Tutup"
      className={cn(
        "-me-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none",
        "transition-colors hover:bg-foreground/8 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "max-md:size-11 max-md:-mt-2",
        "[&>svg]:size-4",
        className,
      )}
      {...props}
    />
  )
}
