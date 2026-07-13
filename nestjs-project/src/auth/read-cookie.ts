import { Request } from 'express';

/**
 * Type-safe read of a named cookie from a parsed request. `req.cookies` is
 * untyped (`any`) at the framework boundary — this narrows it in one place
 * instead of at every call site.
 *
 * @author Saulo Santos
 * @date 12/07/2026
 */
export function readCookie(req: Request, name: string): string | undefined {
  const value: unknown = req.cookies?.[name];
  return typeof value === 'string' ? value : undefined;
}
