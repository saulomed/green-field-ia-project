import { api } from "@/lib/api/client"
import { passthrough } from "@/lib/api/passthrough"
import type { RegisterBffRequest } from "@/lib/api/contracts"

/**
 * `POST /api/auth/register` — primeiro handler do BFF (`auth-frontend/TD-01`).
 * O `201` não emite cookie de sessão: não há auto-login (`auth/TD-09`) — o
 * login de conta não confirmada é rejeitado com `403 EMAIL_NAO_CONFIRMADO`.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as RegisterBffRequest
  const result = await api.POST("/auth/register", { body })
  return passthrough(result)
}
