import { api } from "@/lib/api/client"
import { passthrough } from "@/lib/api/passthrough"
import { reissueSessionCookies } from "@/lib/api/cookies"
import type { LoginBffRequest } from "@/lib/api/contracts"

/**
 * `POST /api/auth/login` — único handler anônimo que recebe `Set-Cookie`
 * upstream. Reemite o par de cookies de sessão com atributos do BFF
 * (`auth-frontend/TD-03`) só no `200`; os demais status são repassados
 * verbatim, sem cookie.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as LoginBffRequest
  const result = await api.POST("/auth/login", { body })
  const response = passthrough(result)

  if (result.response.status === 200) {
    reissueSessionCookies(response.cookies, result.response.headers.getSetCookie())
  }

  return response
}
