import { describe, it, expect } from "vitest"
import { NextRequest, NextResponse } from "next/server"

import { reissueSessionCookie, clearAuthCookies, readSessionCookie } from "@/lib/api/cookies"

describe("reissueSessionCookie", () => {
  it("preserves name, value and Max-Age from the upstream Set-Cookie", () => {
    const response = NextResponse.json({})
    reissueSessionCookie(response.cookies, "access_token=abc123; Max-Age=900; Path=/auth; HttpOnly")

    const cookie = response.cookies.get("access_token")
    expect(cookie?.value).toBe("abc123")
    expect(cookie?.maxAge).toBe(900)
  })

  it("replaces path with the BFF's own path, defaulting to /", () => {
    const response = NextResponse.json({})
    reissueSessionCookie(response.cookies, "refresh_token=xyz; Max-Age=604800; Path=/auth")

    const cookie = response.cookies.get("refresh_token")
    expect(cookie?.path).toBe("/")
  })

  it("accepts an explicit BFF path override", () => {
    const response = NextResponse.json({})
    reissueSessionCookie(response.cookies, "refresh_token=xyz; Max-Age=604800; Path=/auth", {
      path: "/api/auth",
    })

    const cookie = response.cookies.get("refresh_token")
    expect(cookie?.path).toBe("/api/auth")
  })

  it("always sets HttpOnly, Secure and SameSite=Strict, even without a Secure attribute upstream", () => {
    const response = NextResponse.json({})
    reissueSessionCookie(response.cookies, "access_token=abc123; Max-Age=900")

    const cookie = response.cookies.get("access_token")
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.secure).toBe(true)
    expect(cookie?.sameSite).toBe("strict")
  })

  it("omits Max-Age when the upstream cookie has none", () => {
    const response = NextResponse.json({})
    reissueSessionCookie(response.cookies, "access_token=abc123; Path=/auth")

    const cookie = response.cookies.get("access_token")
    expect(cookie?.maxAge).toBeUndefined()
  })
})

describe("clearAuthCookies", () => {
  it("expires every named cookie on the response", () => {
    const response = NextResponse.json({})
    reissueSessionCookie(response.cookies, "access_token=abc123; Max-Age=900")
    reissueSessionCookie(response.cookies, "refresh_token=xyz; Max-Age=604800")

    clearAuthCookies(response.cookies, ["access_token", "refresh_token"])

    // Clearing a cookie means re-sending it with an empty value and a past
    // expiry — a Set-Cookie response cannot "unset" a cookie outright.
    expect(response.cookies.get("access_token")).toMatchObject({ value: "" })
    expect(response.cookies.get("access_token")?.expires).toEqual(new Date(0))
    expect(response.cookies.get("refresh_token")).toMatchObject({ value: "" })
  })
})

describe("readSessionCookie", () => {
  it("reads a cookie by name from the incoming request", () => {
    const request = new NextRequest("http://localhost:3001/api/users/me", {
      headers: { cookie: "access_token=abc123" },
    })

    expect(readSessionCookie(request, "access_token")).toBe("abc123")
  })

  it("returns undefined when the cookie is absent", () => {
    const request = new NextRequest("http://localhost:3001/api/users/me")

    expect(readSessionCookie(request, "access_token")).toBeUndefined()
  })
})
