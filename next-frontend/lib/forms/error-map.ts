import type { ErrorCode } from "@/lib/api/contracts"

/** Sentinela para "erro em nível de formulário" — nunca um campo real do RHF. */
export const ROOT_SERVER_ERROR = "root.serverError" as const

/**
 * Tabela única código de domínio → campo do React Hook Form
 * (`auth-frontend/TD-11`, consequência (ii)) — não replicada por formulário.
 *
 * Só `EMAIL_JA_EXISTE` tem granularidade por campo em toda a slice (§Error
 * Catalog → UX mapping das três telas); todo o resto — incluindo o `400` do
 * `ValidationPipe` e `INTERNAL_SERVER_ERROR` — vai para `root.serverError`.
 */
const ERROR_FIELD_MAP: Partial<Record<ErrorCode, string>> = {
  EMAIL_JA_EXISTE: "email",
}

/**
 * Resolve um `errorCode` do envelope para o campo do RHF que deve exibi-lo.
 * Código desconhecido (incluindo qualquer string fora do union `ErrorCode`,
 * como o `VALIDATION_ERROR` do `ValidationPipe`) cai em `root.serverError`.
 */
export function resolveErrorField(errorCode: string): string {
  return ERROR_FIELD_MAP[errorCode as ErrorCode] ?? ROOT_SERVER_ERROR
}
