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

import type { paths } from "@/lib/api/schema"

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
