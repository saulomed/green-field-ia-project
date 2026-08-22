import { describe, it, expect } from "vitest"
import { createOpenApiHttp } from "openapi-msw"

import { server } from "@/mocks/server"
import { config } from "@/lib/env"
import type { paths } from "@/lib/api/contracts"
import { POST } from "@/app/api/auth/resend-confirmation/route"

const http = createOpenApiHttp<paths>({ baseUrl: config.api.baseUrl })

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/resend-confirmation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/auth/resend-confirmation", () => {
  it("returns 204 with no body for a pending account", async () => {
    server.use(http.post("/auth/resend-confirmation", ({ response }) => response(204).empty()))

    const res = await POST(makeRequest({ email: "pending@example.com" }))

    expect(res.status).toBe(204)
    expect(await res.text()).toBe("")
  })

  it("passes through a 400 validation error verbatim", async () => {
    server.use(
      http.post("/auth/resend-confirmation", ({ response }) =>
        response(400).json({
          statusCode: 400,
          error: "VALIDATION_ERROR",
          message: "Dados inválidos",
          details: [{ field: "email", message: "email must be a valid email" }],
        }),
      ),
    )

    const res = await POST(makeRequest({ email: "not-an-email" }))

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "VALIDATION_ERROR" })
  })

  it("passes through a 429 rate-limit response with a distinguishable status", async () => {
    server.use(
      http.post("/auth/resend-confirmation", ({ response }) =>
        response(429).json({
          statusCode: 429,
          error: "LIMITE_EXCEDIDO",
          message: "Muitas requisições, tente novamente mais tarde",
        }),
      ),
    )

    const res = await POST(makeRequest({ email: "pending@example.com" }))

    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ error: "LIMITE_EXCEDIDO" })
  })
})
