import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AddressType,
  CustomerStatus,
  Prisma,
} from '@prisma/client';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { recordCustomerChange } from './customer-records';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCustomerDto) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const customer = await transaction.customer.create({
          data: {
            ...dto,
            email: dto.email.trim().toLowerCase(),
            mobileNumber: dto.mobileNumber?.trim() || null,
            preferredCurrency: dto.preferredCurrency?.toUpperCase(),
          },
        });
        await recordCustomerChange(
          transaction,
          customer.id,
          'customer.created',
          'customer.created',
          { identityId: customer.identityId },
        );
        return customer;
      });
    } catch (error) {
      this.rethrowKnownWriteError(error);
    }
  }

  async search(query: {
    q?: string;
    status?: CustomerStatus;
    page?: number;
    pageSize?: number;
  }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: 'insensitive' } },
              { lastName: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
              { mobileNumber: { contains: query.q } },
            ],
          }
        : {}),
    };
    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { data: customers, page, pageSize, total };
  }

  async findById(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      include: { addresses: true, preferences: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async findProfile(identityId: string) {
    if (!identityId || !isUUID(identityId)) {
      throw new BadRequestException('A valid x-identity-id header is required');
    }
    const customer = await this.prisma.customer.findFirst({
      where: { identityId, deletedAt: null },
      include: { addresses: true, preferences: true },
    });
    if (!customer) throw new NotFoundException('Customer profile not found');
    return customer;
  }

  async update(customerId: string, dto: UpdateCustomerDto) {
    await this.findById(customerId);
    const data: Prisma.CustomerUpdateInput = {
      ...dto,
      ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
      ...(dto.mobileNumber !== undefined
        ? { mobileNumber: dto.mobileNumber.trim() || null }
        : {}),
      ...(dto.preferredCurrency !== undefined
        ? { preferredCurrency: dto.preferredCurrency.toUpperCase() }
        : {}),
    };
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const customer = await transaction.customer.update({
          where: { id: customerId },
          data,
        });
        await recordCustomerChange(
          transaction,
          customerId,
          'customer.updated',
          'customer.updated',
          { fields: Object.keys(dto) },
        );
        return customer;
      });
    } catch (error) {
      this.rethrowKnownWriteError(error);
    }
  }

  async updateProfile(identityId: string, dto: UpdateCustomerDto) {
    const customer = await this.findProfile(identityId);
    return this.update(customer.id, dto);
  }

  async remove(customerId: string): Promise<void> {
    await this.findById(customerId);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.customer.update({
        where: { id: customerId },
        data: { deletedAt: new Date(), status: CustomerStatus.DELETED },
      });
      await recordCustomerChange(
        transaction,
        customerId,
        'customer.deleted',
        'customer.deleted',
      );
    });
  }

  async updateStatus(customerId: string, dto: UpdateCustomerStatusDto) {
    if (dto.status === CustomerStatus.DELETED) {
      throw new BadRequestException('Use DELETE /customers/:customerId to delete a customer');
    }
    const existing = await this.findById(customerId);
    const eventType =
      dto.status === CustomerStatus.SUSPENDED
        ? 'customer.suspended'
        : existing.status !== CustomerStatus.ACTIVE && dto.status === CustomerStatus.ACTIVE
          ? 'customer.reactivated'
          : 'customer.updated';
    return this.prisma.$transaction(async (transaction) => {
      const customer = await transaction.customer.update({
        where: { id: customerId },
        data: { status: dto.status },
      });
      await recordCustomerChange(
        transaction,
        customerId,
        'customer.status.updated',
        eventType,
        { status: dto.status },
      );
      return customer;
    });
  }

  async listAddresses(customerId: string) {
    await this.findById(customerId);
    return this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefaultShipping: 'desc' }, { isDefaultBilling: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createAddress(customerId: string, dto: CreateAddressDto) {
    await this.findById(customerId);
    return this.prisma.$transaction(async (transaction) => {
      await this.clearAddressDefaults(transaction, customerId, dto);
      const address = await transaction.customerAddress.create({
        data: { ...dto, country: dto.country.toUpperCase(), customerId },
      });
      await recordCustomerChange(
        transaction,
        customerId,
        'customer.address.created',
        'customer.address.created',
        { addressId: address.id },
      );
      return address;
    });
  }

  async updateAddress(
    customerId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ) {
    await this.findAddress(customerId, addressId);
    return this.prisma.$transaction(async (transaction) => {
      await this.clearAddressDefaults(transaction, customerId, dto);
      const address = await transaction.customerAddress.update({
        where: { id: addressId },
        data: {
          ...dto,
          ...(dto.country !== undefined ? { country: dto.country.toUpperCase() } : {}),
        },
      });
      await recordCustomerChange(
        transaction,
        customerId,
        'customer.address.updated',
        'customer.address.updated',
        { addressId },
      );
      return address;
    });
  }

  async removeAddress(customerId: string, addressId: string): Promise<void> {
    const address = await this.findAddress(customerId, addressId);
    if (address.isDefaultBilling || address.isDefaultShipping) {
      throw new ConflictException('Choose another default address before deleting this address');
    }
    await this.prisma.$transaction(async (transaction) => {
      await transaction.customerAddress.delete({ where: { id: addressId } });
      await recordCustomerChange(
        transaction,
        customerId,
        'customer.address.deleted',
        'customer.address.deleted',
        { addressId },
      );
    });
  }

  async getPreferences(customerId: string) {
    await this.findById(customerId);
    const preferences = await this.prisma.customerPreferences.findUnique({
      where: { customerId },
    });
    return preferences ?? { customerId, language: 'en', currency: 'USD' };
  }

  async updatePreferences(customerId: string, dto: UpdatePreferencesDto) {
    const customer = await this.findById(customerId);
    return this.prisma.$transaction(async (transaction) => {
      const preferences = await transaction.customerPreferences.upsert({
        where: { customerId },
        create: {
          customerId,
          language: customer.preferredLanguage,
          currency: customer.preferredCurrency,
          ...dto,
          ...(dto.currency ? { currency: dto.currency.toUpperCase() } : {}),
        },
        update: {
          ...dto,
          ...(dto.currency ? { currency: dto.currency.toUpperCase() } : {}),
        },
      });
      await recordCustomerChange(
        transaction,
        customerId,
        'customer.preferences.updated',
        'customer.preferences.updated',
        { preferenceId: preferences.id },
      );
      return preferences;
    });
  }

  private async findAddress(customerId: string, addressId: string) {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId, customer: { deletedAt: null } },
    });
    if (!address) throw new NotFoundException('Customer address not found');
    return address;
  }

  private async clearAddressDefaults(
    transaction: Prisma.TransactionClient,
    customerId: string,
    dto: Pick<CreateAddressDto, 'isDefaultShipping' | 'isDefaultBilling'>,
  ) {
    const updates: Promise<unknown>[] = [];
    if (dto.isDefaultShipping) {
      updates.push(
        transaction.customerAddress.updateMany({
          where: { customerId, isDefaultShipping: true },
          data: { isDefaultShipping: false },
        }),
      );
    }
    if (dto.isDefaultBilling) {
      updates.push(
        transaction.customerAddress.updateMany({
          where: { customerId, isDefaultBilling: true },
          data: { isDefaultBilling: false },
        }),
      );
    }
    await Promise.all(updates);
  }

  private rethrowKnownWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Identity, email, or mobile number is already registered');
    }
    throw error;
  }
}