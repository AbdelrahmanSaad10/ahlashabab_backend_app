import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeEmail } from '../common/utils/email.util';
import { generateReference } from '../common/utils/reference.util';
import { CreateConsultationDto } from './dto/create-consultation.dto';

@Injectable()
export class ConsultationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateConsultationDto) {
    const normalizedEmail = normalizeEmail(dto.email);

    // Find-or-create user by normalized email
    const user = await this.prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {},
      create: {
        email: normalizedEmail,
        name: dto.name,
        phone: dto.phone,
        isGuest: true,
      },
    });

    const reference = generateReference('AS');

    const consultation = await this.prisma.consultationRequest.create({
      data: {
        reference,
        type: dto.type,
        name: dto.name,
        phone: dto.phone,
        whatsapp: dto.whatsapp,
        email: normalizedEmail,
        age: dto.age,
        governorate: dto.governorate,
        preferredChannel: dto.preferredChannel,
        preferredTime: dto.preferredTime,
        summary: dto.summary,
        extraFieldsJson: dto.extraFields ? (dto.extraFields as any) : undefined,
        status: 'جديد',
        userId: user.id,
      },
    });

    return {
      reference: consultation.reference,
      status: 'جديد',
    };
  }

  async findAll(filters: {
    type?: string;
    status?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const { type, status, q, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
        { reference: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.consultationRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.consultationRequest.count({ where }),
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

  async findByUserId(userId: string) {
    return this.prisma.consultationRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: string) {
    const consultation = await this.prisma.consultationRequest.findUnique({
      where: { id },
    });

    if (!consultation) {
      throw new NotFoundException('طلب الاستشارة غير موجود');
    }

    return this.prisma.consultationRequest.update({
      where: { id },
      data: { status },
    });
  }
}
