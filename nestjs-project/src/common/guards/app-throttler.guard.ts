import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import { RateLimitExceededException } from '../exceptions/rate-limit-exceeded.exception';

/**
 * Global rate-limiting guard. Only overrides the exception raised on limit
 * breach, swapping the library's default for the app's own DomainException
 * so the standard { statusCode, error, message } format applies to 429s too.
 *
 * @author Saulo Santos
 * @date 13/07/2026
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(AppThrottlerGuard.name);

  protected throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();
    this.logger.warn(
      `Rate limit exceeded: ${request.method} ${request.path} from ${request.ip} (limit ${throttlerLimitDetail.limit}/${throttlerLimitDetail.ttl}ms)`,
    );
    throw new RateLimitExceededException();
  }
}
