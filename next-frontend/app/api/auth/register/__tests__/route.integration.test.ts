import { describe, it, expect } from "vitest"
import { createOpenApiHttp } from "openapi-msw"

import { server } from "@/mocks/server"
import { config } from "@/lib/env"
import type { paths } from "@/lib/api/contracts"
import { POST } from "@/app/api/auth/register/route"

const http = createOpenApiHttp<paths>({ baseUrl: config.api.baseUrl })

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/auth/register", () => {
  it("passes through the 201 body verbatim, with no Set-Cookie header", async () => {
    server.use(
      http.post("/auth/register", ({ response }) =>
        response(201).json({
          id: "00000000-0000-4000-8000-000000000003",
          email: "user@example.com",
          channel: { nickname: "user" },
        }),
      ),
    )

    const res = await POST(makeRequest({ email: "user@example.com", password: "super-secret-1" }))

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({
      id: "00000000-0000-4000-8000-000000000003",
      email: "user@example.com",
      channel: { nickname: "user" },
    })
    expect(res.headers.get("set-cookie")).toBeNull()
  })

  it("passes through 409 EMAIL_JA_EXISTE verbatim", async () => {
    server.use(
      http.post("/auth/register", ({ response }) =>
        response(409).json({
          statusCode: 409,
          error: "EMAIL_JA_EXISTE",
          message: "E-mail já cadastrado",
        }),
      ),
    )

    const res = await POST(makeRequest({ email: "dup@example.com", password: "super-secret-1" }))

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      statusCode: 409,
      error: "EMAIL_JA_EXISTE",
      message: "E-mail já cadastrado",
    })
  })

  it("passes through a 400 validation error with statusCode, error, message and details intact", async () => {
    server.use(
      http.post("/auth/register", ({ response }) =>
        response(400).json({
          statusCode: 400,
          error: "VALIDATION_ERROR",
          message: "Dados inválidos",
          details: [{ field: "password", message: "password must be longer than 8 characters" }],
        }),
      ),
    )

    const res = await POST(makeRequest({ email: "user@example.com", password: "short" }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      statusCode: 400,
      error: "VALIDATION_ERROR",
      message: "Dados inválidos",
      details: [{ field: "password", message: "password must be longer than 8 characters" }],
    })
  })
})
