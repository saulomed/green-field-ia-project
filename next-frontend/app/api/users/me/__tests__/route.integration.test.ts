import { describe, it, expect } from "vitest"
import { createOpenApiHttp } from "openapi-msw"

import { server } from "@/mocks/server"
import { config } from "@/lib/env"
import type { paths } from "@/lib/api/contracts"
import { GET } from "@/app/api/users/me/route"

const http = createOpenApiHttp<paths>({ baseUrl: config.api.baseUrl })

function makeRequest(cookieHeader?: string) {
  return new Request("http://localhost/api/users/me", {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  })
}

const PROFILE = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "user@example.com",
  isConfirmed: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  channel: { nickname: "user", name: "user" },
}

describe("GET /api/users/me", () => {
  it("returns the profile verbatim on 200", async () => {
    server.use(http.get("/users/me", ({ response }) => response(200).json(PROFILE)))

    const res = await GET(makeRequest("access_token=valid"))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(PROFILE)
  })

  it("refreshes on a 401 and returns 200 without the caller seeing the intermediate 401", async () => {
    server.use(
      http.get("/users/me", ({ request, response }) => {
        const cookie = request.headers.get("cookie") ?? ""
        if (cookie.includes("access_token=new-access-token")) {
          return response(200).json(PROFILE)
        }
        return response(401).json({
          statusCode: 401,
          error: "SESSAO_INVALIDA",
          message: "Sessão inválida ou expirada",
        })
      }),
      http.post("/auth/refresh", ({ response }) =>
        response(200).json(
          { id: PROFILE.id, email: PROFILE.email },
          {
            headers: [["set-cookie", "access_token=new-access-token; Max-Age=900; Path=/"]],
          },
        ),
      ),
    )

    const res = await GET(makeRequest("access_token=stale; refresh_token=r1"))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(PROFILE)
    expect(res.headers.getSetCookie().some((c) => c.startsWith("access_token="))).toBe(true)
  })

  it("propagates 401 when the refresh itself fails", async () => {
    server.use(
      http.get("/users/me", ({ response }) =>
        response(401).json({
          statusCode: 401,
          error: "SESSAO_INVALIDA",
          message: "Sessão inválida ou expirada",
        }),
      ),
      http.post("/auth/refresh", ({ response }) =>
        response(401).json({
          statusCode: 401,
          error: "SESSAO_INVALIDA",
          message: "Sessão inválida ou expirada",
        }),
      ),
    )

    const res = await GET(makeRequest("access_token=stale; refresh_token=expired"))

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: "SESSAO_INVALIDA" })
  })

  it("passes through a 404 verbatim", async () => {
    server.use(
      http.get("/users/me", ({ response }) =>
        response(404).json({
          statusCode: 404,
          error: "USUARIO_NAO_ENCONTRADO",
          message: "Usuário não encontrado",
        }),
      ),
    )

    const res = await GET(makeRequest("access_token=valid"))

    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: "USUARIO_NAO_ENCONTRADO" })
  })
})
