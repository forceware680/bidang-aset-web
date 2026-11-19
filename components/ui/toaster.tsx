"use client"

import * as React from "react"
import { CircleCheckIcon, InfoIcon, OctagonXIcon, XIcon } from "lucide-react"

import { Toast, ToastClose, ToastDescription, ToastPrimitive, ToastTitle, ToastViewport, toast, useDaftarToast, type Nada } from "@/components/ui/toast"

/** Warna chip mengikuti makna hasil: sukses tenang, galat diperingati, info netral. */
const chipNada: Record<Nada, string> = {
  sukses: "bg-success-bg text-success ring-success-line",
  galat: "bg-destructive/10 text-destructive ring-destructive/30",
  info: "bg-info-bg text-info ring-info-line",
}

const ikonNada: Record<Nada, React.ReactNode> = {
  sukses: <CircleCheckIcon />,
  galat: <OctagonXIcon />,
  info: <InfoIcon />,
}

export function Toaster() {
  const daftar = useDaftarToast()

  return (
    <ToastPrimitive.Provider label="Umpan balik" duration={4500}>
      {daftar.map((item) => (
        <Toast
          key={item.id}
          open={item.terbuka}
          onOpenChange={(terbuka) => {
            if (!terbuka) toast.tutup(item.id)
          }}
          className="max-w-[min(100%,28rem)]"
        >
          <span
            data-slot="toast-chip"
            className={`grid size-7 shrink-0 place-items-center rounded-md ring-1 ${chipNada[item.nada]} [&>svg]:size-4`}
          >
            {ikonNada[item.nada]}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <ToastTitle>{item.judul}</ToastTitle>
            {item.keterangan ? <ToastDescription>{item.keterangan}</ToastDescription> : null}
          </div>
          <ToastClose>
            <XIcon />
          </ToastClose>
        </Toast>
      ))}
      <ToastViewport />
    </ToastPrimitive.Provider>
  )
}
