import { describe, it, expect } from "vitest"

import { resolveErrorField, ROOT_SERVER_ERROR } from "@/lib/forms/error-map"

describe("resolveErrorField", () => {
  it("resolves EMAIL_JA_EXISTE to the email field", () => {
    expect(resolveErrorField("EMAIL_JA_EXISTE")).toBe("email")
  })

  it.each([
    "EMAIL_JA_CONFIRMADO",
    "EMAIL_NAO_CONFIRMADO",
    "CREDENCIAIS_INVALIDAS",
    "SESSAO_INVALIDA",
    "TOKEN_REUTILIZADO",
    "TOKEN_INVALIDO",
    "LIMITE_EXCEDIDO",
    "USUARIO_NAO_ENCONTRADO",
    "VALIDATION_ERROR",
    "INTERNAL_SERVER_ERROR",
  ])("resolves %s to root.serverError", (code) => {
    expect(resolveErrorField(code)).toBe(ROOT_SERVER_ERROR)
  })

  it("resolves an unknown code to root.serverError", () => {
    expect(resolveErrorField("CODIGO_INEXISTENTE")).toBe(ROOT_SERVER_ERROR)
  })
})
