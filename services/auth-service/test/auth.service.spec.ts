import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../src/auth/auth.service';
import { IdentityClient, IdentityRecord } from '../src/identity/identity.client';
import { PrismaService } from '../src/prisma/prisma.service';
import { fakeConfig } from './helpers';

const SECRET = 'test-secret';
const USER_ID = '6f1c2b1e-8a43-4d5c-9b1e-2f3a4b5c6d7e';
const PASSWORD = 'password123';
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

const user = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: USER_ID,
  email: 'jane@example.com',
  username: 'jane',
  hashedPassword: passwordHash,
  isActive: true,
  ...overrides,
});
const identity = (overrides: Partial<IdentityRecord> = {}): IdentityRecord => ({
  id: USER_ID,
  email: 'jane@example.com',
  status: 'VERIFIED',
  isEmailVerified: true,
  deletedAt: null,
  ...overrides,
});

function setup(env: Record<string, string> = { JWT_SECRET: SECRET, NODE_ENV: 'production' }) {
  const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
  const identities = {
    create: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    requestEmailVerification: jest.fn(),
  };
  const jwt = new JwtService({ secret: SECRET });
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt,
    fakeConfig(env),
    identities as unknown as IdentityClient,
  );
  return { prisma, identities, jwt, service };
}

describe('AuthService', () => {
  describe('register', () => {
    const dto = { email: 'jane@example.com', username: 'jane', password: PASSWORD };

    it('creates the identity first, then the user with the same ID, then requests a code', async () => {
      const { prisma, identities, service } = setup();
      prisma.user.findUnique.mockResolvedValue(null);
      identities.create.mockImplementation(async (input: { id: string }) => identity({ id: input.id }));
      prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data);

      const result = await service.register(dto);

      const identityId = identities.create.mock.calls[0][0].id;
      expect(identities.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: dto.email, displayName: 'jane', registrationSource: 'auth-service' }),
      );
      expect(prisma.user.create.mock.calls[0][0].data.id).toBe(identityId);
      expect(identities.requestEmailVerification).toHaveBeenCalledWith(identityId);
      expect(result).not.toHaveProperty('hashedPassword');
      expect(identities.create.mock.invocationCallOrder[0]).toBeLessThan(prisma.user.create.mock.invocationCallOrder[0]);
    });

    it('rejects a taken email before touching identity-service', async () => {
      const { prisma, identities, service } = setup();
      prisma.user.findUnique.mockResolvedValueOnce(user());
      await expect(service.register(dto)).rejects.toBeInstanceOf(ConflictException);
      expect(identities.create).not.toHaveBeenCalled();
    });

    it('reuses an orphan identity left by an earlier failed signup', async () => {
      const { prisma, identities, service } = setup();
      prisma.user.findUnique.mockResolvedValue(null);
      identities.create.mockRejectedValue(new ConflictException());
      identities.findByEmail.mockResolvedValue(identity({ id: 'orphan-id' }));
      prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data);

      await service.register(dto);

      expect(prisma.user.create.mock.calls[0][0].data.id).toBe('orphan-id');
    });

    it.each([
      ['already owned by a user', identity({ id: 'taken' }), user({ id: 'taken' })],
      ['soft-deleted', identity({ id: 'gone', deletedAt: '2026-01-01T00:00:00Z' }), null],
    ])('returns 409 when the existing identity is %s', async (_case, existing, owner) => {
      const { prisma, identities, service } = setup();
      prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(owner);
      identities.create.mockRejectedValue(new ConflictException());
      identities.findByEmail.mockResolvedValue(existing);
      await expect(service.register(dto)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('maps a concurrent unique violation to 409', async () => {
      const { prisma, identities, service } = setup();
      prisma.user.findUnique.mockResolvedValue(null);
      identities.create.mockResolvedValue(identity());
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' }),
      );
      await expect(service.register(dto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('fails with 503 when identity-service is down', async () => {
      const { prisma, identities, service } = setup();
      prisma.user.findUnique.mockResolvedValue(null);
      identities.create.mockRejectedValue(new ServiceUnavailableException());
      await expect(service.register(dto)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const credentials = { email: 'jane@example.com', password: PASSWORD };

    it('issues tokens whose subject is the shared user/identity ID', async () => {
      const { prisma, identities, jwt, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user());
      identities.findById.mockResolvedValue(identity());

      const tokens = await service.login(credentials);

      expect(jwt.verify(tokens.access_token)).toMatchObject({ sub: USER_ID, type: 'access' });
      expect(jwt.verify(tokens.refresh_token)).toMatchObject({ sub: USER_ID, type: 'refresh' });
    });

    it('checks the password before calling identity-service', async () => {
      const { prisma, identities, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user());
      await expect(service.login({ ...credentials, password: 'wrong-password' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(identities.findById).not.toHaveBeenCalled();
    });

    it.each(['SUSPENDED', 'LOCKED', 'DEACTIVATED', 'ARCHIVED', 'DELETED'])('refuses a %s identity', async (status) => {
      const { prisma, identities, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user());
      identities.findById.mockResolvedValue(identity({ status }));
      await expect(service.login(credentials)).rejects.toThrow('Account is not active');
    });

    it('refuses a soft-deleted identity', async () => {
      const { prisma, identities, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user());
      identities.findById.mockResolvedValue(identity({ deletedAt: '2026-01-01T00:00:00Z' }));
      await expect(service.login(credentials)).rejects.toBeInstanceOf(ForbiddenException);
    });

    describe('email verification requirement', () => {
      const unverified = identity({ status: 'PENDING_VERIFICATION', isEmailVerified: false });

      it.each([
        ['production (default)', { NODE_ENV: 'production' }, true],
        ['development (default)', { NODE_ENV: 'development' }, false],
        ['no NODE_ENV (default)', {}, false],
        ['development with REQUIRE_VERIFIED_EMAIL=true', { NODE_ENV: 'development', REQUIRE_VERIFIED_EMAIL: 'true' }, true],
        ['production with REQUIRE_VERIFIED_EMAIL=false', { NODE_ENV: 'production', REQUIRE_VERIFIED_EMAIL: 'false' }, false],
      ])('in %s requires a verified email: %s', async (_case, env, required) => {
        const { prisma, identities, service } = setup({ JWT_SECRET: SECRET, ...env });
        prisma.user.findUnique.mockResolvedValue(user());
        identities.findById.mockResolvedValue(unverified);
        const login = service.login(credentials);
        if (required) {
          await expect(login).rejects.toThrow('Email address is not verified');
        } else {
          await expect(login).resolves.toHaveProperty('access_token');
        }
      });
    });

    it('backfills an identity with the same ID for users created before the link existed', async () => {
      const { prisma, identities, service } = setup({ JWT_SECRET: SECRET, NODE_ENV: 'development' });
      prisma.user.findUnique.mockResolvedValue(user());
      identities.findById.mockResolvedValue(null);
      identities.create.mockResolvedValue(identity({ status: 'PENDING_VERIFICATION', isEmailVerified: false }));

      await service.login(credentials);

      expect(identities.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: USER_ID, email: 'jane@example.com', registrationSource: 'auth-service-backfill' }),
      );
      expect(identities.requestEmailVerification).toHaveBeenCalledWith(USER_ID);
    });

    it('returns 403 when the backfill conflicts with another identity', async () => {
      const { prisma, identities, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user());
      identities.findById.mockResolvedValue(null);
      identities.create.mockRejectedValue(new ConflictException());
      await expect(service.login(credentials)).rejects.toThrow('Account requires attention; contact support');
    });
  });

  describe('refresh', () => {
    it('issues new tokens for an active, verified identity', async () => {
      const { prisma, identities, jwt, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user());
      identities.findById.mockResolvedValue(identity());
      const refresh = jwt.sign({ sub: USER_ID, type: 'refresh' });
      await expect(service.refresh(refresh)).resolves.toHaveProperty('access_token');
    });

    it.each([
      ['an access token', (jwt: JwtService) => jwt.sign({ sub: USER_ID, type: 'access' })],
      ['a token signed with another secret', () => new JwtService({ secret: 'other' }).sign({ sub: USER_ID, type: 'refresh' })],
      ['garbage', () => 'not-a-jwt'],
    ])('rejects %s with 401', async (_case, makeToken) => {
      const { prisma, jwt, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user());
      await expect(service.refresh(makeToken(jwt))).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a deactivated user with 401', async () => {
      const { prisma, jwt, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user({ isActive: false }));
      await expect(service.refresh(jwt.sign({ sub: USER_ID, type: 'refresh' }))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('refuses a suspended identity with 403', async () => {
      const { prisma, identities, jwt, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user());
      identities.findById.mockResolvedValue(identity({ status: 'SUSPENDED' }));
      await expect(service.refresh(jwt.sign({ sub: USER_ID, type: 'refresh' }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
