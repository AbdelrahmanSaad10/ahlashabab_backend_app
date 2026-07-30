import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: { page?: number; limit?: number; q?: string } = {}) {
    const { page = 1, limit = 20, q } = params;
    const skip = (page - 1) * limit;

    const where: any = { active: true };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { specialization: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.provider.findMany({
        where,
        include: {
          schedules: {
            orderBy: { weekday: 'asc' },
          },
          _count: { select: { services: true, bookings: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.provider.count({ where }),
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

  async findAllAdmin(params: { page?: number; limit?: number; q?: string } = {}) {
    const { page = 1, limit = 20, q } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { specialization: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.provider.findMany({
        where,
        include: {
          schedules: {
            orderBy: { weekday: 'asc' },
          },
          _count: { select: { services: true, bookings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.provider.count({ where }),
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
    const provider = await this.prisma.provider.findUnique({
      where: { id },
      include: {
        schedules: {
          orderBy: { weekday: 'asc' },
        },
        services: {
          where: { active: true },
          include: {
            category: {
              select: { id: true, name: true, icon: true },
            },
          },
        },
        unavailableDates: {
          orderBy: { date: 'asc' },
        },
        _count: { select: { services: true, bookings: true } },
      },
    });

    if (!provider) {
      throw new NotFoundException('مقدم الخدمة غير موجود');
    }

    return provider;
  }

  async create(dto: CreateProviderDto) {
    return this.prisma.provider.create({
      data: {
        name: dto.name,
        specialization: dto.specialization,
        bio: dto.bio,
        yearsExperience: dto.yearsExperience,
        rating: dto.rating ?? 0,
        avatarUrl: dto.avatarUrl,
        active: dto.active ?? true,
      },
      include: {
        schedules: true,
      },
    });
  }

  async update(id: string, dto: Partial<CreateProviderDto>) {
    await this.findOne(id);

    return this.prisma.provider.update({
      where: { id },
      data: dto,
      include: {
        schedules: true,
      },
    });
  }

  async remove(id: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
      include: {
        _count: { select: { services: true, bookings: true } },
      },
    });

    if (!provider) {
      throw new NotFoundException('مقدم الخدمة غير موجود');
    }

    // Delete related records first
    await this.prisma.providerSchedule.deleteMany({
      where: { providerId: id },
    });
    await this.prisma.providerUnavailableDate.deleteMany({
      where: { providerId: id },
    });

    return this.prisma.provider.delete({ where: { id } });
  }

  async setSchedule(id: string, dto: UpdateScheduleDto) {
    await this.findOne(id);

    // Replace all existing schedules
    await this.prisma.providerSchedule.deleteMany({
      where: { providerId: id },
    });

    if (dto.schedules.length > 0) {
      await this.prisma.providerSchedule.createMany({
        data: dto.schedules.map((schedule) => ({
          providerId: id,
          weekday: schedule.weekday,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          slotMinutes: schedule.slotMinutes,
        })),
      });
    }

    return this.prisma.provider.findUnique({
      where: { id },
      include: {
        schedules: {
          orderBy: { weekday: 'asc' },
        },
      },
    });
  }

  async addUnavailableDate(id: string, dateStr: string) {
    await this.findOne(id);

    const date = new Date(dateStr);

    // Check if already exists
    const existing = await this.prisma.providerUnavailableDate.findUnique({
      where: {
        providerId_date: {
          providerId: id,
          date,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('هذا التاريخ محجوب بالفعل');
    }

    return this.prisma.providerUnavailableDate.create({
      data: {
        providerId: id,
        date,
      },
    });
  }

  async removeUnavailableDate(id: string, dateStr: string) {
    await this.findOne(id);

    const date = new Date(dateStr);

    const existing = await this.prisma.providerUnavailableDate.findUnique({
      where: {
        providerId_date: {
          providerId: id,
          date,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('التاريخ غير موجود في قائمة التواريخ المحجوبة');
    }

    return this.prisma.providerUnavailableDate.delete({
      where: { id: existing.id },
    });
  }

  async toggleAcceptingBookings(id: string) {
    const provider = await this.findOne(id);

    return this.prisma.provider.update({
      where: { id },
      data: { acceptingBookings: !provider.acceptingBookings },
    });
  }

  async assignService(providerId: string, serviceId: string) {
    // Verify provider exists
    await this.findOne(providerId);

    // Verify service exists
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException('الخدمة غير موجودة');
    }

    // Update the service's provider
    return this.prisma.service.update({
      where: { id: serviceId },
      data: { providerId },
      include: {
        provider: {
          select: { id: true, name: true },
        },
        category: {
          select: { id: true, name: true },
        },
      },
    });
  }
}
