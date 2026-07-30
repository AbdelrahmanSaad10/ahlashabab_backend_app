import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.role.findMany({
      include: {
        _count: { select: { adminUsers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: { select: { adminUsers: true } },
      },
    });

    if (!role) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'الدور غير موجود' },
      });
    }

    return role;
  }

  async create(dto: CreateRoleDto) {
    return this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissionsJson: dto.permissionsJson,
      },
    });
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);

    return this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.permissionsJson !== undefined && {
          permissionsJson: dto.permissionsJson,
        }),
      },
    });
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: { select: { adminUsers: true } },
      },
    });

    if (!role) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'الدور غير موجود' },
      });
    }

    if (role._count.adminUsers > 0) {
      throw new BadRequestException({
        error: {
          code: 'ROLE_IN_USE',
          message: 'لا يمكن حذف دور مرتبط بمستخدمين',
        },
      });
    }

    return this.prisma.role.delete({ where: { id } });
  }
}
