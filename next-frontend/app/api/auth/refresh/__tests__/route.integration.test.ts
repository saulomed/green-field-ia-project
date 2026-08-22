import { describe, it, expect } from "vitest"
import { createOpenApiHttp } from "openapi-msw"

import { server } from "@/mocks/server"
import { config } from "@/lib/env"
import type { paths } from "@/lib/api/contracts"
import { POST } from "@/app/api/auth/refresh/route"

const http = createOpenApiHttp<paths>({ baseUrl: config.api.baseUrl })

function makeRequest(cookieHeader?: string) {
  return new Request("http://localhost/api/auth/refresh", {
    method: "POST",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  })
}

describe("POST /api/auth/refresh", () => {
  it("reissues a new session cookie pair on 200", async () => {
    server.use(
      http.post("/auth/refresh", ({ response }) =>
        response(200).json(
          { id: "00000000-0000-4000-8000-000000000001", email: "user@example.com" },
          {
            headers: [
              ["set-cookie", "access_token=new-access; Max-Age=900; Path=/auth; HttpOnly"],
              ["set-cookie", "refresh_token=new-refresh; Max-Age=604800; Path=/auth; HttpOnly"],
            ],
          },
        ),
      ),
    )

    const res = await POST(makeRequest("refresh_token=r1"))

    expect(res.status).toBe(200)
    const setCookies = res.headers.getSetCookie()
    expect(setCookies).toHaveLength(2)
    expect(setCookies.find((c) => c.startsWith("access_token="))).toMatch(/HttpOnly/)
    expect(setCookies.find((c) => c.startsWith("refresh_token="))).toMatch(/Max-Age=604800/)
  })

  it("returns 401 SESSAO_INVALIDA and clears session cookies when there is no refresh cookie", async () => {
    server.use(
      http.post("/auth/refresh", ({ response }) =>
        response(401).json({
          statusCode: 401,
          error: "SESSAO_INVALIDA",
          message: "Sessão inválida ou expirada",
        }),
      ),
    )

    const res = await POST(makeRequest())

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: "SESSAO_INVALIDA" })
    expect(res.cookies.get("access_token")).toMatchObject({ value: "" })
    expect(res.cookies.get("refresh_token")).toMatchObject({ value: "" })
  })

  it("returns 401 TOKEN_REUTILIZADO and expires the session cookies in the browser", async () => {
    server.use(
      http.post("/auth/refresh", ({ response }) =>
        response(401).json({
          statusCode: 401,
          error: "TOKEN_REUTILIZADO",
          message: "Refresh token reutilizado",
        }),
      ),
    )

    const res = await POST(makeRequest("refresh_token=already-used"))

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: "TOKEN_REUTILIZADO" })
    const setCookies = res.headers.getSetCookie()
    expect(setCookies).toHaveLength(2)
  })
})
