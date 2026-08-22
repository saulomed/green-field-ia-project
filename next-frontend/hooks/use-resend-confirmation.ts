"use client";

import { useState } from "react";

import type {
  ResendConfirmationBffErrorResponse,
  ResendConfirmationBffRequest,
} from "@/lib/api/contracts";

export type ResendState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent" }
  | { status: "cooldown" }
  | { status: "error"; message: string };

/**
 * Drives `POST /api/auth/resend-confirmation` for the two screens that offer
 * the action: the signup success panel (after a `201`, before the address is
 * confirmed) and the login form (after a `403 EMAIL_NAO_CONFIRMADO`). Both
 * reach the same endpoint with the same outcomes, so the state machine lives
 * here rather than once per screen.
 *
 * **Contract note:** `POST /auth/resend-confirmation` never answers
 * `409 EMAIL_JA_CONFIRMADO` in the backend as built — the resend is a silent
 * no-op (`204`) for an unknown or already-confirmed account, by design, so the
 * response does not disclose account state. The `409` branch is therefore
 * handled generically alongside every other unexpected status.
 *
 * @param email - address the confirmation link is sent to
 */
export function useResendConfirmation(email: string) {
  const [state, setState] = useState<ResendState>({ status: "idle" });

  async function resend() {
    setState({ status: "sending" });

    const body: ResendConfirmationBffRequest = { email };
    const response = await fetch("/api/auth/resend-confirmation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status === 204) {
      setState({ status: "sent" });
      return;
    }

    // `429` is the one outcome the screens must tell apart from the rest: it
    // puts the control on cooldown instead of surfacing a retryable error.
    if (response.status === 429) {
      setState({ status: "cooldown" });
      return;
    }

    const envelope = (await response
      .json()
      .catch(() => null)) as ResendConfirmationBffErrorResponse | null;
    setState({
      status: "error",
      message: envelope?.message ?? "Something went wrong. Please try again.",
    });
  }

  return { state, resend };
}
