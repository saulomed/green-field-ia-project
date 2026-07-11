/**
 * Purpose claim values embedded in short-lived JWTs issued by AuthService,
 * so each JWT can only be used for the flow it was minted for.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export const JWT_PURPOSE = {
  CONFIRM: 'confirm',
} as const;

/**
 * Names of the httpOnly cookies used to carry session JWTs.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export const AUTH_COOKIES = {
  ACCESS_TOKEN: 'access_token',
} as const;
