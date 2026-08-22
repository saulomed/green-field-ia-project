import type { NextRequest } from "next/server"

/**
 * Superfície mínima e comum entre `NextResponse.cookies` (`ResponseCookies`)
 * e o store ambiente de `(await cookies())` de `next/headers` dentro de uma
 * Route Handler — os dois aceitam `set`/`delete` com a mesma forma. Genérico
 * de propósito: o middleware de renovação (`auth-frontend/TD-04`) escreve via
 * o store ambiente (não tem um `NextResponse` próprio, só o da chamada
 * upstream), enquanto os route handlers de login/refresh escrevem via
 * `response.cookies`.
 */
interface CookieStore {
  set(
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean
      secure?: boolean
      sameSite?: "strict" | "lax" | "none"
      path?: string
      maxAge?: number
    },
  ): unknown
  delete(name: string): unknown
}

interface ParsedUpstreamCookie {
  name: string
  value: string
  maxAge?: number
}

/**
 * Parses a single upstream `Set-Cookie` header string. Only name, value and
 * `Max-Age` are read — every other attribute (`Path`, `SameSite`, `Secure`,
 * `HttpOnly`) is the BFF's own policy, never copied through, since the
 * upstream's paths are its own and never coincide with the BFF's.
 */
export function parseUpstreamSetCookie(raw: string): ParsedUpstreamCookie {
  const [pair, ...attributes] = raw.split(";").map((part) => part.trim())
  const separatorIndex = pair.indexOf("=")
  const name = pair.slice(0, separatorIndex)
  const value = pair.slice(separatorIndex + 1)

  let maxAge: number | undefined
  for (const attribute of attributes) {
    const [key, val] = attribute.split("=").map((part) => part.trim())
    if (key.toLowerCase() === "max-age" && val !== undefined) {
      maxAge = Number(val)
    }
  }

  return { name, value, maxAge }
}

/**
 * Re-emits an upstream session cookie on the BFF response with the BFF's own
 * attributes (`auth-frontend/TD-03`, Option B). `Secure` is set even in
 * development per `auth/TD-15`.
 */
export function reissueSessionCookie(
  cookieStore: CookieStore,
  upstreamSetCookie: string,
  options?: { path?: string },
): void {
  const { name, value, maxAge } = parseUpstreamSetCookie(upstreamSetCookie)

  cookieStore.set(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: options?.path ?? "/",
    ...(maxAge !== undefined ? { maxAge } : {}),
  })
}

/** Re-emits every upstream `Set-Cookie` header on the BFF response — see `reissueSessionCookie`. */
export function reissueSessionCookies(
  cookieStore: CookieStore,
  upstreamSetCookies: string[],
  options?: { path?: string },
): void {
  for (const setCookie of upstreamSetCookies) {
    reissueSessionCookie(cookieStore, setCookie, options)
  }
}

/** Clears the named session cookies on the BFF response (logout / token reuse). */
export function clearAuthCookies(cookieStore: CookieStore, names: string[]): void {
  for (const name of names) {
    cookieStore.delete(name)
  }
}

/** Reads a session cookie by name from an incoming BFF request. */
export function readSessionCookie(request: NextRequest, name: string): string | undefined {
  return request.cookies.get(name)?.value
}
