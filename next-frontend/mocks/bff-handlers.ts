import { http, HttpResponse, type RequestHandler } from "msw"

import type { RegisterBffRequest, RegisterBffResponse } from "@/lib/api/contracts"

/**
 * Fake das rotas relativas `/api/...` do próprio Next — a superfície que a lane de browser
 * intercepta (next-frontend-msw-base/TD-04).
 *
 * Mantido separado de `./handlers` de propósito: aquele fala com o `nestjs-api` e é tipado pela
 * spec OpenAPI (TD-03); estas rotas são do BFF, não existem na spec do backend e resolvem contra
 * o `location` do documento. Misturar as duas no mesmo arquivo embaralharia duas fronteiras com
 * garantias de tipagem diferentes.
 *
 * **Estes handlers são o caminho feliz, e só ele.** Cada teste que precise de um desfecho
 * diferente (`409`, `429`, `500`) registra o seu próprio override com `server.use(...)`, que o
 * `afterEach` da lane derruba. Codificar os desfechos de erro aqui espalharia a intenção do teste
 * por dois arquivos.
 */
export const bffHandlers: RequestHandler[] = [
  http.post("/api/auth/register", async ({ request }) => {
    const { email } = (await request.json()) as RegisterBffRequest
    // `satisfies` em vez de anotação solta: `openapi-msw` não alcança as rotas
    // relativas do BFF (ausentes da spec do backend), então o corpo é escrito à
    // mão — mas amarrado ao contrato derivado, para o fake não sobreviver a uma
    // mudança de shape no `201`.
    return HttpResponse.json(
      {
        id: "00000000-0000-4000-8000-000000000000",
        email,
        channel: { nickname: "tester" },
      } satisfies RegisterBffResponse,
      { status: 201 },
    )
  }),

  http.post("/api/auth/resend-confirmation", () => new HttpResponse(null, { status: 204 })),
]
