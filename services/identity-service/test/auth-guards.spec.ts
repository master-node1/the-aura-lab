import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { InternalServiceGuard } from '../src/auth/internal-service.guard';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { IS_PUBLIC_KEY } from '../src/auth/public.decorator';
import { fakeConfig } from './helpers';

function contextFor(headers: Record<string, string> = {}): ExecutionContext {
  const request = { headers } as unknown as Request;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('InternalServiceGuard', () => {
  const guard = (token?: string) => new InternalServiceGuard(fakeConfig({ INTERNAL_SERVICE_TOKEN: token }));

  it('accepts the configured token', () => {
    expect(guard('s3cret').canActivate(contextFor({ 'x-internal-token': 's3cret' }))).toBe(true);
  });

  it.each([
    ['a missing header', {}],
    ['a wrong token', { 'x-internal-token': 'nope' }],
    ['a token with the right prefix', { 'x-internal-token': 's3cret-extra' }],
  ])('rejects %s', (_case, headers) => {
    expect(() => guard('s3cret').canActivate(contextFor(headers))).toThrow(UnauthorizedException);
  });

  it('rejects everything when INTERNAL_SERVICE_TOKEN is not configured', () => {
    expect(() => guard(undefined).canActivate(contextFor({ 'x-internal-token': '' }))).toThrow(UnauthorizedException);
  });
});

describe('JwtAuthGuard', () => {
  it('skips JWT validation for @Public() routes', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;
    expect(new JwtAuthGuard(reflector).canActivate(contextFor())).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [undefined, undefined]);
  });
});

describe('JwtStrategy', () => {
  const strategy = new JwtStrategy(fakeConfig({ JWT_SECRET: 'test-secret' }));

  it('sets x-user-id from the token subject, replacing any client value', () => {
    const request = { headers: { 'x-user-id': 'spoofed' } } as unknown as Request;
    const user = strategy.validate(request, { sub: 'user-1', email: 'a@b.c', type: 'access' });
    expect(request.headers['x-user-id']).toBe('user-1');
    expect(user).toEqual({ sub: 'user-1', email: 'a@b.c' });
  });

  it.each([
    ['a refresh token', { sub: 'user-1', type: 'refresh' }],
    ['a token without a subject', { type: 'access' }],
  ])('rejects %s', (_case, payload) => {
    const request = { headers: {} } as unknown as Request;
    expect(() => strategy.validate(request, payload)).toThrow(UnauthorizedException);
    expect(request.headers['x-user-id']).toBeUndefined();
  });
});
