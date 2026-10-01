import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';

export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Global guard: this service is internal-only, so every route except @Public() ones
 * requires the shared INTERNAL_SERVICE_TOKEN. Fails closed when it isn't configured.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const expected = this.config.get<string>('INTERNAL_SERVICE_TOKEN');
    const provided = context.switchToHttp().getRequest<Request>().headers[INTERNAL_TOKEN_HEADER];
    if (!expected || typeof provided !== 'string' || !timingSafeEqual(digest(provided), digest(expected))) {
      throw new UnauthorizedException('Invalid internal service token');
    }
    return true;
  }
}
