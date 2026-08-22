import { NextResponse } from "next/server"

/**
 * Repasse verbatim do envelope upstream (`auth-frontend/TD-01`, `TD-11`
 * Option A): o corpo de sucesso ou de erro do `nestjs-api`, sob o mesmo
 * status, sem reescrita. Compartilhado por todo route handler do BFF.
 */
export function passthrough<TData, TError>({
  data,
  error,
  response,
}: {
  data?: TData
  error?: TError
  response: Response
}): NextResponse {
  const body = data ?? error

  // Respostas sem corpo (`204`, ou qualquer status cujo envelope veio vazio)
  // não são serializáveis por `NextResponse.json(undefined)`.
  if (body === undefined) {
    return new NextResponse(null, { status: response.status })
  }

  return NextResponse.json(body, { status: response.status })
}
