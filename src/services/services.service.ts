import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: {
    categoryId?: string;
    page?: number;
    limit?: number;
    q?: string;
  }) {
    const { page = 1, limit = 20, q, categoryId } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              specialization: true,
              avatarUrl: true,
            },
          },
          category: {
            select: { id: true, name: true, icon: true },
          },
          _count: { select: { formFields: true, bookings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.service.count({ where }),
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
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            specialization: true,
            bio: true,
            avatarUrl: true,
            rating: true,
            reviews: true,
          },
        },
        category: {
          select: { id: true, name: true, icon: true },
        },
        formFields: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('الخدمة غير موجودة');
    }

    return service;
  }

  async findByCategoryId(categoryId: string, params: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where: { categoryId, active: true },
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              specialization: true,
              avatarUrl: true,
            },
          },
          _count: { select: { formFields: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.service.count({ where: { categoryId, active: true } }),
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

  async getFormFields(serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        name: true,
        requireNationalId: true,
        formFields: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('الخدمة غير موجودة');
    }

    return service;
  }

  async create(dto: CreateServiceDto) {
    // Verify category exists
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new BadRequestException('التصنيف غير موجود');
    }

    // Verify provider exists
    const provider = await this.prisma.provider.findUnique({
      where: { id: dto.providerId },
    });
    if (!provider) {
      throw new BadRequestException('مقدم الخدمة غير موجود');
    }

    const { formFields, ...serviceData } = dto;

    return this.prisma.service.create({
      data: {
        ...serviceData,
        formFields: formFields
          ? {
              create: formFields.map((field, index) => ({
                key: field.key,
                label: field.label,
                type: field.type,
                required: field.required ?? false,
                hidden: field.hidden ?? false,
                optionsJson: field.optionsJson ?? null,
                sortOrder: field.sortOrder ?? index,
              })),
            }
          : undefined,
      },
      include: {
        provider: {
          select: { id: true, name: true },
        },
        category: {
          select: { id: true, name: true },
        },
        formFields: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async update(id: string, dto: UpdateServiceDto) {
    await this.findOne(id);

    // Verify category exists if categoryId is provided
    if (dto.categoryId) {
      const category = await this.prisma.serviceCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new BadRequestException('التصنيف غير موجود');
      }
    }

    // Verify provider exists if providerId is provided
    if (dto.providerId) {
      const provider = await this.prisma.provider.findUnique({
        where: { id: dto.providerId },
      });
      if (!provider) {
        throw new BadRequestException('مقدم الخدمة غير موجود');
      }
    }

    const { formFields, ...serviceData } = dto;

    // If formFields are provided, replace them all
    if (formFields) {
      await this.prisma.serviceFormField.deleteMany({
        where: { serviceId: id },
      });
    }

    return this.prisma.service.update({
      where: { id },
      data: {
        ...serviceData,
        formFields: formFields
          ? {
              create: formFields.map((field, index) => ({
                key: field.key,
                label: field.label,
                type: field.type,
                required: field.required ?? false,
                hidden: field.hidden ?? false,
                optionsJson: field.optionsJson ?? null,
                sortOrder: field.sortOrder ?? index,
              })),
            }
          : undefined,
      },
      include: {
        provider: {
          select: { id: true, name: true },
        },
        category: {
          select: { id: true, name: true },
        },
        formFields: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async remove(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { _count: { select: { bookings: true } } },
    });

    if (!service) {
      throw new NotFoundException('الخدمة غير موجودة');
    }

    // Delete form fields first (cascade should handle this, but be explicit)
    await this.prisma.serviceFormField.deleteMany({
      where: { serviceId: id },
    });

    return this.prisma.service.delete({ where: { id } });
  }
}
