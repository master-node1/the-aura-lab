import {
  Injectable,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityClient, IdentityRecord } from '../identity/identity.client';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// Identity statuses that may still sign in. SUSPENDED, LOCKED, DEACTIVATED, ARCHIVED
// and DELETED are refused.
const SIGN_IN_STATUSES = new Set(['PENDING_VERIFICATION', 'VERIFIED', 'ACTIVE']);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly requireVerifiedEmail: boolean;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private identities: IdentityClient,
  ) {
    this.requireVerifiedEmail = config.get<string>('REQUIRE_VERIFIED_EMAIL', 'true') !== 'false';
  }

  /**
   * Creates the identity in identity-service first, then the user with the same ID, so
   * JWT sub = users.id = identities.id = customers.identity_id.
   */
  async register(dto: RegisterDto) {
    const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingEmail) throw new ConflictException('Email already registered');

    const existingUsername = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existingUsername) throw new ConflictException('Username already taken');

    const identityId = await this.createOrRecoverIdentity(dto);

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          id: identityId,
          email: dto.email,
          username: dto.username,
          hashedPassword,
          personalityArchetype: dto.personalityArchetype ?? 'friend',
        },
      });
    } catch (error) {
      // Lost a race with a concurrent registration. The identity is reused on retry.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email or username already registered');
      }
      throw error;
    }

    await this.identities.requestEmailVerification(identityId);
    return this.sanitizeUser(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const valid = await bcrypt.compare(dto.password, user.hashedPassword);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    await this.assertIdentityMaySignIn(user);
    return this.generateTokens(user.id, user.email);
  }

  async refresh(refreshToken: string) {
    let user: User | null;
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_SECRET', 'changeme'),
      });
      if (payload.type !== 'refresh') throw new Error('Wrong token type');
      user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid refresh token');

    await this.assertIdentityMaySignIn(user);
    return this.generateTokens(user.id, user.email);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitizeUser(user);
  }

  /**
   * Creates the identity, or reuses one left behind by an earlier registration that
   * failed after creating it (same email, no user row yet).
   */
  private async createOrRecoverIdentity(dto: RegisterDto): Promise<string> {
    try {
      const identity = await this.identities.create({
        id: randomUUID(),
        email: dto.email,
        displayName: dto.username,
        registrationSource: 'auth-service',
      });
      return identity.id;
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      const orphan = await this.identities.findByEmail(dto.email);
      const claimed = orphan && (await this.prisma.user.findUnique({ where: { id: orphan.id } }));
      if (!orphan || claimed || orphan.deletedAt) throw new ConflictException('Email already registered');
      return orphan.id;
    }
  }

  /**
   * Refuses suspended/deleted identities and, unless REQUIRE_VERIFIED_EMAIL=false,
   * unverified email addresses. Users created before identities existed get one now.
   */
  private async assertIdentityMaySignIn(user: User): Promise<void> {
    let identity: IdentityRecord | null = await this.identities.findById(user.id);
    if (!identity) {
      try {
        identity = await this.identities.create({
          id: user.id,
          email: user.email,
          displayName: user.username,
          registrationSource: 'auth-service-backfill',
        });
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
        // Another identity already owns this email under a different ID.
        this.logger.error(`Cannot backfill identity for user ${user.id}: email belongs to another identity`);
        throw new ForbiddenException('Account requires attention; contact support');
      }
      await this.identities.requestEmailVerification(identity.id);
    }

    if (identity.deletedAt || !SIGN_IN_STATUSES.has(identity.status)) {
      throw new ForbiddenException('Account is not active');
    }
    if (this.requireVerifiedEmail && !identity.isEmailVerified) {
      throw new ForbiddenException('Email address is not verified');
    }
  }

  private generateTokens(userId: string, email: string) {
    const secret = this.config.get<string>('JWT_SECRET', 'changeme');
    const accessToken = this.jwt.sign(
      { sub: userId, email, type: 'access' },
      { secret, expiresIn: `${this.config.get('JWT_ACCESS_EXPIRE_MINUTES', 30)}m` },
    );
    const refreshToken = this.jwt.sign(
      { sub: userId, type: 'refresh' },
      { secret, expiresIn: `${this.config.get('JWT_REFRESH_EXPIRE_DAYS', 7)}d` },
    );
    return { access_token: accessToken, refresh_token: refreshToken, token_type: 'bearer' };
  }

  private sanitizeUser(user: User) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripped from the response
    const { hashedPassword, ...safe } = user;
    return safe;
  }
}
