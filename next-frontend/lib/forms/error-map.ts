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
const ERROR_FIELD_MAP = {
  EMAIL_JA_EXISTE: "email",
} as const satisfies Partial<Record<ErrorCode, string>>

/**
 * Campo do RHF que pode receber um erro do servidor: um dos nomes mapeados
 * acima, ou a sentinela de formulário. O union é **derivado** do próprio mapa,
 * então acrescentar uma entrada alarga o tipo automaticamente e os call sites
 * que só sabem tratar `email` param de compilar — em vez de aceitarem um campo
 * inexistente por trás de um cast.
 */
export type ServerErrorField =
  | (typeof ERROR_FIELD_MAP)[keyof typeof ERROR_FIELD_MAP]
  | typeof ROOT_SERVER_ERROR

/**
 * Resolve um `errorCode` do envelope para o campo do RHF que deve exibi-lo.
 * Código desconhecido (incluindo qualquer string fora do union `ErrorCode`,
 * como o `VALIDATION_ERROR` do `ValidationPipe`) cai em `root.serverError`.
 */
export function resolveErrorField(errorCode: string): ServerErrorField {
  return ERROR_FIELD_MAP[errorCode as keyof typeof ERROR_FIELD_MAP] ?? ROOT_SERVER_ERROR
}
