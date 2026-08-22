import { beforeEach, describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"

import { LoginForm } from "@/components/login-form"
import { server } from "@/mocks/server"

const replace = vi.fn()
const refresh = vi.fn()

// `useRouter` has no implementation outside the Next runtime — the one sanctioned
// mock boundary for a client component, alongside `fetch` (owned by MSW).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}))

const VALID = {
  email: "ana@example.com",
  password: "super-secret-1",
} as const

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Email address"), VALID.email)
  await user.type(screen.getByLabelText("Password"), VALID.password)
}

function submitButton() {
  return screen.getByRole("button", { name: "Sign in" })
}

/** Envelope do backend para o `401` que cobre e-mail desconhecido *e* senha errada. */
function invalidCredentials() {
  return HttpResponse.json(
    { statusCode: 401, error: "CREDENCIAIS_INVALIDAS", message: "Credenciais inválidas" },
    { status: 401 },
  )
}

describe("<LoginForm>", () => {
  // `replace`/`refresh` são de módulo (o factory do `vi.mock` é içado e não pode
  // fechar sobre estado por teste), então a contagem de chamadas vaza sem isto.
  beforeEach(() => {
    replace.mockClear()
    refresh.mockClear()
  })

  it("posts the exact DTO body and routes away on 200", async () => {
    const user = userEvent.setup()
    const received = vi.fn()

    server.use(
      http.post("/api/auth/login", async ({ request }) => {
        received(await request.json())
        return HttpResponse.json(
          { id: "id-1", email: VALID.email, channel: { nickname: "ana" } },
          { status: 200 },
        )
      }),
    )

    render(<LoginForm />)
    await fillValidForm(user)
    await user.click(submitButton())

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"))
    expect(received).toHaveBeenCalledWith({ email: VALID.email, password: VALID.password })
    expect(refresh).toHaveBeenCalled()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("shows CREDENCIAIS_INVALIDAS at form level, blaming no field", async () => {
    const user = userEvent.setup()

    server.use(http.post("/api/auth/login", invalidCredentials))

    render(<LoginForm />)
    await fillValidForm(user)
    await user.click(submitButton())

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Credenciais inválidas")
    })
    // O backend não distingue e-mail desconhecido de senha errada; a tela não pode inventar
    // a distinção marcando um dos campos.
    expect(screen.getByLabelText("Email address")).not.toHaveAttribute("aria-invalid")
    expect(screen.getByLabelText("Password")).not.toHaveAttribute("aria-invalid")
    expect(replace).not.toHaveBeenCalled()
  })

  it("renders the same message for an unknown address and a wrong password", async () => {
    const user = userEvent.setup()

    server.use(http.post("/api/auth/login", invalidCredentials))

    const { unmount } = render(<LoginForm />)
    await fillValidForm(user)
    await user.click(submitButton())
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument())
    const wrongPassword = screen.getByRole("alert").textContent
    unmount()

    render(<LoginForm />)
    await user.type(screen.getByLabelText("Email address"), "ninguem@example.com")
    await user.type(screen.getByLabelText("Password"), VALID.password)
    await user.click(submitButton())
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument())

    expect(screen.getByRole("alert").textContent).toBe(wrongPassword)
  })

  it("offers the resend CTA on EMAIL_NAO_CONFIRMADO and posts the address to it", async () => {
    const user = userEvent.setup()
    const received = vi.fn()

    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(
          { statusCode: 403, error: "EMAIL_NAO_CONFIRMADO", message: "Confirme seu e-mail" },
          { status: 403 },
        ),
      ),
      http.post("/api/auth/resend-confirmation", async ({ request }) => {
        received(await request.json())
        return new HttpResponse(null, { status: 204 })
      }),
    )

    render(<LoginForm />)
    await fillValidForm(user)
    await user.click(submitButton())

    const cta = await screen.findByRole("button", { name: "Resend confirmation email" })
    expect(screen.getByRole("alert")).toHaveTextContent("Confirme seu e-mail")

    await user.click(cta)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Confirmation email sent" })).toBeInTheDocument()
    })
    expect(received).toHaveBeenCalledWith({ email: VALID.email })
  })

  it("does not offer the resend CTA for a credentials error", async () => {
    const user = userEvent.setup()

    server.use(http.post("/api/auth/login", invalidCredentials))

    render(<LoginForm />)
    await fillValidForm(user)
    await user.click(submitButton())

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument())
    expect(
      screen.queryByRole("button", { name: "Resend confirmation email" }),
    ).not.toBeInTheDocument()
  })

  it("puts the resend CTA on cooldown after a 429", async () => {
    const user = userEvent.setup()

    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(
          { statusCode: 403, error: "EMAIL_NAO_CONFIRMADO", message: "Confirme seu e-mail" },
          { status: 403 },
        ),
      ),
      http.post("/api/auth/resend-confirmation", () =>
        HttpResponse.json(
          { statusCode: 429, error: "LIMITE_EXCEDIDO", message: "Muitas tentativas" },
          { status: 429 },
        ),
      ),
    )

    render(<LoginForm />)
    await fillValidForm(user)
    await user.click(submitButton())
    await user.click(await screen.findByRole("button", { name: "Resend confirmation email" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Resend confirmation email" })).toBeDisabled()
    })
    expect(screen.getByRole("status")).toHaveTextContent("Too many requests")
  })

  it("surfaces a 429 on the login itself at form level", async () => {
    const user = userEvent.setup()

    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(
          { statusCode: 429, error: "LIMITE_EXCEDIDO", message: "Muitas tentativas" },
          { status: 429 },
        ),
      ),
    )

    render(<LoginForm />)
    await fillValidForm(user)
    await user.click(submitButton())

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Muitas tentativas"))
    expect(
      screen.queryByRole("button", { name: "Resend confirmation email" }),
    ).not.toBeInTheDocument()
  })

  it("surfaces INTERNAL_SERVER_ERROR at form level", async () => {
    const user = userEvent.setup()

    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(
          { statusCode: 500, error: "INTERNAL_SERVER_ERROR", message: "Erro interno" },
          { status: 500 },
        ),
      ),
    )

    render(<LoginForm />)
    await fillValidForm(user)
    await user.click(submitButton())

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Erro interno"))
  })

  it("keeps submit disabled until the client-side mirror passes, with no request", async () => {
    const user = userEvent.setup()
    const received = vi.fn()

    server.use(http.post("/api/auth/login", () => { received(); return invalidCredentials() }))

    render(<LoginForm />)
    expect(submitButton()).toBeDisabled()

    await user.type(screen.getByLabelText("Email address"), "nao-e-email")
    await user.type(screen.getByLabelText("Password"), "curta")

    await waitFor(() => {
      expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription("E-mail inválido")
    })
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      "A senha deve ter no mínimo 8 caracteres",
    )
    expect(submitButton()).toBeDisabled()
    expect(received).not.toHaveBeenCalled()
  })

  it("links to /forgot-password and never reads a cookie", async () => {
    render(<LoginForm />)

    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password",
    )
  })
})
