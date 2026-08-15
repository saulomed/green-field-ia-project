import { afterAll, afterEach, beforeAll } from "vitest"

import { handlers } from "./mocks/handlers"
import { server } from "./mocks/server"

/**
 * Setup da lane de `node` (next-frontend-msw-base/TD-01).
 *
 * Registra apenas os handlers do **upstream** (`mocks/handlers.ts`): esta é a lane dos route
 * handlers do BFF e dos utilitários de `lib/`, e a fronteira que eles atravessam é o `nestjs-api`.
 * As rotas relativas do BFF (`mocks/bff-handlers.ts`) não entram aqui — em Node puro não existe
 * `location` contra o qual resolvê-las.
 *
 * `onUnhandledRequest: "error"` é o trilho que torna absoluta a regra do `next-frontend/CLAUDE.md`
 * de que nenhum teste Vitest abre conexão real com o `nestjs-api` — uma request não declarada
 * falha o teste em vez de vazar para a rede.
 */
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" })
  // `mocks/server.ts` nasce sem handlers de propósito (TD-04) — a composição é por lane. Passar a
  // lista aqui a promove a **lista inicial**, e não a override de runtime: sem isso, o primeiro
  // teste de cada arquivo rodaria antes do primeiro `afterEach` e não teria handler nenhum.
  server.resetHandlers(...handlers)
})

/**
 * Remove os handlers de runtime adicionados por `server.use()` dentro de um teste, restaurando
 * esta lista como base. Pular esta chamada vaza override entre testes.
 */
afterEach(() => server.resetHandlers(...handlers))

afterAll(() => server.close())
