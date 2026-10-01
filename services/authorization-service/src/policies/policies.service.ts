import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePolicyDto) {
    const existing = await this.prisma.policy.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Policy with name "${dto.name}" already exists`);
    }
    return this.prisma.policy.create({
      data: {
        name: dto.name,
        description: dto.description,
        rules: (dto.rules as object[] | undefined) ?? [],
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll() {
    return this.prisma.policy.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    const policy = await this.prisma.policy.findUnique({ where: { id } });
    if (!policy) {
      throw new NotFoundException(`Policy with ID "${id}" not found`);
    }
    return policy;
  }

  async update(id: string, dto: UpdatePolicyDto) {
    await this.findById(id);

    if (dto.name) {
      const existing = await this.prisma.policy.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(
          `Policy with name "${dto.name}" already exists`,
        );
      }
    }

    return this.prisma.policy.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        rules: dto.rules as object[] | undefined,
        isActive: dto.isActive,
        version: { increment: 1 },
      },
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.policy.delete({ where: { id } });
    return { message: 'Policy deleted successfully' };
  }
}
