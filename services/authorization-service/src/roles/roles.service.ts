import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async createRole(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Role with name "${dto.name}" already exists`);
    }
    return this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async findAll() {
    return this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
    if (!role) {
      throw new NotFoundException(`Role with ID "${id}" not found`);
    }
    return role;
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const role = await this.findById(id);
    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be modified');
    }
    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.role.findUnique({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException(`Role with name "${dto.name}" already exists`);
      }
    }
    return this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async deleteRole(id: string) {
    const role = await this.findById(id);
    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be deleted');
    }
    await this.prisma.role.delete({ where: { id } });
    return { message: `Role "${role.name}" deleted successfully` };
  }

  async assignPermission(roleId: string, permissionId: string) {
    await this.findById(roleId);
    const permission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
    });
    if (!permission) {
      throw new NotFoundException(`Permission with ID "${permissionId}" not found`);
    }
    const existing = await this.prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId } },
    });
    if (existing) {
      throw new ConflictException('Permission is already assigned to this role');
    }
    return this.prisma.rolePermission.create({
      data: { roleId, permissionId },
      include: { permission: true, role: true },
    });
  }

  async revokePermission(roleId: string, permissionId: string) {
    await this.findById(roleId);
    const existing = await this.prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId } },
    });
    if (!existing) {
      throw new NotFoundException('Permission is not assigned to this role');
    }
    await this.prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId, permissionId } },
    });
    return { message: 'Permission revoked from role successfully' };
  }

  async assignRoleToUser(roleId: string, dto: AssignRoleDto) {
    await this.findById(roleId);
    const existing = await this.prisma.userRole.findUnique({
      where: {
        identityId_roleId: { identityId: dto.identityId, roleId },
      },
    });
    if (existing) {
      throw new ConflictException('Role is already assigned to this identity');
    }
    return this.prisma.userRole.create({
      data: {
        identityId: dto.identityId,
        roleId,
        assignedBy: dto.assignedBy,
      },
      include: { role: true },
    });
  }

  async revokeRoleFromUser(roleId: string, identityId: string) {
    await this.findById(roleId);
    const existing = await this.prisma.userRole.findUnique({
      where: { identityId_roleId: { identityId, roleId } },
    });
    if (!existing) {
      throw new NotFoundException('Role is not assigned to this identity');
    }
    await this.prisma.userRole.delete({
      where: { identityId_roleId: { identityId, roleId } },
    });
    return { message: 'Role revoked from identity successfully' };
  }

  async getUserRoles(identityId: string) {
    return this.prisma.userRole.findMany({
      where: { identityId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
  }
}
