import { api } from "@/lib/api/client"
import { passthrough } from "@/lib/api/passthrough"
import type { ResendConfirmationBffRequest } from "@/lib/api/contracts"

/**
 * `POST /api/auth/resend-confirmation` — consumido pelo `ResendConfirmationButton`
 * do painel de sucesso de `/signup`. O `429` precisa chegar distinguível
 * (por status) para a tela exibir cooldown.
 *
 * **Nota de contrato:** o `nestjs-project` real (`resendConfirmation` em
 * `auth.service.ts`) nunca lança `EMAIL_JA_CONFIRMADO` — o `409` documentado
 * no plano pertence ao endpoint `confirm` (diferido nesta fase). O reenvio
 * é um no-op silencioso para conta inexistente ou já confirmada, sempre
 * `204`, por design de não revelar o estado da conta.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as ResendConfirmationBffRequest
  const result = await api.POST("/auth/resend-confirmation", { body })
  return passthrough(result)
}
