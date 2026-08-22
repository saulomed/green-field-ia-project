/**
 * Contrato tipado das rotas `/api/...` do BFF.
 *
 * Decisão: next-frontend-api-typing/TD-02 (Option B). Cada rota do BFF declara aqui o seu
 * contrato **derivando** dos tipos gerados em `lib/api/schema.d.ts`, nunca redigitando campos.
 * Remover um campo de um DTO no backend deve quebrar a derivação em build — essa é a rede de
 * segurança escolhida por `openapi-spec/TD-05`, e é o motivo de não haver validação de runtime
 * na fronteira (`next-frontend-api-typing/TD-03`).
 *
 * Regras de uso:
 * - `components/` e `hooks/` importam **apenas** deste módulo; nunca de `lib/api/schema`.
 * - `lib/api/schema.d.ts` é artefato gerado por `scripts/generate-api-types.sh` e nunca é
 *   editado à mão.
 * - Cada rota nova registra seu contrato aqui no mesmo commit em que o route handler nasce.
 *
 * O acessor upstream é o canônico do `openapi-typescript`:
 * `paths[<rota>][<método>]["responses"][<status>]["content"]["application/json"]`.
 */

import type { components, paths } from "@/lib/api/schema"

/**
 * Reexportação do mapa de rotas gerado (next-frontend-msw-base/TD-03).
 *
 * `mocks/` precisa de `paths` para tipar os handlers do MSW, mas a regra de
 * `next-frontend-api-typing/TD-02` confina `lib/api/schema` a `lib/api/`. Reexportar aqui mantém
 * `contracts.ts` como porta única do tipo gerado, sem abrir exceção de importação para `mocks/`.
 *
 * Esta é a única reexportação direta do schema — todo o resto deste módulo continua **derivando**
 * por `Pick`/`Omit`/`Extract`/`Exclude`, nunca reexpondo tipos gerados crus.
 */
export type { paths }

/**
 * Código de domínio do envelope de erro (`http-error-contract/TD-03`) — enum
 * nomeado na spec, gerado aqui como union de string literals pelo
 * `openapi-typescript`. Reexportado pelo mesmo motivo de `paths` acima.
 */
export type ErrorCode = components["schemas"]["ErrorCode"]

/* -------------------------------------------------------------------------- */
/* POST /api/auth/login  →  POST /auth/login                                    */
/* -------------------------------------------------------------------------- */

/** Fronteira NestJS↔BFF — a operação upstream inteira, como declarada na spec. */
type LoginUpstreamOperation = paths["/auth/login"]["post"]

type LoginUpstreamRequest = LoginUpstreamOperation["requestBody"]["content"]["application/json"]

type LoginUpstreamResponse =
  LoginUpstreamOperation["responses"][200]["content"]["application/json"]

/**
 * Fronteira BFF↔componente — derivada, nunca redigitada.
 *
 * O BFF repassa o corpo upstream integralmente: nenhum campo desta resposta é sensível (os
 * tokens trafegam em cookies, não no corpo), então não há o que omitir. Ainda assim o recorte é
 * declarado por `Pick` em vez de um alias direto: as chaves são verificadas contra o schema
 * gerado, de modo que remover um campo do DTO no backend quebra o build **aqui**, apontando a
 * derivação afetada, em vez de virar `undefined` silencioso num componente. Quando uma rota
 * precisar expor menos do que recebe, basta encurtar esta lista — nunca escrever um tipo novo
 * à mão.
 */
export type LoginBffResponse = Pick<LoginUpstreamResponse, "id" | "email" | "channel">

/** Corpo que o componente envia ao BFF — idêntico ao que o BFF envia ao `nestjs-api`. */
export type LoginBffRequest = LoginUpstreamRequest

/**
 * Status de erro que esta rota pode devolver, derivados por exclusão do status de sucesso.
 * A lista não é redigitada: ela é o que a spec declarar menos o caminho feliz, então um novo
 * status de erro no backend aparece aqui automaticamente.
 */
export type LoginBffErrorStatus = Exclude<keyof LoginUpstreamOperation["responses"], 200>

/** Corpo de erro da rota, no formato padronizado do backend. */
export type LoginBffErrorResponse =
  LoginUpstreamOperation["responses"][LoginBffErrorStatus]["content"]["application/json"]

/* -------------------------------------------------------------------------- */
/* POST /api/auth/register  →  POST /auth/register                             */
/* -------------------------------------------------------------------------- */

type RegisterUpstreamOperation = paths["/auth/register"]["post"]

type RegisterUpstreamRequest =
  RegisterUpstreamOperation["requestBody"]["content"]["application/json"]

type RegisterUpstreamResponse =
  RegisterUpstreamOperation["responses"][201]["content"]["application/json"]

/** O `201` não emite cookie de sessão — não há campo sensível a omitir. */
export type RegisterBffResponse = Pick<RegisterUpstreamResponse, "id" | "email" | "channel">

/** Corpo que o componente envia ao BFF — idêntico ao que o BFF envia ao `nestjs-api`. */
export type RegisterBffRequest = RegisterUpstreamRequest

export type RegisterBffErrorStatus = Exclude<keyof RegisterUpstreamOperation["responses"], 201>

export type RegisterBffErrorResponse =
  RegisterUpstreamOperation["responses"][RegisterBffErrorStatus]["content"]["application/json"]

/* -------------------------------------------------------------------------- */
/* POST /api/auth/forgot-password  →  POST /auth/forgot-password               */
/* -------------------------------------------------------------------------- */

type ForgotPasswordUpstreamOperation = paths["/auth/forgot-password"]["post"]

/** Corpo que o componente envia ao BFF — idêntico ao que o BFF envia ao `nestjs-api`. */
export type ForgotPasswordBffRequest =
  ForgotPasswordUpstreamOperation["requestBody"]["content"]["application/json"]

/** `204` não tem corpo — só os status de erro carregam envelope. */
export type ForgotPasswordBffErrorStatus = Exclude<
  keyof ForgotPasswordUpstreamOperation["responses"],
  204
>

export type ForgotPasswordBffErrorResponse =
  ForgotPasswordUpstreamOperation["responses"][ForgotPasswordBffErrorStatus]["content"]["application/json"]

/* -------------------------------------------------------------------------- */
/* POST /api/auth/resend-confirmation  →  POST /auth/resend-confirmation       */
/* -------------------------------------------------------------------------- */

type ResendConfirmationUpstreamOperation = paths["/auth/resend-confirmation"]["post"]

export type ResendConfirmationBffRequest =
  ResendConfirmationUpstreamOperation["requestBody"]["content"]["application/json"]

/* -------------------------------------------------------------------------- */
/* GET /api/users/me  →  GET /users/me                                         */
/* -------------------------------------------------------------------------- */

type UsersMeUpstreamOperation = paths["/users/me"]["get"]

export type UsersMeBffResponse =
  UsersMeUpstreamOperation["responses"][200]["content"]["application/json"]
