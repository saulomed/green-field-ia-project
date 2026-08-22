import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"

import { SignupForm } from "@/components/signup-form"
import { server } from "@/mocks/server"

const VALID = {
  email: "ana@example.com",
  name: "Ana Silva",
  password: "super-secret-1",
} as const

/** Fills the mirror-validated fields and accepts the terms, leaving the form submittable. */
async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Full Name"), VALID.name)
  await user.type(screen.getByLabelText("Email address"), VALID.email)
  await user.type(screen.getByLabelText("Password"), VALID.password)
  await user.type(screen.getByLabelText("Confirm Password"), VALID.password)
  await user.click(screen.getByRole("checkbox"))
}

function submitButton() {
  return screen.getByRole("button", { name: "Create account" })
}

describe("<SignupForm>", () => {
  it("posts the exact DTO body and swaps in the success panel on 201", async () => {
    const user = userEvent.setup()
    const received = vi.fn()

    server.use(
      http.post("/api/auth/register", async ({ request }) => {
        received(await request.json())
        return HttpResponse.json(
          { id: "id-1", email: VALID.email, channel: { nickname: "ana" } },
          { status: 201 },
        )
      }),
    )

    render(<SignupForm />)
    await fillValidForm(user)
    await user.click(submitButton())

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Check your inbox" })).toBeInTheDocument()
    })

    // `confirmPassword` is a client-only rule and must never reach the DTO.
    expect(received).toHaveBeenCalledWith({
      email: VALID.email,
      name: VALID.name,
      password: VALID.password,
    })
    expect(screen.getByText(VALID.email)).toBeInTheDocument()
    expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument()
  })

  it("renders EMAIL_JA_EXISTE on the email field", async () => {
    const user = userEvent.setup()

    server.use(
      http.post("/api/auth/register", () =>
        HttpResponse.json(
          { statusCode: 409, error: "EMAIL_JA_EXISTE", message: "E-mail já cadastrado" },
          { status: 409 },
        ),
      ),
    )

    render(<SignupForm />)
    await fillValidForm(user)
    await user.click(submitButton())

    const email = screen.getByLabelText("Email address")
    await waitFor(() => expect(email).toHaveAccessibleDescription("E-mail já cadastrado"))
    expect(email).toHaveAttribute("aria-invalid", "true")
  })

  it("renders a rejected body at form level, never on a field", async () => {
    const user = userEvent.setup()

    server.use(
      http.post("/api/auth/register", () =>
        HttpResponse.json(
          { statusCode: 400, error: "VALIDATION_ERROR", message: "email must be a valid email" },
          { status: 400 },
        ),
      ),
    )

    render(<SignupForm />)
    await fillValidForm(user)
    await user.click(submitButton())

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("email must be a valid email")
    })
    expect(screen.getByLabelText("Email address")).not.toHaveAttribute("aria-invalid")
  })

  it("renders INTERNAL_SERVER_ERROR at form level", async () => {
    const user = userEvent.setup()

    server.use(
      http.post("/api/auth/register", () =>
        HttpResponse.json(
          { statusCode: 500, error: "INTERNAL_SERVER_ERROR", message: "Erro interno" },
          { status: 500 },
        ),
      ),
    )

    render(<SignupForm />)
    await fillValidForm(user)
    await user.click(submitButton())

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Erro interno"))
    expect(screen.getByLabelText("Email address")).not.toHaveAttribute("aria-invalid")
  })

  it("keeps submit disabled until the terms checkbox is accepted", async () => {
    const user = userEvent.setup()
    render(<SignupForm />)

    await user.type(screen.getByLabelText("Full Name"), VALID.name)
    await user.type(screen.getByLabelText("Email address"), VALID.email)
    await user.type(screen.getByLabelText("Password"), VALID.password)
    await user.type(screen.getByLabelText("Confirm Password"), VALID.password)

    expect(submitButton()).toBeDisabled()

    await user.click(screen.getByRole("checkbox"))
    await waitFor(() => expect(submitButton()).toBeEnabled())
  })

  it("blocks submit when confirmPassword differs, without touching the network", async () => {
    const user = userEvent.setup()
    const hit = vi.fn()

    server.use(
      http.post("/api/auth/register", () => {
        hit()
        return new HttpResponse(null, { status: 201 })
      }),
    )

    render(<SignupForm />)
    await user.type(screen.getByLabelText("Full Name"), VALID.name)
    await user.type(screen.getByLabelText("Email address"), VALID.email)
    await user.type(screen.getByLabelText("Password"), VALID.password)
    await user.type(screen.getByLabelText("Confirm Password"), "something-else")
    await user.click(screen.getByRole("checkbox"))

    await waitFor(() =>
      expect(screen.getByLabelText("Confirm Password")).toHaveAccessibleDescription(
        "As senhas não coincidem",
      ),
    )
    expect(submitButton()).toBeDisabled()
    expect(hit).not.toHaveBeenCalled()
  })

  it("rejects a malformed email before submit", async () => {
    const user = userEvent.setup()
    render(<SignupForm />)

    await user.type(screen.getByLabelText("Email address"), "not-an-email")
    await user.type(screen.getByLabelText("Password"), VALID.password)
    await user.type(screen.getByLabelText("Confirm Password"), VALID.password)
    await user.click(screen.getByRole("checkbox"))

    await waitFor(() =>
      expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription("E-mail inválido"),
    )
    expect(submitButton()).toBeDisabled()
  })

  it("requires the full name before submit", async () => {
    const user = userEvent.setup()
    render(<SignupForm />)

    await user.type(screen.getByLabelText("Email address"), VALID.email)
    await user.type(screen.getByLabelText("Password"), VALID.password)
    await user.type(screen.getByLabelText("Confirm Password"), VALID.password)
    await user.click(screen.getByRole("checkbox"))

    expect(submitButton()).toBeDisabled()

    await user.type(screen.getByLabelText("Full Name"), VALID.name)
    await waitFor(() => expect(submitButton()).toBeEnabled())
  })

  it("describes the password field by its strength bar and hint", () => {
    render(<SignupForm />)

    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      /Use at least 8 characters/,
    )
    expect(screen.getByRole("progressbar", { name: "Password strength" })).toBeInTheDocument()
  })

  it("toggles each password field independently, with a labelled control", async () => {
    const user = userEvent.setup()
    render(<SignupForm />)

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password")

    await user.click(screen.getByRole("button", { name: "Show password" }))

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text")
    expect(screen.getByLabelText("Confirm Password")).toHaveAttribute("type", "password")
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument()
  })
})
