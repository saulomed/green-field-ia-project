import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Contrato de teste devido pela task `next-frontend-env-config` (SI-3 e SI-4), materializado aqui
 * per `next-frontend-msw-base` (AMB-1). Prova por execução as ACs que aquela task fechou sem
 * runner: a validação de ambiente acontece **na importação** do módulo, e `config` é a única
 * superfície pública.
 *
 * Roda obrigatoriamente sob `environment: "node"` (projeto `node` de `vitest.config.mts`):
 * `@t3-oss/env-core` decide server vs client por `typeof window === "undefined"`, e sob um
 * ambiente de DOM a simples importação de `@/lib/env` lança, porque `config` dereferencia
 * `env.API_BASE_URL` na avaliação do módulo.
 */

/**
 * `ProcessEnv` declara `NODE_ENV` como readonly, então atribuir direto não compila. O cast local é
 * a saída registrada pela `next-frontend-env-config` para manipular o ambiente por caso.
 */
const testEnv = () => process.env as Record<string, string | undefined>

/** Valor que `.env.test` publica — carregado por `loadEnvConfig` em `vitest.config.mts`. */
const VALID_BASE_URL = "http://nestjs-api.test:3000"

let snapshot: string | undefined

beforeEach(() => {
  // Sem isto o módulo fica em cache e a validação não roda de novo — cada caso precisa de uma
  // importação nova para exercer a validação-no-import.
  vi.resetModules()
  snapshot = testEnv().API_BASE_URL
})

afterEach(() => {
  vi.restoreAllMocks()
  if (snapshot === undefined) {
    delete testEnv().API_BASE_URL
  } else {
    testEnv().API_BASE_URL = snapshot
  }
})

describe("lib/env — validação no momento da importação", () => {
  it("expõe config.api.baseUrl com o valor validado quando o ambiente é válido", async () => {
    // Deliberadamente **não** injeta a variável: este caso consome o que `loadEnvConfig` carregou
    // de `.env.test` (next-frontend-env-config/TD-05). É o único caso acoplado à cascata, e é o
    // que faz a suíte quebrar se `.env.test` perder a chave — os demais injetam o próprio valor
    // para permanecerem determinísticos.
    const { config } = await import("../env")

    expect(config.api.baseUrl).toBe(VALID_BASE_URL)
  })

  it("rejeita a importação quando API_BASE_URL está ausente, nomeando a variável", async () => {
    delete testEnv().API_BASE_URL
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(import("../env")).rejects.toThrow("Invalid environment variables")

    // A mensagem lançada por `@t3-oss/env-core` é genérica; quem nomeia a variável é o payload de
    // issues enviado ao `console.error`. É lá que a AC "nomeia a variável" se verifica.
    expect(errorSpy).toHaveBeenCalled()
    expect(JSON.stringify(errorSpy.mock.calls)).toContain("API_BASE_URL")
  })

  it("rejeita a importação quando API_BASE_URL não é uma URL", async () => {
    testEnv().API_BASE_URL = "nao-e-uma-url"
    vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(import("../env")).rejects.toThrow("Invalid environment variables")
  })

  it("rejeita a importação quando API_BASE_URL é string vazia (emptyStringAsUndefined)", async () => {
    testEnv().API_BASE_URL = ""
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(import("../env")).rejects.toThrow("Invalid environment variables")

    // A prova de que `emptyStringAsUndefined: true` está ativo: a string vazia é tratada como
    // ausente, não como "URL malformada". Sem a opção, o erro seria de formato, não de campo
    // obrigatório faltando.
    expect(JSON.stringify(errorSpy.mock.calls)).toContain("API_BASE_URL")
  })
})

describe("lib/env — superfície pública do export config", () => {
  it("reflete o valor efetivamente validado por createEnv, não uma constante do módulo", async () => {
    const injected = "http://outro-host.test:9999"
    testEnv().API_BASE_URL = injected

    const { config } = await import("../env")

    expect(config.api.baseUrl).toBe(injected)
    expect(config.api.baseUrl).not.toBe(VALID_BASE_URL)
  })

  it("recusa em build a reatribuição de config.api.baseUrl (regressão do as const)", async () => {
    testEnv().API_BASE_URL = VALID_BASE_URL

    const { config } = await import("../env")

    // Esta AC é de **tipo**, não de runtime: `as const` não congela o objeto, então a atribuição
    // abaixo funcionaria se executada. Ela vive dentro de uma função nunca chamada para não
    // poluir os demais casos. Quem prova a AC é `npx tsc --noEmit`: o `@ts-expect-error` falha o
    // type-check se o erro esperado deixar de ocorrer — ou seja, se alguém remover o `as const`.
    const wouldNotTypeCheck = () => {
      // @ts-expect-error — `config.api.baseUrl` é readonly por conta do `as const`
      config.api.baseUrl = "http://mudou.test"
    }

    expect(wouldNotTypeCheck).toBeInstanceOf(Function)
    expect(config.api.baseUrl).toBe(VALID_BASE_URL)
  })
})
