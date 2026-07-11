import { Request } from 'express';
import { User } from '../../users/entities/user.entity';

/**
 * Request shape once a Passport guard (e.g. LocalAuthGuard) has populated
 * `req.user` with the authenticated entity.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export interface AuthenticatedRequest extends Request {
  user: User;
}
