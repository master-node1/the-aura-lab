import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingEmail) throw new ConflictException('Email already registered');

    const existingUsername = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existingUsername) throw new ConflictException('Username already taken');

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        hashedPassword,
        personalityArchetype: dto.personalityArchetype ?? 'friend',
      },
    });

    return this.sanitizeUser(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const valid = await bcrypt.compare(dto.password, user.hashedPassword);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    return this.generateTokens(user.id, user.email);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_SECRET', 'changeme'),
      });
      if (payload.type !== 'refresh') throw new Error('Wrong token type');

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new NotFoundException('User not found');

      return this.generateTokens(user.id, user.email);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitizeUser(user);
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

  private sanitizeUser(user: any) {
    const { hashedPassword, ...safe } = user;
    return safe;
  }
}
