import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Identity, IdentityStatus, Prisma, VerificationChannel } from '@prisma/client';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationChannelName } from './dto/issue-verification.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerificationNotifier } from './verification-notifier';

const INVALID_CODE = 'Invalid or expired verification code';

const toChannel = (name: VerificationChannelName): VerificationChannel =>
  name === 'email' ? VerificationChannel.EMAIL : VerificationChannel.MOBILE;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

// Email tokens carry 256 bits of entropy, so a plain hash is enough. Six-digit OTPs are
// salted with the identity ID and protected by the attempt limit.
const hashEmailToken = (token: string) => sha256(token);
const hashOtp = (identityId: string, otp: string) => sha256(`${identityId}:${otp}`);

const hashesMatch = (a: string, b: string) => timingSafeEqual(Buffer.from(a), Buffer.from(b));

export interface IssuedVerification {
  verificationId: string;
  channel: VerificationChannelName;
  expiresAt: Date;
  /** Only returned outside production, because no delivery channel exists yet. */
  devCode?: string;
}

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly emailTtlMinutes: number;
  private readonly otpTtlMinutes: number;
  private readonly maxAttempts: number;
  private readonly resendCooldownSeconds: number;
  private readonly isProduction: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: VerificationNotifier,
    config: ConfigService,
  ) {
    this.emailTtlMinutes = Number(config.get('VERIFICATION_EMAIL_TTL_MINUTES', 30));
    this.otpTtlMinutes = Number(config.get('VERIFICATION_OTP_TTL_MINUTES', 10));
    this.maxAttempts = Number(config.get('VERIFICATION_MAX_ATTEMPTS', 5));
    this.resendCooldownSeconds = Number(config.get('VERIFICATION_RESEND_COOLDOWN_SECONDS', 60));
    this.isProduction = config.get<string>('NODE_ENV') === 'production';
  }

  /** Creates a new code for the channel, invalidating any earlier unused code. */
  async issue(identityId: string, channelName: VerificationChannelName): Promise<IssuedVerification> {
    const channel = toChannel(channelName);
    const identity = await this.prisma.identity.findFirst({ where: { id: identityId, deletedAt: null } });
    if (!identity) throw new NotFoundException(`Identity ${identityId} not found`);

    const destination = this.destinationFor(identity, channel);
    if (this.isProduction && !this.notifier.isConfigured()) {
      throw new ServiceUnavailableException('Verification delivery is not configured');
    }

    const code =
      channel === VerificationChannel.EMAIL
        ? randomBytes(32).toString('base64url')
        : randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = channel === VerificationChannel.EMAIL ? hashEmailToken(code) : hashOtp(identity.id, code);
    const ttlMinutes = channel === VerificationChannel.EMAIL ? this.emailTtlMinutes : this.otpTtlMinutes;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);

    const verification = await this.prisma.$transaction(async (tx) => {
      await tx.identityVerification.updateMany({
        where: { identityId, channel, consumedAt: null, expiresAt: { gt: now } },
        data: { expiresAt: now },
      });
      const created = await tx.identityVerification.create({
        data: { identityId, channel, codeHash, expiresAt },
      });
      await this.audit(tx, identityId, 'VERIFICATION_ISSUED', { channel: channelName });
      return created;
    });

    await this.notifier.send(channel, destination, code);

    return {
      verificationId: verification.id,
      channel: channelName,
      expiresAt,
      ...(this.isProduction ? {} : { devCode: code }),
    };
  }

  async verifyEmail(token: string) {
    const verification = await this.prisma.identityVerification.findFirst({
      where: { channel: VerificationChannel.EMAIL, codeHash: hashEmailToken(token) },
      include: { identity: true },
    });
    const now = new Date();
    if (
      !verification ||
      verification.consumedAt ||
      verification.expiresAt <= now ||
      verification.identity.deletedAt
    ) {
      throw new BadRequestException(INVALID_CODE);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.consume(tx, verification.id);
      await tx.identity.update({
        where: { id: verification.identityId },
        data: {
          isEmailVerified: true,
          // Only a pending identity moves to VERIFIED; suspended or other states are kept.
          ...(verification.identity.status === IdentityStatus.PENDING_VERIFICATION && {
            status: IdentityStatus.VERIFIED,
          }),
        },
      });
      await this.audit(tx, verification.identityId, 'EMAIL_VERIFIED');
    });
    return { verified: true, channel: 'email' };
  }

  async verifyMobile(mobileNumber: string, otp: string) {
    const identity = await this.prisma.identity.findUnique({ where: { mobileNumber } });
    if (!identity || identity.deletedAt) throw new BadRequestException(INVALID_CODE);

    const now = new Date();
    const verification = await this.prisma.identityVerification.findFirst({
      where: {
        identityId: identity.id,
        channel: VerificationChannel.MOBILE,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!verification) throw new BadRequestException(INVALID_CODE);

    // Count the attempt before comparing, so parallel guesses can't exceed the limit.
    const counted = await this.prisma.identityVerification.updateMany({
      where: { id: verification.id, consumedAt: null, attempts: { lt: this.maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    if (counted.count === 0 || !hashesMatch(hashOtp(identity.id, otp), verification.codeHash)) {
      throw new BadRequestException(INVALID_CODE);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.consume(tx, verification.id);
      await tx.identity.update({ where: { id: identity.id }, data: { isMobileVerified: true } });
      await this.audit(tx, identity.id, 'MOBILE_VERIFIED');
    });
    return { verified: true, channel: 'mobile' };
  }

  /**
   * Public resend. Always succeeds from the caller's point of view so it can't be used
   * to discover which emails or mobile numbers are registered.
   */
  async resend(dto: ResendVerificationDto): Promise<void> {
    const channel = toChannel(dto.channel);
    const identity =
      channel === VerificationChannel.EMAIL
        ? await this.prisma.identity.findUnique({ where: { email: dto.email! } })
        : await this.prisma.identity.findUnique({ where: { mobileNumber: dto.mobileNumber! } });
    if (!identity || identity.deletedAt || this.isVerified(identity, channel)) return;

    const latest = await this.prisma.identityVerification.findFirst({
      where: { identityId: identity.id, channel },
      orderBy: { createdAt: 'desc' },
    });
    if (latest && Date.now() - latest.createdAt.getTime() < this.resendCooldownSeconds * 1000) return;

    try {
      await this.issue(identity.id, dto.channel);
    } catch (error) {
      if (!(error instanceof HttpException)) throw error;
      this.logger.warn(`Resend for identity ${identity.id} not issued: ${error.message}`);
    }
  }

  private destinationFor(identity: Identity, channel: VerificationChannel): string {
    if (this.isVerified(identity, channel)) {
      throw new ConflictException(`${channel === VerificationChannel.EMAIL ? 'Email' : 'Mobile number'} is already verified`);
    }
    if (channel === VerificationChannel.EMAIL) return identity.email;
    if (!identity.mobileNumber) throw new BadRequestException('Identity has no mobile number');
    return identity.mobileNumber;
  }

  private isVerified(identity: Identity, channel: VerificationChannel): boolean {
    return channel === VerificationChannel.EMAIL ? identity.isEmailVerified : identity.isMobileVerified;
  }

  /** Marks the code used; fails if a concurrent request already used it. */
  private async consume(tx: Prisma.TransactionClient, verificationId: string) {
    const consumed = await tx.identityVerification.updateMany({
      where: { id: verificationId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count === 0) throw new BadRequestException(INVALID_CODE);
  }

  private async audit(
    tx: Prisma.TransactionClient,
    identityId: string,
    action: string,
    details?: Prisma.InputJsonValue,
  ) {
    await tx.identityAuditLog.create({ data: { identityId, action, details } });
  }
}
