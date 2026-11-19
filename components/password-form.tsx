"use client";

import { useActionState } from "react";
import { KeyRoundIcon, LockIcon } from "lucide-react";
import { gantiKataSandi, type AuthState } from "@/lib/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputIkon } from "@/components/input-ikon";
import { Spinner } from "@/components/ui/spinner";
import { aksiTundaPemberitahuan } from "@/lib/pemberitahuan-client";

export function PasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(aksiTundaPemberitahuan(gantiKataSandi), {});

  return (
    <form action={action} className="w-full max-w-[560px]">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password_lama">Kata sandi lama</FieldLabel>
          <InputIkon
            ikon={LockIcon}
            id="password_lama"
            name="password_lama"
            type="password"
            autoComplete="current-password"
            required
            data-invalid={state.error ? "true" : undefined}
            aria-invalid={state.error ? "true" : undefined}
          />
          <FieldDescription>Kata sandi lama diperiksa sebelum sandi baru disimpan.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="password_baru">Kata sandi baru</FieldLabel>
          <InputIkon
            ikon={LockIcon}
            id="password_baru"
            name="password_baru"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
          <FieldDescription>Paling sedikit 8 karakter.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="password_konfirmasi">Konfirmasi kata sandi baru</FieldLabel>
          <InputIkon
            ikon={LockIcon}
            id="password_konfirmasi"
            name="password_konfirmasi"
            type="password"
            autoComplete="new-password"
            required
            data-invalid={state.error ? "true" : undefined}
            aria-invalid={state.error ? "true" : undefined}
          />
        </Field>

        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {state.ok ? (
          <Alert>
            <AlertDescription>{state.ok}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : <KeyRoundIcon data-icon="inline-start" />}
          Ganti kata sandi
        </Button>
      </FieldGroup>
    </form>
  );
}
