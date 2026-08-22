import { api } from "@/lib/api/client"
import { passthrough } from "@/lib/api/passthrough"
import { reissueSessionCookies, clearAuthCookies } from "@/lib/api/cookies"

/**
 * `POST /api/auth/refresh` — chamado pelo próprio BFF (`auth-frontend/TD-04`),
 * nunca pelo browser. Encaminha o cookie de refresh ao upstream; no `200`
 * reemite o novo par de cookies; no `401` (`SESSAO_INVALIDA` ou
 * `TOKEN_REUTILIZADO`) limpa os cookies de sessão e propaga o status.
 */
export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie")
  const result = await api.POST("/auth/refresh", {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  })
  const response = passthrough(result)

  if (result.response.status === 200) {
    reissueSessionCookies(response.cookies, result.response.headers.getSetCookie())
  } else if (result.response.status === 401) {
    clearAuthCookies(response.cookies, ["access_token", "refresh_token"])
  }

  return response
}
