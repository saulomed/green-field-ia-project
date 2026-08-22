import { describe, it, expect } from "vitest"
import { createOpenApiHttp } from "openapi-msw"

import { server } from "@/mocks/server"
import { config } from "@/lib/env"
import type { paths } from "@/lib/api/contracts"
import { api } from "@/lib/api/client"

const http = createOpenApiHttp<paths>({ baseUrl: config.api.baseUrl })

describe("client refresh middleware — retry", () => {
  it("401 -> refresh 200 -> repeats the original call and returns the upstream result", async () => {
    let usersMeCallCount = 0

    server.use(
      http.get("/users/me", ({ request, response }) => {
        usersMeCallCount += 1
        const cookie = request.headers.get("cookie") ?? ""
        if (cookie.includes("access_token=new-access-token")) {
          return response(200).json({
            id: "00000000-0000-4000-8000-000000000001",
            email: "user@example.com",
            isConfirmed: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            channel: { nickname: "user", name: "user" },
          })
        }
        return response(401).json({
          statusCode: 401,
          error: "SESSAO_INVALIDA",
          message: "Sessão inválida ou expirada",
        })
      }),
      http.post("/auth/refresh", ({ response }) =>
        response(200).json(
          { id: "00000000-0000-4000-8000-000000000001", email: "user@example.com" },
          { headers: { "set-cookie": "access_token=new-access-token; Max-Age=900; Path=/" } },
        ),
      ),
    )

    const { data, response } = await api.GET("/users/me", {
      headers: { cookie: "access_token=stale; refresh_token=r1" },
    })

    expect(response.status).toBe(200)
    expect(data).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      email: "user@example.com",
      isConfirmed: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      channel: { nickname: "user", name: "user" },
    })
    expect(usersMeCallCount).toBe(2) // original 401 + retry with the new token
  })

  it("401 -> refresh 401 -> propagates the original 401 without a second refresh attempt", async () => {
    let refreshCallCount = 0

    server.use(
      http.get("/users/me", ({ response }) =>
        response(401).json({
          statusCode: 401,
          error: "SESSAO_INVALIDA",
          message: "Sessão inválida ou expirada",
        }),
      ),
      http.post("/auth/refresh", ({ response }) => {
        refreshCallCount += 1
        return response(401).json({
          statusCode: 401,
          error: "SESSAO_INVALIDA",
          message: "Sessão inválida ou expirada",
        })
      }),
    )

    const { error, response } = await api.GET("/users/me", {
      headers: { cookie: "access_token=stale; refresh_token=expired" },
    })

    expect(response.status).toBe(401)
    expect(error).toEqual({
      statusCode: 401,
      error: "SESSAO_INVALIDA",
      message: "Sessão inválida ou expirada",
    })
    expect(refreshCallCount).toBe(1)
  })
})
