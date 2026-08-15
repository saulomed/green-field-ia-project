import type { RequestHandler } from "msw"

/**
 * Fake das rotas relativas `/api/...` do próprio Next — a superfície que a lane de browser
 * intercepta (next-frontend-msw-base/TD-04).
 *
 * Mantido separado de `./handlers` de propósito: aquele fala com o `nestjs-api` e é tipado pela
 * spec OpenAPI (TD-03); estas rotas são do BFF, não existem na spec do backend e resolvem contra
 * o `location` do documento. Misturar as duas no mesmo arquivo embaralharia duas fronteiras com
 * garantias de tipagem diferentes.
 *
 * **Nasce vazio por escopo, não por esquecimento.** Nenhum route handler existe em `app/api/`
 * ainda, então não há rota relativa a fingir — a exclusão está registrada em `validation.md`
 * (AMB-2) da task `next-frontend-msw-base`. A task que criar o primeiro route handler do BFF é
 * dona do primeiro handler aqui e do primeiro teste de integração que o exercite.
 */
export const bffHandlers: RequestHandler[] = []
