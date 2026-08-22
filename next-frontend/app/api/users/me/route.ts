import { api } from "@/lib/api/client"
import { passthrough } from "@/lib/api/passthrough"
import { reissueSessionCookies } from "@/lib/api/cookies"

/**
 * `GET /api/users/me` — única chamada autenticada da slice, e o único ponto
 * que exercita a renovação de `auth-frontend/TD-04` de ponta a ponta. Repassa
 * o `Cookie` recebido do browser para o cliente tipado, cujo middleware de
 * renovação (`lib/api/client.ts`) já cuida do `401` reativo.
 *
 * Quando a renovação roda, a resposta upstream carrega o novo par de
 * `Set-Cookie` (anexado pelo middleware) — reemite-os aqui com os atributos
 * do BFF, do mesmo jeito que os outros handlers que emitem cookie.
 */
export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie")
  const result = await api.GET("/users/me", {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  })
  const response = passthrough(result)

  reissueSessionCookies(response.cookies, result.response.headers.getSetCookie())

  return response
}
