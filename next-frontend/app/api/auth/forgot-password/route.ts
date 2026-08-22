import { api } from "@/lib/api/client"
import { passthrough } from "@/lib/api/passthrough"
import type { ForgotPasswordBffRequest } from "@/lib/api/contracts"

/**
 * `POST /api/auth/forgot-password` — repasse simples. O upstream responde
 * `204` mesmo quando o e-mail não existe (por design, não revela a
 * existência da conta) — `passthrough` devolve o `204` sem corpo.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as ForgotPasswordBffRequest
  const result = await api.POST("/auth/forgot-password", { body })
  return passthrough(result)
}
