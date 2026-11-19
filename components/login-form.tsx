"use client";

import { useEffect, useRef, useActionState } from "react";
import { LockIcon, LogInIcon, MailIcon } from "lucide-react";
import { login, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputIkon } from "@/components/input-ikon";
import { aksiTundaPemberitahuan } from "@/lib/pemberitahuan-client";

const TURNSTILE_SITEKEY = "0x4AAAAAAF_-HTIXqs6FA4Zy";

type TurnstileGlobal = {
  render: (el: HTMLElement, opts: { sitekey: string }) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(aksiTundaPemberitahuan(login), {});
  const tsRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);

  // Div kosong di SSR supaya tidak ada hydration mismatch: auto-render api.js mengisi div sebelum
  // hydration dan React lalu menimpa ulang isinya — widget hilang dari layar. Widget di-render
  // eksplisit setelah api.js selesai load; turnstile.ready() tidak dipakai karena script async.
  useEffect(() => {
    const el = tsRef.current;
    if (!el) return;
    let batal = false;
    const render = () => {
      const ts = (window as { turnstile?: TurnstileGlobal }).turnstile;
      if (batal || !ts) return;
      widgetIdRef.current = ts.render(el, { sitekey: TURNSTILE_SITEKEY });
    };
    const ts = (window as { turnstile?: TurnstileGlobal }).turnstile;
    if (ts) render();
    else {
      const script = document.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com/turnstile"]');
      if (script) script.addEventListener("load", render);
      else window.addEventListener("load", render);
    }
    return () => {
      batal = true;
      const ts = (window as { turnstile?: TurnstileGlobal }).turnstile;
      if (widgetIdRef.current && ts) {
        ts.remove(widgetIdRef.current);
        widgetIdRef.current = undefined;
      }
    };
  }, []);

  // Login gagal: token lama sudah di-redeem oleh Cloudflare, jadi widget di-reset agar challenge
  // baru dibuat dan pengguna bisa coba lagi.
  useEffect(() => {
    if (!state.error) return;
    const ts = (window as { turnstile?: TurnstileGlobal }).turnstile;
    if (ts && widgetIdRef.current) ts.reset(widgetIdRef.current);
  }, [state.error]);

  return (
    <form action={action} className="w-full">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <InputIkon ikon={MailIcon} id="email" name="email" type="email" autoComplete="username" required />
        </Field>
        <Field data-invalid={state.error ? "true" : undefined}>
          <FieldLabel htmlFor="password">Kata sandi</FieldLabel>
          <InputIkon
            ikon={LockIcon}
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={state.error ? "true" : undefined}
          />
          {state.error ? <FieldError>{state.error}</FieldError> : null}
        </Field>
        <div ref={tsRef} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : <LogInIcon data-icon="inline-start" />}
          Masuk
        </Button>
      </FieldGroup>
    </form>
  );
}
