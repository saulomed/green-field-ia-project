/**
 * Response body for GET /users/me. Exposes only public-safe account fields —
 * never the password hash.
 *
 * @author Saulo Santos
 * @date 18/07/2026
 */
export class UserProfileResponseDto {
  id: string;
  email: string;
  isConfirmed: boolean;
  createdAt: Date;
  channel: {
    nickname: string;
    name: string;
  };
}
