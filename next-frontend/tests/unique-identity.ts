import { randomUUID } from "node:crypto"

/**
 * Gera um e-mail único por execução (timestamp + UUID) para suítes
 * `*.e2e-spec.ts` que criam conta (`auth-frontend/TD-10`, Option A).
 *
 * **Nenhum reset de estado entre execuções** — sem truncate, sem drop, sem
 * migração. Os fluxos desta fase são todos de criação (cadastrar, autenticar
 * o usuário recém-criado, confirmar, redefinir senha): nenhum depende de
 * estado que o próprio teste não possa produzir.
 *
 * **Gatilho de reavaliação (fixado na TD):** quando houver pipeline de CI, ou
 * quando surgir um teste que dependa de estado pré-existente no banco,
 * migrar para a Option C (database dedicado com perfil `e2e` no Compose).
 */
export function uniqueTestEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${randomUUID()}@example.test`
}
