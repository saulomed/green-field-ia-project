import { describe, it, expect, beforeEach } from "vitest"
import { createOpenApiHttp } from "openapi-msw"

import { server } from "@/mocks/server"
import { config } from "@/lib/env"
import type { paths } from "@/lib/api/contracts"
import { api } from "@/lib/api/client"

const http = createOpenApiHttp<paths>({ baseUrl: config.api.baseUrl })

describe("client refresh middleware — single-flight", () => {
  let refreshCallCount: number

  beforeEach(() => {
    refreshCallCount = 0

    server.use(
      http.get("/users/me", ({ response }) =>
        response(401).json({ statusCode: 401, error: "SESSAO_INVALIDA", message: "Sessão inválida ou expirada" }),
      ),
      http.post("/auth/refresh", ({ response }) => {
        refreshCallCount += 1
        return response(200).json(
          { id: "00000000-0000-4000-8000-000000000001", email: "user@example.com" },
          { headers: { "set-cookie": "access_token=new-access-token; Max-Age=900; Path=/" } },
        )
      }),
    )
  })

  it("dispatches exactly one POST /auth/refresh for two concurrent 401s", async () => {
    await Promise.all([
      api.GET("/users/me", { headers: { cookie: "access_token=stale; refresh_token=r1" } }),
      api.GET("/users/me", { headers: { cookie: "access_token=stale; refresh_token=r1" } }),
    ])

    expect(refreshCallCount).toBe(1)
  })
})
