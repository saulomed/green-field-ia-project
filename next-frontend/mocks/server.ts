import { setupServer } from "msw/node"

/**
 * Servidor de interceptação compartilhado pelas duas lanes de teste.
 *
 * Nasce **sem handlers iniciais** de propósito (next-frontend-msw-base/TD-04): quais handlers
 * valem depende da lane, e essa composição é feita nos `setupFiles` de cada projeto do Vitest
 * (`vitest.setup.node.ts` e `vitest.setup.dom.ts`, per TD-01). Registrar handlers aqui daria a
 * toda lane a mesma superfície de fake, que é exatamente o que a TD-04 recusou.
 *
 * O ciclo de vida (`listen` / `resetHandlers` / `close`) também vive nos `setupFiles`, não aqui —
 * este módulo expõe apenas a instância.
 */
export const server = setupServer()
