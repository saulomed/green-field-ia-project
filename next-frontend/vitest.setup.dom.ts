import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll } from "vitest"

import { bffHandlers } from "./mocks/bff-handlers"
import { server } from "./mocks/server"

/**
 * Setup da lane de DOM (next-frontend-msw-base/TD-01 + TD-02).
 *
 * Registra **apenas** `mocks/bff-handlers.ts` — as rotas relativas `/api/...`, que resolvem contra
 * o `location` fixado em `http://localhost:3001` pelo `environmentOptions.jsdom.url`.
 *
 * A TD-04 manda cada lane montar o `setupServer` com "o conjunto pertinente". Para esta lane, o
 * conjunto pertinente é só o do BFF — e isso não é preferência, é restrição:
 *
 * - Impossível — `mocks/handlers.ts` importa `@/lib/env` para ler `config.api.baseUrl`, e
 *   `@t3-oss/env-core` decide server vs client por `typeof window === "undefined"`. Sob `jsdom` a
 *   guarda dispara e a importação lança na avaliação do módulo (`next-frontend-env-config/TD-01`).
 * - Desnecessário — per `next-frontend-env-config/TD-04`, código de browser só chama rotas
 *   relativas, nunca o `nestjs-api`. Handlers de upstream nesta lane seriam peso morto.
 */
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" })
  // Promove a lista a inicial, e não a override de runtime — ver o comentário equivalente em
  // `vitest.setup.node.ts`.
  server.resetHandlers(...bffHandlers)
})

afterEach(() => {
  // A Testing Library só desmonta sozinha com `globals: true`; aqui os imports são explícitos,
  // então o unmount também é.
  cleanup()
  server.resetHandlers(...bffHandlers)
})

afterAll(() => server.close())

/**
 * `jsdom` não implementa `ResizeObserver`, e os primitives do Radix medem os seus nós com ele
 * (`@radix-ui/react-use-size`) — sem o stub, renderizar um `<Checkbox>` lança na fase de layout
 * effects. É um buraco do ambiente, não uma dependência de teste: o stub existe só para o
 * observer não ser `undefined`; nada nesta lane depende das medidas que ele reportaria.
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
