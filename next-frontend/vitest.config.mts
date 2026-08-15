import nextEnv from "@next/env"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// `@next/env` é CommonJS e o lexer do Node não detecta `loadEnvConfig` como named export quando
// este arquivo é carregado como ESM (extensão `.mts`). O import default entrega `module.exports`.
const { loadEnvConfig } = nextEnv

/**
 * Carrega a cascata de env do próprio Next (`.env.test` → `.env`), per
 * `next-frontend-env-config/TD-05`. Roda **no topo do módulo**, antes do `defineConfig`: a
 * validação de `lib/env.ts` acontece na avaliação do módulo, então `process.env` precisa já estar
 * populado quando o primeiro teste importar `@/lib/env`.
 */
loadEnvConfig(process.cwd())

export default defineConfig({
  // Herdado pelos dois projetos via `extends: true`.
  plugins: [react()],
  // Resolve o alias `@/*` a partir do `tsconfig.json`, dispensando duplicá-lo aqui. O guia oficial
  // de Vitest do Next.js pede o plugin `vite-tsconfig-paths` para isso; o Vite 8 passou a suportar
  // nativamente e avisa quando o plugin está presente, então usamos a opção nativa.
  resolve: { tsconfigPaths: true },
  test: {
    /**
     * Um projeto por lane de execução (next-frontend-msw-base/TD-01).
     *
     * `environmentMatchGlobs` foi removido no Vitest 4; `test.projects` é o substituto. A
     * separação não é cosmética: `@/lib/env` decide server vs client por
     * `typeof window === "undefined"` e lança sob um ambiente de DOM, então route handlers e
     * utilitários de `lib/` **precisam** rodar em `node`.
     */
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["app/api/**/__tests__/**/*.test.ts", "lib/**/__tests__/**/*.test.ts"],
          setupFiles: ["./vitest.setup.node.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          environmentOptions: {
            // O default do jsdom é 3000, que neste projeto é a porta do `nestjs-api`. Os
            // handlers de caminho relativo resolvem contra este `location`, então ele precisa
            // ser a origem real da app (next-frontend-msw-base/TD-02).
            jsdom: { url: "http://localhost:3001" },
          },
          include: [
            "components/**/__tests__/**/*.test.{ts,tsx}",
            "hooks/**/__tests__/**/*.test.{ts,tsx}",
          ],
          setupFiles: ["./vitest.setup.dom.ts"],
        },
      },
    ],
  },
})
