import { describe, it, expect } from "vitest"

import { passthrough } from "@/lib/api/passthrough"

describe("passthrough", () => {
  it("returns the success body under the upstream status", async () => {
    const response = passthrough({
      data: { id: "1", email: "user@example.com" },
      response: new Response(null, { status: 201 }),
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ id: "1", email: "user@example.com" })
  })

  it("returns the error body under the upstream status when there is no data", async () => {
    const response = passthrough({
      error: { statusCode: 409, error: "EMAIL_JA_EXISTE", message: "E-mail já cadastrado" },
      response: new Response(null, { status: 409 }),
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      statusCode: 409,
      error: "EMAIL_JA_EXISTE",
      message: "E-mail já cadastrado",
    })
  })

  it("mirrors the upstream status exactly", async () => {
    const response = passthrough({
      error: { statusCode: 400, error: "VALIDATION_ERROR", message: "Dados inválidos" },
      response: new Response(null, { status: 400 }),
    })

    expect(response.status).toBe(400)
  })

  it("returns an empty body for a bodiless upstream response (204)", async () => {
    const response = passthrough({
      response: new Response(null, { status: 204 }),
    })

    expect(response.status).toBe(204)
    expect(await response.text()).toBe("")
  })
})
