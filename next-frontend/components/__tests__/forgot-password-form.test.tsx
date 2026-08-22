import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"

import { ForgotPasswordForm } from "@/components/forgot-password-form"
import { server } from "@/mocks/server"

const KNOWN = "ana@example.com"
const UNKNOWN = "ninguem@example.com"

function submitButton() {
  return screen.getByRole("button", { name: "Send reset link" })
}

/** Preenche o e-mail e submete, devolvendo o `user` para asserções seguintes. */
async function submitEmail(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.type(screen.getByLabelText("Email address"), email)
  await user.click(submitButton())
}

describe("<ForgotPasswordForm>", () => {
  it("posts the exact DTO body and swaps in the confirmation on 204", async () => {
    const user = userEvent.setup()
    const received = vi.fn()

    server.use(
      http.post("/api/auth/forgot-password", async ({ request }) => {
        received(await request.json())
        return new HttpResponse(null, { status: 204 })
      }),
    )

    render(<ForgotPasswordForm />)
    await submitEmail(user, KNOWN)

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Check your inbox" })).toBeInTheDocument()
    })
    expect(received).toHaveBeenCalledWith({ email: KNOWN })
    expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument()
  })

  it("shows the same screen for a registered and an unknown address", async () => {
    const user = userEvent.setup()

    // O backend responde `204` nos dois casos, de propósito. O fake não pode
    // divergir disso sem inventar um contrato que não existe.
    server.use(
      http.post("/api/auth/forgot-password", () => new HttpResponse(null, { status: 204 })),
    )

    const known = render(<ForgotPasswordForm />)
    await submitEmail(user, KNOWN)
    await waitFor(() => expect(screen.getByRole("heading")).toBeInTheDocument())
    const knownScreen = screen.getByRole("heading").parentElement?.textContent
    known.unmount()

    render(<ForgotPasswordForm />)
    await submitEmail(user, UNKNOWN)
    await waitFor(() => expect(screen.getByRole("heading")).toBeInTheDocument())
    const unknownScreen = screen.getByRole("heading").parentElement?.textContent

    // Só o endereço ecoado difere; o resto do texto é idêntico, então nada na tela
    // revela se a conta existe.
    expect(knownScreen?.replace(KNOWN, "")).toBe(unknownScreen?.replace(UNKNOWN, ""))
  })

  it("surfaces a 429 at form level, staying on the form", async () => {
    const user = userEvent.setup()

    server.use(
      http.post("/api/auth/forgot-password", () =>
        HttpResponse.json(
          { statusCode: 429, error: "LIMITE_EXCEDIDO", message: "Muitas tentativas" },
          { status: 429 },
        ),
      ),
    )

    render(<ForgotPasswordForm />)
    await submitEmail(user, KNOWN)

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Muitas tentativas"))
    // O erro não pode virar um canal lateral: continua sendo o mesmo para qualquer
    // endereço, e o campo não é culpado.
    expect(screen.getByLabelText("Email address")).not.toHaveAttribute("aria-invalid")
    expect(screen.queryByRole("heading", { name: "Check your inbox" })).not.toBeInTheDocument()
  })

  it("surfaces the ValidationPipe 400 at form level", async () => {
    const user = userEvent.setup()

    server.use(
      http.post("/api/auth/forgot-password", () =>
        HttpResponse.json(
          { statusCode: 400, error: "VALIDATION_ERROR", message: "E-mail inválido" },
          { status: 400 },
        ),
      ),
    )

    render(<ForgotPasswordForm />)
    await submitEmail(user, KNOWN)

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("E-mail inválido"))
    expect(screen.getByLabelText("Email address")).not.toHaveAttribute("aria-invalid")
  })

  it("falls back to a generic message when the response carries no envelope", async () => {
    const user = userEvent.setup()

    server.use(
      http.post("/api/auth/forgot-password", () => new HttpResponse(null, { status: 500 })),
    )

    render(<ForgotPasswordForm />)
    await submitEmail(user, KNOWN)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Please try again.")
    })
  })

  it("blocks a malformed address before any network call", async () => {
    const user = userEvent.setup()
    const received = vi.fn()

    server.use(
      http.post("/api/auth/forgot-password", () => {
        received()
        return new HttpResponse(null, { status: 204 })
      }),
    )

    render(<ForgotPasswordForm />)
    expect(submitButton()).toBeDisabled()

    await user.type(screen.getByLabelText("Email address"), "nao-e-email")

    await waitFor(() => {
      expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription("E-mail inválido")
    })
    expect(submitButton()).toBeDisabled()
    expect(received).not.toHaveBeenCalled()
  })
})
