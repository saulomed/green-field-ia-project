import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { readSessionCookie } from "@/lib/api/cookies"

/**
 * Fronteira de guarda de sessão (`auth-frontend/TD-05`, Option A): verificação
 * **otimista** por presença de cookie — barata e cobre prefetch. A autorização
 * real permanece no backend, que já responde `401` corretamente; este proxy só
 * decide se redireciona, nunca se autoriza.
 *
 * Nenhuma rota desta slice entra no `matcher` — `/signup`, `/login` e
 * `/forgot-password` são públicas por natureza (`### Authorization Matrix`).
 * O mecanismo fica pronto para a Fase 04 aplicá-lo sobre superfície protegida.
 */
export function proxy(request: NextRequest) {
  const hasSession = readSessionCookie(request, "access_token") !== undefined

  if (!hasSession) {
    // Nenhuma rota protegida nesta fase — mantido apenas para deixar o
    // mecanismo materializado. Sem efeito prático até o `matcher` ganhar rotas.
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [],
}
