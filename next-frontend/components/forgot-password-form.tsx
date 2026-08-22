"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import type { ForgotPasswordBffErrorResponse, ForgotPasswordBffRequest } from "@/lib/api/contracts";
import { ROOT_SERVER_ERROR, resolveErrorField } from "@/lib/forms/error-map";
import { forgotPasswordSchema, type ForgotPasswordSchema } from "@/lib/forms/forgot-password-schema";

/**
 * Shown in place of the form after a `204`. The backend answers `204` whether
 * or not the address is registered — deliberately, so the response does not
 * disclose account existence — and this copy has to preserve that: it says what
 * *would* happen for a registered address, never that an email was sent.
 *
 * **Design gap:** no Figma node models this state, and unlike `/signup` no TD
 * closed it. The wording is the implementer's call, bounded by the
 * indistinguishability criterion above.
 */
function RequestSubmittedPanel({ email }: { email: string }) {
  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-center text-heading-h1 text-foreground">Check your inbox</h1>
      <p className="text-center text-body-md text-muted-foreground">
        If <span className="text-foreground">{email}</span> belongs to an account, a reset link is
        on its way. The link expires shortly, so use it soon.
      </p>
    </div>
  );
}

/**
 * Password-reset request form. Mirrors the Figma frame `143:2307` (node
 * `140:289`): heading, supporting line, the email group (`2713:2086`) and the
 * submit button (`143:2354`). The `<form>` semantics are introduced here — the
 * design models the group as a layout frame.
 *
 * Client Component submitting to the BFF over a relative `fetch`
 * (`auth-frontend/TD-01`, Option A). `204` is the only success outcome and it
 * arrives identically for a known and an unknown address, so the screen has a
 * single post-submit state: it cannot branch on something it is not told.
 *
 * No domain error code reaches this screen — the endpoint answers `204`, `400`
 * or `429` only — so every failure lands at form level through the shared map.
 */
export function ForgotPasswordForm() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ForgotPasswordSchema>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onChange",
    defaultValues: { email: "" },
  });

  const serverError = errors.root?.serverError?.message;

  async function onSubmit({ email }: ForgotPasswordSchema) {
    const body: ForgotPasswordBffRequest = { email };
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status === 204) {
      setSubmittedEmail(email);
      return;
    }

    const envelope = (await response
      .json()
      .catch(() => null)) as ForgotPasswordBffErrorResponse | null;

    setError(envelope ? resolveErrorField(envelope.error) : ROOT_SERVER_ERROR, {
      message: envelope?.message ?? "Something went wrong. Please try again.",
    });
  }

  if (submittedEmail !== null) {
    return <RequestSubmittedPanel email={submittedEmail} />;
  }

  return (
    <form className="flex w-full flex-col gap-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex flex-col gap-6">
        <h1 className="text-center text-heading-h1 text-foreground">Reset password</h1>
        <p className="text-center text-body-md text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      {serverError ? (
        <p role="alert" className="text-body-md text-destructive">
          {serverError}
        </p>
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

      <Button
        type="submit"
        className="w-full"
        loading={isSubmitting}
        disabled={!isValid || isSubmitting}
      >
        Send reset link
      </Button>
    </form>
  );
}
