import createClient, { type Middleware } from "openapi-fetch"

import { config } from "@/lib/env"
import type { paths } from "@/lib/api/contracts"
import { parseUpstreamSetCookie } from "@/lib/api/cookies"

/**
 * Cliente HTTP tipado do BFF para o `nestjs-api` (`auth-frontend/TD-02`).
 * Exclusivo do lado servidor — nunca importado por `components/` ou `hooks/`,
 * que só falam com rotas relativas (`next-frontend-env-config/TD-04`).
 *
 * `fetch` é um wrapper que resolve `globalThis.fetch` **em tempo de chamada**,
 * não de criação: o parâmetro default do `createClient` (`baseFetch =
 * globalThis.fetch`) captura a referência no momento da criação do cliente —
 * que acontece na importação do módulo, antes de qualquer `server.listen()`
 * do MSW rodar em teste. Sem o wrapper, o cliente fica preso ao `fetch` real
 * e nenhum teste consegue interceptá-lo.
 *
 * O wrapper também desmonta o `Request` antes de repassá-lo (ver
 * `sendRequest`), sem o que nenhuma chamada com corpo sobrevive a um `401`
 * upstream.
 */
export const api = createClient<paths>({
  baseUrl: config.api.baseUrl,
  fetch: (request) => sendRequest(request),
})

/**
 * Envia um `Request` desmontando-o em `(url, init)` com o corpo materializado.
 *
 * O `fetch` instrumentado do Next não consegue reenviar um `Request` cujo
 * corpo é um stream: internamente ele reconstrói a requisição, e o corpo de um
 * `Request` chega ao undici como stream sem `source`, o que aborta o reenvio
 * com `TypeError: fetch failed` / `expected non-null body source`. O `401`
 * upstream é justamente o que dispara esse reenvio — por isso a falha atinge
 * apenas os caminhos de erro autenticados, e não os de sucesso.
 *
 * `openapi-fetch` sempre monta um `Request` antes de chamar este wrapper
 * (`coreFetch`), então a desmontagem precisa acontecer aqui.
 *
 * O corpo vira **string**, não `ArrayBuffer`: o reenvio transfere o buffer, e
 * a segunda tentativa o encontra destacado (`Cannot perform
 * ArrayBuffer.prototype.slice on a detached ArrayBuffer`). Uma string é imutável
 * e sobrevive a quantos reenvios forem necessários. Ler o corpo como texto é
 * seguro porque todo o contrato do `nestjs-api` é `application/json`
 * (`openapi-spec/TD-05`); um corpo binário exigiria outro caminho.
 */
async function sendRequest(request: Request): Promise<Response> {
  const hasBody = request.method !== "GET" && request.method !== "HEAD"

  return globalThis.fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: hasBody ? await request.text() : undefined,
    redirect: request.redirect,
    signal: request.signal,
  })
}

/**
 * Única chamada autenticada desta slice (`### Authorization Matrix`). Um
 * `401` fora desta lista é `CREDENCIAIS_INVALIDAS`/sessão nunca existiu, não
 * sessão expirada — os handlers anônimos nunca disparam renovação.
 */
const AUTHENTICATED_PATHS = new Set(["/users/me"])

/**
 * Guarda de *single-flight* (`auth-frontend/TD-04`): duas chamadas
 * concorrentes que recebem `401` compartilham a mesma promessa de renovação,
 * em vez de rotacionarem a mesma família de refresh token duas vezes e
 * dispararem `TOKEN_REUTILIZADO`.
 */
let inflightRefresh: Promise<Response | null> | null = null

/** Extrai o valor de um cookie nomeado a partir de uma lista de `Set-Cookie` cruos. */
function extractCookieValue(setCookieHeaders: string[], name: string): string | undefined {
  return setCookieHeaders
    .map(parseUpstreamSetCookie)
    .find((cookie) => cookie.name === name)?.value
}

/** Substitui (ou acrescenta) um cookie num header `Cookie` existente. */
function withUpdatedCookie(cookieHeader: string | null, name: string, value: string): string {
  const pairs = (cookieHeader ?? "")
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0 && !pair.startsWith(`${name}=`))
  pairs.push(`${name}=${value}`)
  return pairs.join("; ")
}

/**
 * Chama `POST /auth/refresh` repassando o `Cookie` header da chamada
 * original (que carrega o `refresh_token`). Devolve a `Response` upstream em
 * caso de sucesso, ou `null` — nunca lança, para o chamador decidir o que
 * fazer com a falha (propagar o `401` original).
 */
async function refreshSession(cookieHeader: string | null): Promise<Response | null> {
  if (!cookieHeader) return null

  const response = await globalThis.fetch(`${config.api.baseUrl}/auth/refresh`, {
    method: "POST",
    headers: { cookie: cookieHeader },
  })

  return response.ok ? response : null
}

/**
 * Renovação reativa (`auth-frontend/TD-04`): no `401` upstream de uma chamada
 * autenticada, renova uma única vez (deduplicado) e repete a chamada
 * original com o novo `access_token`. **Retry único** — a repetição contorna
 * este middleware (via `fetch` puro), então um segundo `401` nela propaga em
 * vez de acionar nova renovação.
 *
 * Opera só sobre `Request`/`Response` — nunca `next/headers` — para que o
 * middleware permaneça testável exatamente como qualquer outro código que
 * atravessa o `fetch`, sem exigir um contexto de requisição real do Next.
 * As novas `Set-Cookie` do refresh são anexadas à resposta final devolvida
 * por `api.GET(...)`; quem chama (o route handler autenticado) é responsável
 * por reemiti-las na sua própria `NextResponse`, do mesmo jeito que os
 * outros handlers já fazem.
 */
const refreshOnUnauthorized: Middleware = {
  async onResponse({ request, response }) {
    if (response.status !== 401) {
      return undefined
    }
    const { pathname } = new URL(request.url)
    if (!AUTHENTICATED_PATHS.has(pathname)) {
      return undefined
    }

    const requestCookieHeader = request.headers.get("cookie")
    inflightRefresh ??= refreshSession(requestCookieHeader).finally(() => {
      inflightRefresh = null
    })
    const refreshResponse = await inflightRefresh

    if (!refreshResponse) {
      return undefined
    }

    const setCookieHeaders = refreshResponse.headers.getSetCookie()
    const newAccessToken = extractCookieValue(setCookieHeaders, "access_token")

    const retryHeaders = new Headers(request.headers)
    if (newAccessToken) {
      retryHeaders.set("cookie", withUpdatedCookie(requestCookieHeader, "access_token", newAccessToken))
    }

    const retryResponse = await sendRequest(new Request(request, { headers: retryHeaders }))

    const mergedHeaders = new Headers(retryResponse.headers)
    for (const setCookie of setCookieHeaders) {
      mergedHeaders.append("set-cookie", setCookie)
    }

    return new Response(retryResponse.body, {
      status: retryResponse.status,
      statusText: retryResponse.statusText,
      headers: mergedHeaders,
    })
  },
}

api.use(refreshOnUnauthorized)
