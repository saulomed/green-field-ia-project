import { describe, it, expect } from "vitest"
import { createOpenApiHttp } from "openapi-msw"

import { server } from "@/mocks/server"
import { config } from "@/lib/env"
import type { paths } from "@/lib/api/contracts"
import { POST } from "@/app/api/auth/login/route"

const http = createOpenApiHttp<paths>({ baseUrl: config.api.baseUrl })

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/auth/login", () => {
  it("reissues session cookies with BFF attributes on a 200", async () => {
    server.use(
      http.post("/auth/login", ({ response }) =>
        response(200).json(
          {
            id: "00000000-0000-4000-8000-000000000001",
            email: "user@example.com",
            channel: { nickname: "user" },
          },
          {
            headers: [
              ["set-cookie", "access_token=jwt-access; Max-Age=900; Path=/auth; HttpOnly"],
              ["set-cookie", "refresh_token=jwt-refresh; Max-Age=604800; Path=/auth; HttpOnly"],
            ],
          },
        ),
      ),
    )

    const res = await POST(makeRequest({ email: "user@example.com", password: "super-secret-1" }))

    expect(res.status).toBe(200)
    const setCookies = res.headers.getSetCookie()
    expect(setCookies).toHaveLength(2)
    for (const cookie of setCookies) {
      expect(cookie).toMatch(/HttpOnly/)
      expect(cookie).toMatch(/Secure/)
      expect(cookie).toMatch(/SameSite=[Ss]trict/)
    }
    expect(setCookies.find((c) => c.startsWith("access_token="))).toMatch(/Max-Age=900/)
    expect(setCookies.find((c) => c.startsWith("refresh_token="))).toMatch(/Max-Age=604800/)
  })

  it("passes through 401 CREDENCIAIS_INVALIDAS verbatim, with no Set-Cookie", async () => {
    server.use(
      http.post("/auth/login", ({ response }) =>
        response(401).json({
          statusCode: 401,
          error: "CREDENCIAIS_INVALIDAS",
          message: "Credenciais inválidas",
        }),
      ),
    )

    const res = await POST(makeRequest({ email: "user@example.com", password: "wrong" }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      statusCode: 401,
      error: "CREDENCIAIS_INVALIDAS",
      message: "Credenciais inválidas",
    })
    expect(res.headers.getSetCookie()).toHaveLength(0)
  })

  it("passes through 403 EMAIL_NAO_CONFIRMADO verbatim", async () => {
    server.use(
      http.post("/auth/login", ({ response }) =>
        response(403).json({
          statusCode: 403,
          error: "EMAIL_NAO_CONFIRMADO",
          message: "E-mail ainda não confirmado",
        }),
      ),
    )

    const res = await POST(
      makeRequest({ email: "unconfirmed@example.com", password: "super-secret-1" }),
    )

    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: "EMAIL_NAO_CONFIRMADO" })
    expect(res.headers.getSetCookie()).toHaveLength(0)
  })

  it("passes through a 400 validation error verbatim", async () => {
    server.use(
      http.post("/auth/login", ({ response }) =>
        response(400).json({
          statusCode: 400,
          error: "VALIDATION_ERROR",
          message: "Dados inválidos",
          details: [{ field: "email", message: "email must be a valid email" }],
        }),
      ),
    )

    const res = await POST(makeRequest({ email: "not-an-email", password: "super-secret-1" }))

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "VALIDATION_ERROR" })
  })

  it("passes through a 429 rate-limit response verbatim", async () => {
    server.use(
      http.post("/auth/login", ({ response }) =>
        response(429).json({
          statusCode: 429,
          error: "LIMITE_EXCEDIDO",
          message: "Muitas requisições, tente novamente mais tarde",
        }),
      ),
    )

    const res = await POST(makeRequest({ email: "user@example.com", password: "super-secret-1" }))

    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ error: "LIMITE_EXCEDIDO" })
    expect(res.headers.getSetCookie()).toHaveLength(0)
  })
})
