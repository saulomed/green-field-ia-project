import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"

import { SignupSuccessPanel } from "@/components/signup-success-panel"
import { server } from "@/mocks/server"

const EMAIL = "ana@example.com"

function resendButton() {
  return screen.getByRole("button", { name: /Resend confirmation email|Confirmation email sent/ })
}

describe("<SignupSuccessPanel>", () => {
  it("echoes the registered address", () => {
    render(<SignupSuccessPanel email={EMAIL} />)
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
  })

  it("posts the registered address and confirms on 204", async () => {
    const user = userEvent.setup()
    const received = vi.fn()

    server.use(
      http.post("/api/auth/resend-confirmation", async ({ request }) => {
        received(await request.json())
        return new HttpResponse(null, { status: 204 })
      }),
    )

    render(<SignupSuccessPanel email={EMAIL} />)
    await user.click(resendButton())

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        `We sent another confirmation email to ${EMAIL}`,
      )
    })
    expect(received).toHaveBeenCalledWith({ email: EMAIL })
  })

  it("puts the button on cooldown on 429, distinct from any other outcome", async () => {
    const user = userEvent.setup()

    server.use(
      http.post("/api/auth/resend-confirmation", () =>
        HttpResponse.json(
          { statusCode: 429, error: "TOO_MANY_REQUESTS", message: "Too many requests" },
          { status: 429 },
        ),
      ),
    )

    render(<SignupSuccessPanel email={EMAIL} />)
    await user.click(resendButton())

    await waitFor(() => expect(resendButton()).toBeDisabled())
    expect(screen.getByRole("status")).toHaveTextContent(/Wait a moment/)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("surfaces EMAIL_JA_CONFIRMADO as a retryable error, leaving the button enabled", async () => {
    const user = userEvent.setup()

    server.use(
      http.post("/api/auth/resend-confirmation", () =>
        HttpResponse.json(
          { statusCode: 409, error: "EMAIL_JA_CONFIRMADO", message: "E-mail já confirmado" },
          { status: 409 },
        ),
      ),
    )

    render(<SignupSuccessPanel email={EMAIL} />)
    await user.click(resendButton())

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("E-mail já confirmado"))
    expect(resendButton()).toBeEnabled()
  })
})
