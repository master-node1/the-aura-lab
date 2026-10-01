import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePermissionDto) {
    const existingName = await this.prisma.permission.findUnique({
      where: { name: dto.name },
    });
    if (existingName) {
      throw new ConflictException(
        `Permission with name "${dto.name}" already exists`,
      );
    }

    const existingCombo = await this.prisma.permission.findUnique({
      where: {
        resource_action: { resource: dto.resource, action: dto.action },
      },
    });
    if (existingCombo) {
      throw new ConflictException(
        `Permission for resource "${dto.resource}" and action "${dto.action}" already exists`,
      );
    }

    return this.prisma.permission.create({
      data: {
        name: dto.name,
        resource: dto.resource,
        action: dto.action,
        description: dto.description,
      },
    });
  }

  async findAll() {
    return this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  async findById(id: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
    });
    if (!permission) {
      throw new NotFoundException(`Permission with ID "${id}" not found`);
    }
    return permission;
  }

  async update(id: string, dto: UpdatePermissionDto) {
    await this.findById(id);

    if (dto.name) {
      const existingName = await this.prisma.permission.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (existingName) {
        throw new ConflictException(
          `Permission with name "${dto.name}" already exists`,
        );
      }
    }

    if (dto.resource || dto.action) {
      const current = await this.findById(id);
      const resource = dto.resource ?? current.resource;
      const action = dto.action ?? current.action;
      const existingCombo = await this.prisma.permission.findFirst({
        where: {
          resource,
          action,
          NOT: { id },
        },
      });
      if (existingCombo) {
        throw new ConflictException(
          `Permission for resource "${resource}" and action "${action}" already exists`,
        );
      }
    }

    return this.prisma.permission.update({
      where: { id },
      data: {
        name: dto.name,
        resource: dto.resource,
        action: dto.action,
        description: dto.description,
      },
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.permission.delete({ where: { id } });
    return { message: 'Permission deleted successfully' };
  }
}
