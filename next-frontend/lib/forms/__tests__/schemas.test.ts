import { describe, it, expect } from "vitest"

import { signupSchema } from "@/lib/forms/signup-schema"
import { loginSchema } from "@/lib/forms/login-schema"
import { forgotPasswordSchema } from "@/lib/forms/forgot-password-schema"

describe("signupSchema", () => {
  const valid = {
    email: "user@example.com",
    password: "super-secret-1",
    confirmPassword: "super-secret-1",
  }

  it("accepts a valid body", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true)
  })

  it("rejects a password shorter than 8 characters", () => {
    const result = signupSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" })
    expect(result.success).toBe(false)
  })

  it("rejects a malformed e-mail", () => {
    const result = signupSchema.safeParse({ ...valid, email: "not-an-email" })
    expect(result.success).toBe(false)
  })

  it("rejects a missing field", () => {
    const { password: _password, ...withoutPassword } = valid
    const result = signupSchema.safeParse(withoutPassword)
    expect(result.success).toBe(false)
  })

  it("rejects when confirmPassword does not match password (client-only rule)", () => {
    const result = signupSchema.safeParse({ ...valid, confirmPassword: "different" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("confirmPassword"))).toBe(
        true,
      )
    }
  })
})

describe("loginSchema", () => {
  const valid = { email: "user@example.com", password: "super-secret-1" }

  it("accepts a valid body", () => {
    expect(loginSchema.safeParse(valid).success).toBe(true)
  })

  it("rejects a password shorter than 8 characters", () => {
    expect(loginSchema.safeParse({ ...valid, password: "short" }).success).toBe(false)
  })

  it("rejects a malformed e-mail", () => {
    expect(loginSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false)
  })

  it("rejects a missing field", () => {
    expect(loginSchema.safeParse({ email: valid.email }).success).toBe(false)
  })
})

describe("forgotPasswordSchema", () => {
  it("accepts a valid body", () => {
    expect(forgotPasswordSchema.safeParse({ email: "user@example.com" }).success).toBe(true)
  })

  it("rejects a malformed e-mail", () => {
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false)
  })

  it("rejects a missing field", () => {
    expect(forgotPasswordSchema.safeParse({}).success).toBe(false)
  })
})
