import { createOpenApiHttp } from "openapi-msw"

import type { paths } from "@/lib/api/contracts"
import { config } from "@/lib/env"

/**
 * Fake do `nestjs-api` — a fronteira upstream que os route handlers do BFF atravessam.
 *
 * Tipado a partir do contrato OpenAPI (next-frontend-msw-base/TD-03): caminho, método, status e
 * corpo são verificados em build contra `nestjs-project/openapi.json`. Um caminho que não exista
 * na spec, um método errado ou um corpo que não case com o status declarado quebram o
 * `tsc --noEmit` — é essa a garantia que a TD-03 comprou, e ela fecha no build do teste o buraco
 * que `next-frontend-api-typing/TD-03` conscientemente deixou aberto em runtime.
 *
 * `paths` vem de `@/lib/api/contracts`, nunca de `@/lib/api/schema` — a regra de importação de
 * `next-frontend-api-typing/TD-02` vale aqui sem carve-out.
 *
 * A base URL vem de `config.api.baseUrl`, o **mesmo** módulo que o código sob teste lê. Hardcodear
 * a URL, ou lê-la de `process.env`, faria fake e código divergirem em silêncio.
 *
 * Este módulo é da lane de `node`. Ele importa `@/lib/env`, cuja validação roda na avaliação do
 * módulo e cuja fronteira server/client (`typeof window === "undefined"`) lança sob um ambiente de
 * DOM — ver `next-frontend-env-config/TD-01`. As rotas relativas do BFF, que são o que a lane de
 * browser intercepta, vivem em `./bff-handlers`.
 */
const http = createOpenApiHttp<paths>({ baseUrl: config.api.baseUrl })

export const handlers = [
  /**
   * Caminho feliz da autenticação.
   *
   * O corpo abaixo é o `RegisterResponseDto`, que é o que a spec declara como resposta 200 de
   * `POST /auth/login` — imprecisão já confirmada no backend e que a tipagem da TD-03 torna
   * visível aqui: um corpo de login "correto" (sem `channel`) não compila enquanto a spec não for
   * corrigida. Os tokens não aparecem no corpo por decisão (`auth/TD-03`): trafegam em cookies
   * `httpOnly`, que o browser nunca lê.
   */
  http.post("/auth/login", ({ response }) =>
    response(200).json({
      id: "00000000-0000-4000-8000-000000000001",
      email: "user@streamtube.test",
      channel: { nickname: "user" },
    }),
  ),
]
