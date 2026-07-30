import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';

@Injectable()
export class VolunteersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVolunteerDto) {
    return this.prisma.volunteerApplication.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        age: dto.age,
        governorateId: dto.governorateId,
        interestsJson: dto.interests ?? [],
        availability: dto.availability,
        status: 'جديد',
      },
    });
  }

  async findAll(filters: {
    status?: string;
    governorateId?: number;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, governorateId, q, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (governorateId) {
      where.governorateId = governorateId;
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.volunteerApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.volunteerApplication.count({ where }),
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

  async updateStatus(id: string, status: string) {
    const application = await this.prisma.volunteerApplication.findUnique({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException('طلب التطوع غير موجود');
    }

    return this.prisma.volunteerApplication.update({
      where: { id },
      data: { status },
    });
  }

  async exportCsv() {
    const data = await this.prisma.volunteerApplication.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return data;
  }
}
