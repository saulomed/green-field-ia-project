import { loadEnvConfig } from "@next/env"
import { defineConfig, devices } from "@playwright/test"

// Ao contrário de `vitest.config.mts` (`.mts`, ESM nativo — o lexer de detecção de named export
// de CJS falha ali para `@next/env`), este arquivo é compilado para CJS pelo próprio carregador
// do Playwright, então o named import de cima resolve direto para `require("@next/env").loadEnvConfig`.

// Carrega a cascata de env do Next (`.env` → defaults) antes do `defineConfig`, para que
// `MAILPIT_URL`/`API_BASE_URL` cheguem ao processo `npm run build && npm run start` disparado
// pelo `webServer` abaixo (que herda o `process.env` deste processo).
loadEnvConfig(process.cwd())

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e-spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Playwright dirige o build de produção, nunca o dev server — o dev server acrescenta
  // overlays e timings que divergem do que o usuário realmente vê (next-frontend/CLAUDE.md).
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
