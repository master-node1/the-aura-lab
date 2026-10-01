import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIdentityDto } from './dto/create-identity.dto';
import { UpdateIdentityDto } from './dto/update-identity.dto';
import { LinkProviderDto } from './dto/link-provider.dto';
import { IdentityStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async createIdentity(dto: CreateIdentityDto) {
    const existingEmail = await this.prisma.identity.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    if (dto.mobileNumber) {
      const existingMobile = await this.prisma.identity.findUnique({
        where: { mobileNumber: dto.mobileNumber },
      });
      if (existingMobile) {
        throw new ConflictException('Mobile number already registered');
      }
    }

    const identity = await this.prisma.identity.create({
      data: {
        email: dto.email,
        displayName: dto.displayName,
        firstName: dto.firstName,
        lastName: dto.lastName,
        mobileNumber: dto.mobileNumber,
        registrationSource: dto.registrationSource,
        preferredLanguage: dto.preferredLanguage ?? 'en',
        timeZone: dto.timeZone ?? 'UTC',
        status: IdentityStatus.PENDING_VERIFICATION,
      },
      include: { providers: true },
    });

    await this.createAuditLog(identity.id, 'IDENTITY_CREATED', undefined, { email: dto.email });

    return identity;
  }

  async findById(id: string) {
    const identity = await this.prisma.identity.findUnique({
      where: { id },
      include: { providers: true },
    });
    if (!identity) {
      throw new NotFoundException(`Identity ${id} not found`);
    }
    return identity;
  }

  async findByEmail(email: string) {
    return this.prisma.identity.findUnique({
      where: { email },
      include: { providers: true },
    });
  }

  async updateIdentity(id: string, dto: UpdateIdentityDto) {
    await this.findById(id); // throws if not found

    const updated = await this.prisma.identity.update({
      where: { id },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.mobileNumber !== undefined && { mobileNumber: dto.mobileNumber }),
        ...(dto.preferredLanguage !== undefined && { preferredLanguage: dto.preferredLanguage }),
        ...(dto.timeZone !== undefined && { timeZone: dto.timeZone }),
      },
      include: { providers: true },
    });

    await this.createAuditLog(id, 'IDENTITY_UPDATED', undefined, dto as Prisma.InputJsonValue);

    return updated;
  }

  async deleteIdentity(id: string) {
    await this.findById(id); // throws if not found

    const deleted = await this.prisma.identity.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: IdentityStatus.DELETED,
      },
    });

    await this.createAuditLog(id, 'IDENTITY_DELETED');

    return deleted;
  }

  // ─── PROVIDERS ────────────────────────────────────────────────────────────────

  async linkProvider(id: string, dto: LinkProviderDto) {
    await this.findById(id); // throws if not found

    const provider = await this.prisma.identityProvider.create({
      data: {
        identityId: id,
        provider: dto.provider,
        externalId: dto.externalId,
        isPrimary: dto.isPrimary ?? false,
      },
    });

    await this.createAuditLog(id, 'PROVIDER_LINKED', undefined, {
      provider: dto.provider,
      externalId: dto.externalId,
    });

    return provider;
  }

  async unlinkProvider(id: string, providerId: string) {
    await this.findById(id); // throws if not found

    const existing = await this.prisma.identityProvider.findFirst({
      where: { id: providerId, identityId: id },
    });
    if (!existing) {
      throw new NotFoundException(`Provider ${providerId} not found for identity ${id}`);
    }

    await this.prisma.identityProvider.delete({ where: { id: providerId } });

    await this.createAuditLog(id, 'PROVIDER_UNLINKED', undefined, { providerId });

    return { message: 'Provider unlinked successfully' };
  }

  // ─── STATUS MANAGEMENT ────────────────────────────────────────────────────────

  async suspendIdentity(id: string) {
    await this.findById(id); // throws if not found

    const updated = await this.prisma.identity.update({
      where: { id },
      data: { status: IdentityStatus.SUSPENDED },
    });

    await this.createAuditLog(id, 'IDENTITY_SUSPENDED');

    return updated;
  }

  async reactivateIdentity(id: string) {
    await this.findById(id); // throws if not found

    const updated = await this.prisma.identity.update({
      where: { id },
      data: { status: IdentityStatus.ACTIVE },
    });

    await this.createAuditLog(id, 'IDENTITY_REACTIVATED');

    return updated;
  }

  // ─── AUDIT LOGS ───────────────────────────────────────────────────────────────

  async getAuditLogs(id: string) {
    await this.findById(id); // throws if not found

    return this.prisma.identityAuditLog.findMany({
      where: { identityId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────

  private async createAuditLog(
    identityId: string,
    action: string,
    changedBy?: string,
    details?: Prisma.InputJsonValue,
  ) {
    await this.prisma.identityAuditLog.create({
      data: {
        identityId,
        action,
        changedBy,
        details,
      },
    });
  }
}
