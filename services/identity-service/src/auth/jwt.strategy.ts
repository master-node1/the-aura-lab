import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

/** Header carrying the authenticated user's ID, set only from a verified token. */
export const USER_ID_HEADER = 'x-user-id';

interface AccessTokenPayload {
  sub?: unknown;
  email?: unknown;
  type?: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'changeme'),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: AccessTokenPayload) {
    if (payload.type !== 'access' || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Invalid token type');
    }
    req.headers[USER_ID_HEADER] = payload.sub;
    return { sub: payload.sub, email: payload.email };
  }
}
