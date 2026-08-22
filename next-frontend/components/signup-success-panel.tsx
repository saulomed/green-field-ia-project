"use client";

import { useResendConfirmation } from "@/hooks/use-resend-confirmation";
import { Button } from "@/components/ui/button";

type SignupSuccessPanelProps = {
  /** The address the account was registered with, echoed back to the user. */
  email: string;
};

/**
 * Shown in place of the signup form after a `201`, without leaving `/signup`
 * (per `auth-frontend/TD-09`, Option A). The `201` issues no session cookie —
 * there is no auto-login — and signing in before confirming is rejected with
 * `403 EMAIL_NAO_CONFIRMADO`, which is why the resend action lives here.
 *
 * **Design gap:** no Figma node models this panel or the resend states. Copy,
 * layout and the three resend outcomes below are the implementer's call until
 * a design exists — see `### Open Questions from Inventory` in `context.md`.
 * The behaviour, not the presentation, is what the acceptance criteria fix.
 *
 * The resend call itself lives in `useResendConfirmation` — `/login` offers the
 * same action after a `403 EMAIL_NAO_CONFIRMADO`, against the same endpoint.
 */
export function SignupSuccessPanel({ email }: SignupSuccessPanelProps) {
  const { state: resend, resend: onResend } = useResendConfirmation(email);

  const disabled = resend.status === "sending" || resend.status === "cooldown";

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-6">
        <h1 className="text-center text-heading-h1 text-foreground">Check your inbox</h1>
        <p className="text-center text-body-md text-muted-foreground">
          We sent a confirmation link to <span className="text-foreground">{email}</span>. Confirm
          your address to finish creating your account.
        </p>
      </div>

      {resend.status === "cooldown" ? (
        <p role="status" className="text-center text-caption text-warning-text">
          Too many requests. Wait a moment before asking for another email.
        </p>
      ) : null}

      {resend.status === "sent" ? (
        <p role="status" className="text-center text-caption text-muted-foreground">
          We sent another confirmation email to {email}.
        </p>
      ) : null}

      {resend.status === "error" ? (
        <p role="alert" className="text-center text-caption text-destructive">
          {resend.message}
        </p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="w-full"
        loading={resend.status === "sending"}
        disabled={disabled}
        onClick={onResend}
      >
        {resend.status === "sent" ? "Confirmation email sent" : "Resend confirmation email"}
      </Button>
    </div>
  );
}
