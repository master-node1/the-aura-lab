import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { IdentityStatus, VerificationChannel } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { VerificationNotifier } from '../src/identity/verification-notifier';
import { VerificationService } from '../src/identity/verification.service';
import { fakeConfig } from './helpers';

const IDENTITY_ID = '6f1c2b1e-8a43-4d5c-9b1e-2f3a4b5c6d7e';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

function identity(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: IDENTITY_ID,
    email: 'jane@example.com',
    mobileNumber: '+14155552671',
    status: IdentityStatus.PENDING_VERIFICATION,
    isEmailVerified: false,
    isMobileVerified: false,
    deletedAt: null,
    ...overrides,
  };
}

function setup(env: Record<string, string> = { NODE_ENV: 'development' }) {
  const prisma = {
    identity: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    identityVerification: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'verification-1' }),
      findFirst: jest.fn(),
    },
    identityAuditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((work: (tx: typeof prisma) => Promise<unknown>) => work(prisma));
  const notifier = { isConfigured: jest.fn().mockReturnValue(false), send: jest.fn() };
  const service = new VerificationService(
    prisma as unknown as PrismaService,
    notifier as unknown as VerificationNotifier,
    fakeConfig(env),
  );
  return { prisma, notifier, service };
}

describe('VerificationService', () => {
  describe('issue', () => {
    it('stores only a hash, expires older codes and returns devCode outside production', async () => {
      const { prisma, notifier, service } = setup();
      prisma.identity.findFirst.mockResolvedValue(identity());

      const result = await service.issue(IDENTITY_ID, 'email');

      expect(result.devCode).toHaveLength(43);
      const stored = prisma.identityVerification.create.mock.calls[0][0].data;
      expect(stored.codeHash).toBe(sha256(result.devCode!));
      expect(stored.codeHash).not.toContain(result.devCode);
      expect(prisma.identityVerification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ identityId: IDENTITY_ID, consumedAt: null }) }),
      );
      expect(notifier.send).toHaveBeenCalledWith(VerificationChannel.EMAIL, 'jane@example.com', result.devCode);
      expect(prisma.identityAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'VERIFICATION_ISSUED' }) }),
      );
    });

    it('issues a six-digit OTP salted with the identity ID for mobile', async () => {
      const { prisma, service } = setup();
      prisma.identity.findFirst.mockResolvedValue(identity());

      const result = await service.issue(IDENTITY_ID, 'mobile');

      expect(result.devCode).toMatch(/^\d{6}$/);
      expect(prisma.identityVerification.create.mock.calls[0][0].data.codeHash).toBe(
        sha256(`${IDENTITY_ID}:${result.devCode}`),
      );
    });

    it('rejects a missing or deleted identity with 404', async () => {
      const { prisma, service } = setup();
      prisma.identity.findFirst.mockResolvedValue(null);
      await expect(service.issue(IDENTITY_ID, 'email')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an already verified channel with 409', async () => {
      const { prisma, service } = setup();
      prisma.identity.findFirst.mockResolvedValue(identity({ isEmailVerified: true }));
      await expect(service.issue(IDENTITY_ID, 'email')).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects mobile verification without a mobile number with 400', async () => {
      const { prisma, service } = setup();
      prisma.identity.findFirst.mockResolvedValue(identity({ mobileNumber: null }));
      await expect(service.issue(IDENTITY_ID, 'mobile')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses with 503 in production while no delivery provider is configured', async () => {
      const { prisma, service } = setup({ NODE_ENV: 'production' });
      prisma.identity.findFirst.mockResolvedValue(identity());
      await expect(service.issue(IDENTITY_ID, 'email')).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(prisma.identityVerification.create).not.toHaveBeenCalled();
    });

    it('omits devCode in production once delivery is configured', async () => {
      const { prisma, notifier, service } = setup({ NODE_ENV: 'production' });
      notifier.isConfigured.mockReturnValue(true);
      prisma.identity.findFirst.mockResolvedValue(identity());
      const result = await service.issue(IDENTITY_ID, 'email');
      expect(result.devCode).toBeUndefined();
      expect(notifier.send).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    const token = 'a'.repeat(43);
    const valid = (overrides: Partial<Record<string, unknown>> = {}) => ({
      id: 'v1',
      identityId: IDENTITY_ID,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      identity: identity(),
      ...overrides,
    });

    it('looks the token up by hash, consumes it and moves PENDING_VERIFICATION to VERIFIED', async () => {
      const { prisma, service } = setup();
      prisma.identityVerification.findFirst.mockResolvedValue(valid());

      await expect(service.verifyEmail(token)).resolves.toEqual({ verified: true, channel: 'email' });

      expect(prisma.identityVerification.findFirst.mock.calls[0][0].where.codeHash).toBe(sha256(token));
      expect(prisma.identity.update).toHaveBeenCalledWith({
        where: { id: IDENTITY_ID },
        data: { isEmailVerified: true, status: IdentityStatus.VERIFIED },
      });
    });

    it('keeps a suspended identity suspended', async () => {
      const { prisma, service } = setup();
      prisma.identityVerification.findFirst.mockResolvedValue(
        valid({ identity: identity({ status: IdentityStatus.SUSPENDED }) }),
      );
      await service.verifyEmail(token);
      expect(prisma.identity.update.mock.calls[0][0].data).toEqual({ isEmailVerified: true });
    });

    it.each([
      ['unknown', null],
      ['used', valid({ consumedAt: new Date() })],
      ['expired', valid({ expiresAt: new Date(Date.now() - 1) })],
      ['belonging to a deleted identity', valid({ identity: identity({ deletedAt: new Date() }) })],
    ])('rejects a token that is %s with 400', async (_case, verification) => {
      const { prisma, service } = setup();
      prisma.identityVerification.findFirst.mockResolvedValue(verification);
      await expect(service.verifyEmail(token)).rejects.toThrow('Invalid or expired verification code');
      expect(prisma.identity.update).not.toHaveBeenCalled();
    });

    it('rejects a token consumed by a concurrent request', async () => {
      const { prisma, service } = setup();
      prisma.identityVerification.findFirst.mockResolvedValue(valid());
      prisma.identityVerification.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.verifyEmail(token)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('verifyMobile', () => {
    const otp = '482913';
    function withActiveCode(prisma: ReturnType<typeof setup>['prisma'], code = otp) {
      prisma.identity.findUnique.mockResolvedValue(identity());
      prisma.identityVerification.findFirst.mockResolvedValue({
        id: 'v1',
        codeHash: sha256(`${IDENTITY_ID}:${code}`),
      });
    }

    it('counts the attempt before comparing and verifies a matching OTP', async () => {
      const { prisma, service } = setup();
      withActiveCode(prisma);

      await expect(service.verifyMobile('+14155552671', otp)).resolves.toEqual({ verified: true, channel: 'mobile' });

      const [countCall, consumeCall] = prisma.identityVerification.updateMany.mock.calls;
      expect(countCall[0]).toEqual({
        where: { id: 'v1', consumedAt: null, attempts: { lt: 5 } },
        data: { attempts: { increment: 1 } },
      });
      expect(consumeCall[0].data).toHaveProperty('consumedAt');
      expect(prisma.identity.update).toHaveBeenCalledWith({ where: { id: IDENTITY_ID }, data: { isMobileVerified: true } });
    });

    it('rejects a wrong OTP after counting the attempt', async () => {
      const { prisma, service } = setup();
      withActiveCode(prisma);
      await expect(service.verifyMobile('+14155552671', '000000')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.identityVerification.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.identity.update).not.toHaveBeenCalled();
    });

    it('rejects even the correct OTP once the attempt limit is reached', async () => {
      const { prisma, service } = setup();
      withActiveCode(prisma);
      prisma.identityVerification.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.verifyMobile('+14155552671', otp)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.identity.update).not.toHaveBeenCalled();
    });

    it('gives the same error for an unknown mobile number', async () => {
      const { prisma, service } = setup();
      prisma.identity.findUnique.mockResolvedValue(null);
      await expect(service.verifyMobile('+19999999999', otp)).rejects.toThrow('Invalid or expired verification code');
    });
  });

  describe('resend', () => {
    it('does nothing for an unknown account', async () => {
      const { prisma, service } = setup();
      prisma.identity.findUnique.mockResolvedValue(null);
      await service.resend({ channel: 'email', email: 'nobody@example.com' });
      expect(prisma.identityVerification.create).not.toHaveBeenCalled();
    });

    it('does nothing for an already verified channel', async () => {
      const { prisma, service } = setup();
      prisma.identity.findUnique.mockResolvedValue(identity({ isEmailVerified: true }));
      await service.resend({ channel: 'email', email: 'jane@example.com' });
      expect(prisma.identityVerification.create).not.toHaveBeenCalled();
    });

    it('respects the cooldown', async () => {
      const { prisma, service } = setup();
      prisma.identity.findUnique.mockResolvedValue(identity());
      prisma.identityVerification.findFirst.mockResolvedValue({ createdAt: new Date() });
      await service.resend({ channel: 'email', email: 'jane@example.com' });
      expect(prisma.identityVerification.create).not.toHaveBeenCalled();
    });

    it('issues a new code after the cooldown', async () => {
      const { prisma, service } = setup();
      prisma.identity.findUnique.mockResolvedValue(identity());
      prisma.identityVerification.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 120_000) });
      prisma.identity.findFirst.mockResolvedValue(identity());
      await service.resend({ channel: 'email', email: 'jane@example.com' });
      expect(prisma.identityVerification.create).toHaveBeenCalled();
    });

    it('swallows HTTP errors such as the production 503 so the response stays generic', async () => {
      const { prisma, service } = setup({ NODE_ENV: 'production' });
      prisma.identity.findUnique.mockResolvedValue(identity());
      prisma.identityVerification.findFirst.mockResolvedValue(null);
      prisma.identity.findFirst.mockResolvedValue(identity());
      await expect(service.resend({ channel: 'email', email: 'jane@example.com' })).resolves.toBeUndefined();
    });

    it('rethrows unexpected errors', async () => {
      const { prisma, service } = setup();
      prisma.identity.findUnique.mockRejectedValue(new Error('database down'));
      await expect(service.resend({ channel: 'email', email: 'jane@example.com' })).rejects.toThrow('database down');
    });
  });
});
