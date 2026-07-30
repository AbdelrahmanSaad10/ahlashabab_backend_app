import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { governorate: true },
    });

    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    await this.findById(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        governorateId: dto.governorateId,
        bio: dto.bio,
      },
      include: { governorate: true },
    });
  }

  async getUserBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: {
        service: { include: { category: true } },
        provider: true,
        governorate: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async getUserDonations(userId: string) {
    return this.prisma.donation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserConsultations(userId: string) {
    return this.prisma.consultationRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addFavorite(userId: string, entityType: string, entityId: string) {
    return this.prisma.favorite.upsert({
      where: {
        userId_entityType_entityId: {
          userId,
          entityType,
          entityId,
        },
      },
      create: { userId, entityType, entityId },
      update: {},
    });
  }

  async removeFavorite(userId: string, entityType: string, entityId: string) {
    return this.prisma.favorite.deleteMany({
      where: { userId, entityType, entityId },
    });
  }

  async getFavorites(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
    });
  }

  async registerDeviceToken(
    userId: string,
    token: string,
    platform: string,
  ) {
    return this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  // ── Admin helpers ──────────────────────────────

  async findAll(filters: {
    q?: string;
    governorate?: string;
    isGuest?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { q, governorate, isGuest, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (governorate) {
      where.governorate = {
        name: { contains: governorate, mode: 'insensitive' },
      };
    }

    if (isGuest !== undefined) {
      where.isGuest = isGuest;
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { governorate: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
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

  async toggleBlock(id: string) {
    const user = await this.findById(id);

    return this.prisma.user.update({
      where: { id },
      data: { blocked: !user.blocked },
    });
  }

  async exportUsers() {
    const users = await this.prisma.user.findMany({
      include: { governorate: true },
      orderBy: { createdAt: 'desc' },
    });

    const header = 'الاسم,البريد الإلكتروني,الهاتف,المحافظة,ضيف,محظور,تاريخ التسجيل';
    const rows = users.map(
      (u) =>
        `"${u.name || ''}","${u.email}","${u.phone || ''}","${u.governorate?.name || ''}","${u.isGuest ? 'نعم' : 'لا'}","${u.blocked ? 'نعم' : 'لا'}","${u.createdAt.toISOString()}"`,
    );

    return [header, ...rows].join('\n');
  }
}
