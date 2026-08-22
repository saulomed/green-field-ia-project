"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { useResendConfirmation } from "@/hooks/use-resend-confirmation";
import type { LoginBffErrorResponse, LoginBffRequest } from "@/lib/api/contracts";
import { ROOT_SERVER_ERROR, resolveErrorField } from "@/lib/forms/error-map";
import { loginSchema, type LoginSchema } from "@/lib/forms/login-schema";

/**
 * Offered under the form-level error when the account exists but has never been
 * confirmed (`403 EMAIL_NAO_CONFIRMADO`) — signing in is impossible until the
 * address is confirmed, so the screen hands the user the way out instead of a
 * dead end.
 *
 * **Design gap:** no Figma node models this surface. Copy and placement are the
 * implementer's call until a design exists; the acceptance criteria fix the
 * behaviour, not the presentation.
 */
function ResendConfirmationNotice({ email }: { email: string }) {
  const { state, resend } = useResendConfirmation(email);

  return (
    <div className="flex flex-col items-start gap-2">
      {state.status === "sent" ? (
        <p role="status" className="text-caption text-muted-foreground">
          We sent another confirmation email to {email}.
        </p>
      ) : null}

      {state.status === "cooldown" ? (
        <p role="status" className="text-caption text-warning-text">
          Too many requests. Wait a moment before asking for another email.
        </p>
      ) : null}

      {state.status === "error" ? (
        <p role="alert" className="text-caption text-destructive">
          {state.message}
        </p>
      ) : null}

      <Button
        type="button"
        variant="link"
        size="sm"
        className="min-w-0 px-0"
        loading={state.status === "sending"}
        disabled={state.status === "sending" || state.status === "cooldown"}
        onClick={resend}
      >
        {state.status === "sent" ? "Confirmation email sent" : "Resend confirmation email"}
      </Button>
    </div>
  );
}

/**
 * Sign-in form. Mirrors the Figma frame `143:2265` (node `138:179`): the two
 * field groups (`147:534` / `147:537`) and the submit button (`147:541`) are
 * layout frames there — the `<form>` semantics are introduced here, since the
 * design does not model them.
 *
 * Client Component submitting to the BFF over a relative `fetch`
 * (`auth-frontend/TD-01`, Option A). The session cookies are reissued by the
 * route handler (`auth-frontend/TD-03`) and **never read by JavaScript** — this
 * screen never inspects the session, it only triggers it.
 *
 * `CREDENCIAIS_INVALIDAS` covers both an unknown address and a wrong password
 * on the backend, so the message lands at form level: there is no field to
 * blame, and blaming one would disclose whether the address is registered.
 *
 * **Post-login destination:** no decision in this slice picks one. Sending the
 * user to `/` — the only other route that exists — is the implementer's call.
 */
export function LoginForm() {
  const router = useRouter();
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  const serverError = errors.root?.serverError?.message;

  async function onSubmit(values: LoginSchema) {
    setUnconfirmedEmail(null);

    const body: LoginBffRequest = values;
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status === 200) {
      // The cookies arrived on this response; `refresh` makes the Server
      // Components re-render with the session in place.
      router.replace("/");
      router.refresh();
      return;
    }

    const envelope = (await response.json().catch(() => null)) as LoginBffErrorResponse | null;

    if (envelope?.error === "EMAIL_NAO_CONFIRMADO") {
      setUnconfirmedEmail(values.email);
    }

    setError(envelope ? resolveErrorField(envelope.error) : ROOT_SERVER_ERROR, {
      message: envelope?.message ?? "Something went wrong. Please try again.",
    });
  }

  return (
    <form className="flex w-full flex-col gap-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      {serverError ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-body-md text-destructive">
            {serverError}
          </p>
          {unconfirmedEmail !== null ? <ResendConfirmationNotice email={unconfirmedEmail} /> : null}
        </div>
      ) : null}

      <FormField id="email" label="Email address" error={errors.email}>
        {(a11y) => (
          <TextField
            id="email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email"
            {...a11y}
            {...register("email")}
          />
        )}
      </FormField>

      <FormField
        id="password"
        label="Password"
        error={errors.password}
        action={
          <Link
            href="/forgot-password"
            className="rounded-1 text-body-md text-link focus-visible:shadow-focus-ring focus-visible:outline-none"
          >
            Forgot password?
          </Link>
        }
      >
        {(a11y) => (
          <TextField
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            {...a11y}
            {...register("password")}
          />
        )}
      </FormField>

      <Button type="submit" className="w-full" loading={isSubmitting} disabled={!isValid || isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}
