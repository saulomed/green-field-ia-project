import { seconds, ThrottlerOptions } from '@nestjs/throttler';

/**
 * Name of the single throttler window registered globally. Route-specific
 * limits override it via `@Throttle({ [THROTTLER_NAME]: ... })` instead of
 * introducing separate named throttlers.
 *
 * @author Saulo Santos
 * @date 13/07/2026
 */
export const THROTTLER_NAME = 'default';

/**
 * Default request budget applied to every route that does not declare its
 * own `@Throttle` override.
 *
 * @author Saulo Santos
 * @date 13/07/2026
 */
export const GLOBAL_THROTTLE: ThrottlerOptions = {
  name: THROTTLER_NAME,
  ttl: seconds(60),
  limit: 100,
};

/**
 * Stricter per-route budgets for auth endpoints prone to brute-force or
 * e-mail abuse (DT-08).
 *
 * @author Saulo Santos
 * @date 13/07/2026
 */
export const AUTH_THROTTLE = {
  LOGIN: { limit: 5, ttl: seconds(60) }, // 5 per minute
  FORGOT_PASSWORD: { limit: 3, ttl: seconds(3600) }, // 3 per hour
  RESEND_CONFIRMATION: { limit: 3, ttl: seconds(3600) }, // 3 per hour
} as const;
