import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: {
    parentId?: string | null;
    page?: number;
    limit?: number;
    q?: string;
  }) {
    const { page = 1, limit = 20, q, parentId } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filter by parentId: if explicitly provided, use it; 'null' string means root categories
    if (parentId === 'null' || parentId === null) {
      where.parentId = null;
    } else if (parentId) {
      where.parentId = parentId;
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.serviceCategory.findMany({
        where,
        include: {
          children: {
            where: { active: true },
            orderBy: { sortOrder: 'asc' },
          },
          _count: { select: { services: true, children: true } },
        },
        orderBy: { sortOrder: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.serviceCategory.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { services: true, children: true } },
      },
    });

    if (!category) {
      throw new NotFoundException('التصنيف غير موجود');
    }

    return category;
  }

  async create(dto: CreateCategoryDto) {
    // Verify parent exists if parentId is provided
    if (dto.parentId) {
      const parent = await this.prisma.serviceCategory.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new BadRequestException('التصنيف الأب غير موجود');
      }
    }

    return this.prisma.serviceCategory.create({
      data: {
        name: dto.name,
        icon: dto.icon,
        description: dto.description,
        parentId: dto.parentId ?? null,
        active: dto.active ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: {
        children: true,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);

    // Verify parent exists if parentId is provided
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('لا يمكن أن يكون التصنيف أبًا لنفسه');
      }
      const parent = await this.prisma.serviceCategory.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new BadRequestException('التصنيف الأب غير موجود');
      }
    }

    return this.prisma.serviceCategory.update({
      where: { id },
      data: dto,
      include: {
        children: true,
      },
    });
  }

  async remove(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { children: true, services: true } },
      },
    });

    if (!category) {
      throw new NotFoundException('التصنيف غير موجود');
    }

    if (category._count.children > 0) {
      throw new BadRequestException(
        'لا يمكن حذف تصنيف يحتوي على تصنيفات فرعية',
      );
    }

    if (category._count.services > 0) {
      throw new BadRequestException('لا يمكن حذف تصنيف يحتوي على خدمات');
    }

    return this.prisma.serviceCategory.delete({ where: { id } });
  }

  async toggleActive(id: string) {
    const category = await this.findOne(id);

    return this.prisma.serviceCategory.update({
      where: { id },
      data: { active: !category.active },
    });
  }
}
