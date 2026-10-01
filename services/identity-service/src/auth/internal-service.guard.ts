import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';

export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Protects service-to-service endpoints that are called before a user has a JWT
 * (signup, login lookups). Fails closed when INTERNAL_SERVICE_TOKEN is not configured.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('INTERNAL_SERVICE_TOKEN');
    const provided = context.switchToHttp().getRequest<Request>().headers[INTERNAL_TOKEN_HEADER];
    if (!expected || typeof provided !== 'string' || !timingSafeEqual(digest(provided), digest(expected))) {
      throw new UnauthorizedException('Invalid internal service token');
    }
    return true;
  }
}
