import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import {
  BookingStatus,
  BOOKING_TRANSITIONS,
} from '../common/constants/statuses';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiPaginationQuery } from '../common/swagger/api-pagination-query.decorator';

interface AdminUserPayload {
  id: string;
  providerId?: string | null;
}

@ApiTags('Provider portal')
@ApiBearerAuth('access-token')
@Controller('me/provider')
export class ProviderPortalController {
  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  private getProviderId(adminUser: AdminUserPayload): string {
    if (!adminUser?.providerId) {
      throw new ForbiddenException({
        error: {
          code: 'NOT_PROVIDER',
          message: 'حسابك غير مرتبط بمقدم خدمة',
        },
      });
    }
    return adminUser.providerId;
  }

  private canTransition(from: string, to: string): boolean {
    const allowed = BOOKING_TRANSITIONS[from];
    if (!allowed) return false;
    return allowed.includes(to);
  }

  private validateTransition(from: string, to: string): void {
    if (!this.canTransition(from, to)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_TRANSITION',
          message: `لا يمكن تغيير الحالة من "${from}" إلى "${to}"`,
        },
      });
    }
  }

  // ──────────────────────────────────────────────
  // GET /me/provider/bookings
  // ──────────────────────────────────────────────

  @ApiOperation({
    summary: "List the signed-in provider's bookings",
    description: 'Scoped to the provider linked to the calling admin account (AdminUser.providerId). Answers 403 for an admin with no linked provider.',
  })
  @ApiQuery({ name: 'status', required: false })
  @ApiPaginationQuery()
  @Get('bookings')
  async getBookings(
    @CurrentAdmin() adminUser: AdminUserPayload,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const providerId = this.getProviderId(adminUser);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    const where: Prisma.BookingWhereInput = { providerId };

    if (status) where.status = status;

    if (q) {
      where.OR = [
        { applicantName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { reference: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: {
          service: { select: { id: true, name: true } },
          governorate: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  // ──────────────────────────────────────────────
  // PATCH /me/provider/bookings/:id/status
  // ──────────────────────────────────────────────

  @ApiOperation({ summary: 'Update the status of one of your bookings' })
  @ApiBody({ schema: { type: 'object', required: ['status'], properties: { status: { type: 'string' } } } })
  @Patch('bookings/:id/status')
  async updateBookingStatus(
    @CurrentAdmin() adminUser: AdminUserPayload,
    @Param('id') id: string,
    @Body('status') newStatus: string,
  ) {
    const providerId = this.getProviderId(adminUser);

    const booking = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'الحجز غير موجود' },
      });
    }

    if (booking.providerId !== providerId) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'هذا الحجز لا يخص مقدم الخدمة الخاص بك',
        },
      });
    }

    this.validateTransition(booking.status, newStatus);

    return this.prisma.booking.update({
      where: { id },
      data: { status: newStatus },
      include: {
        service: { select: { id: true, name: true } },
        governorate: { select: { id: true, name: true } },
      },
    });
  }

  // ──────────────────────────────────────────────
  // PATCH /me/provider/bookings/:id/schedule
  // ──────────────────────────────────────────────

  @ApiOperation({ summary: 'Reschedule one of your bookings' })
  @ApiBody({ schema: { type: 'object', required: ['date', 'timeSlot'], properties: { date: { type: 'string', format: 'date' }, timeSlot: { type: 'string' } } } })
  @Patch('bookings/:id/schedule')
  async rescheduleBooking(
    @CurrentAdmin() adminUser: AdminUserPayload,
    @Param('id') id: string,
    @Body('date') date: string,
    @Body('timeSlot') timeSlot: string,
  ) {
    const providerId = this.getProviderId(adminUser);

    const booking = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'الحجز غير موجود' },
      });
    }

    if (booking.providerId !== providerId) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'هذا الحجز لا يخص مقدم الخدمة الخاص بك',
        },
      });
    }

    const newDate = new Date(date);

    // Check slot availability
    const conflict = await this.prisma.booking.findFirst({
      where: {
        providerId,
        date: newDate,
        timeSlot,
        status: { not: BookingStatus.CANCELLED },
        id: { not: id },
      },
    });

    if (conflict) {
      throw new ConflictException({
        error: {
          code: 'SLOT_TAKEN',
          message: 'هذا الموعد محجوز بالفعل، يرجى اختيار موعد آخر',
        },
      });
    }

    return this.prisma.booking.update({
      where: { id },
      data: { date: newDate, timeSlot },
      include: {
        service: { select: { id: true, name: true } },
        governorate: { select: { id: true, name: true } },
      },
    });
  }

  // ──────────────────────────────────────────────
  // GET /me/provider/overview
  // ──────────────────────────────────────────────

  @ApiOperation({ summary: 'Dashboard counters for the signed-in provider' })
  @Get('overview')
  async getOverview(@CurrentAdmin() adminUser: AdminUserPayload) {
    const providerId = this.getProviderId(adminUser);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [upcoming, todayCount, newCount, completed, cancelled] =
      await this.prisma.$transaction([
        // Upcoming: future confirmed bookings
        this.prisma.booking.count({
          where: {
            providerId,
            date: { gt: today },
            status: {
              in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
            },
          },
        }),
        // Today: bookings for today
        this.prisma.booking.count({
          where: {
            providerId,
            date: {
              gte: today,
              lt: tomorrow,
            },
          },
        }),
        // New: pending bookings
        this.prisma.booking.count({
          where: {
            providerId,
            status: BookingStatus.PENDING,
          },
        }),
        // Completed
        this.prisma.booking.count({
          where: {
            providerId,
            status: BookingStatus.COMPLETED,
          },
        }),
        // Cancelled
        this.prisma.booking.count({
          where: {
            providerId,
            status: BookingStatus.CANCELLED,
          },
        }),
      ]);

    return {
      upcoming,
      today: todayCount,
      new: newCount,
      completed,
      cancelled,
    };
  }
}
