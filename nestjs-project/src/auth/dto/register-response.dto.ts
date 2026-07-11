/**
 * Response body for POST /auth/register.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export class RegisterResponseDto {
  id: string;
  email: string;
  channel: { nickname: string };
}
