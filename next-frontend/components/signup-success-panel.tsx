"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  ResendConfirmationBffErrorResponse,
  ResendConfirmationBffRequest,
} from "@/lib/api/contracts";

type SignupSuccessPanelProps = {
  /** The address the account was registered with, echoed back to the user. */
  email: string;
};

type ResendState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent" }
  | { status: "cooldown" }
  | { status: "error"; message: string };

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
 * **Contract note:** `POST /auth/resend-confirmation` never answers
 * `409 EMAIL_JA_CONFIRMADO` in the backend as built — the resend is a silent
 * no-op (`204`) for an unknown or already-confirmed account, by design, so the
 * response does not disclose account state. The `409` branch is therefore
 * handled generically alongside every other unexpected status rather than
 * given its own copy.
 */
export function SignupSuccessPanel({ email }: SignupSuccessPanelProps) {
  const [resend, setResend] = useState<ResendState>({ status: "idle" });

  async function onResend() {
    setResend({ status: "sending" });

    const body: ResendConfirmationBffRequest = { email };
    const response = await fetch("/api/auth/resend-confirmation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status === 204) {
      setResend({ status: "sent" });
      return;
    }

    // `429` is the one outcome the screen must tell apart from the rest: it
    // puts the button on cooldown instead of surfacing a retryable error.
    if (response.status === 429) {
      setResend({ status: "cooldown" });
      return;
    }

    const envelope = (await response
      .json()
      .catch(() => null)) as ResendConfirmationBffErrorResponse | null;
    setResend({
      status: "error",
      message: envelope?.message ?? "Something went wrong. Please try again.",
    });
  }

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
