import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  generateAvailableSlots,
  DayAvailability,
  ScheduleEntry,
} from '../common/utils/slot.util';
import { generateReference } from '../common/utils/reference.util';
import { BookingStatus } from '../common/constants/statuses';
import { validateTransition } from './booking-status.machine';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingFiltersDto } from './dto/booking-filters.dto';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  // ──────────────────────────────────────────────
  // Availability
  // ──────────────────────────────────────────────

  async getAvailability(
    serviceId: string,
    from: string,
    to: string,
  ): Promise<DayAvailability[]> {
    // 1. Get service with its provider
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: { provider: true },
    });

    if (!service) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'الخدمة غير موجودة' },
      });
    }

    if (!service.provider.active || !service.provider.acceptingBookings) {
      return [];
    }

    const providerId = service.providerId;

    // 2. Get provider schedules (weekly template)
    const schedules = await this.prisma.providerSchedule.findMany({
      where: { providerId },
    });

    const scheduleEntries: ScheduleEntry[] = schedules.map((s) => ({
      weekday: s.weekday,
      startTime: s.startTime,
      endTime: s.endTime,
      slotMinutes: s.slotMinutes,
    }));

    // 3. Get provider unavailable dates in range
    const unavailable = await this.prisma.providerUnavailableDate.findMany({
      where: {
        providerId,
        date: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
    });

    const unavailableDates = unavailable.map(
      (u) => u.date.toISOString().split('T')[0],
    );

    // 4. Get existing non-cancelled bookings in range
    const existingBookings = await this.prisma.booking.findMany({
      where: {
        providerId,
        date: {
          gte: new Date(from),
          lte: new Date(to),
        },
        status: { not: BookingStatus.CANCELLED },
      },
      select: { date: true, timeSlot: true },
    });

    // Build a map of date → set of booked slots
    const bookedSlots = new Map<string, Set<string>>();
    for (const b of existingBookings) {
      const dateStr = b.date.toISOString().split('T')[0];
      if (!bookedSlots.has(dateStr)) {
        bookedSlots.set(dateStr, new Set());
      }
      bookedSlots.get(dateStr)!.add(b.timeSlot);
    }

    // 5. Generate available slots
    return generateAvailableSlots(
      scheduleEntries,
      unavailableDates,
      bookedSlots,
      from,
      to,
    );
  }

  // ──────────────────────────────────────────────
  // Create booking
  // ──────────────────────────────────────────────

  async create(dto: CreateBookingDto, userId?: string) {
    // Look up the service to get its provider
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
      include: { provider: true },
    });

    if (!service) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'الخدمة غير موجودة' },
      });
    }

    if (!service.active) {
      throw new BadRequestException({
        error: { code: 'SERVICE_INACTIVE', message: 'الخدمة غير متاحة حاليا' },
      });
    }

    if (!service.provider.active || !service.provider.acceptingBookings) {
      throw new BadRequestException({
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: 'مقدم الخدمة غير متاح حاليا',
        },
      });
    }

    const providerId = service.providerId;
    const bookingDate = new Date(dto.date);

    // Run inside a serializable transaction to prevent double-booking
    const booking = await this.prisma.$transaction(
      async (tx) => {
        // Check for slot conflict: same provider + date + time slot with non-cancelled status
        const conflict = await tx.booking.findFirst({
          where: {
            providerId,
            date: bookingDate,
            timeSlot: dto.timeSlot,
            status: { not: BookingStatus.CANCELLED },
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

        // Check duplicate: same phone + service + date with non-cancelled status
        const duplicate = await tx.booking.findFirst({
          where: {
            phone: dto.phone,
            serviceId: dto.serviceId,
            date: bookingDate,
            status: { not: BookingStatus.CANCELLED },
          },
        });

        if (duplicate) {
          throw new ConflictException({
            error: {
              code: 'DUPLICATE_BOOKING',
              message: 'يوجد حجز بالفعل بنفس رقم الهاتف لهذه الخدمة في نفس اليوم',
            },
          });
        }

        // Generate a unique reference
        const reference = generateReference('AS');

        // Create the booking
        return tx.booking.create({
          data: {
            reference,
            serviceId: dto.serviceId,
            providerId,
            userId: userId ?? null,
            applicantName: dto.applicantName,
            phone: dto.phone,
            age: dto.age,
            gender: dto.gender,
            governorateId: dto.governorateId,
            city: dto.city,
            nationalId: dto.nationalId,
            notes: dto.notes,
            date: bookingDate,
            timeSlot: dto.timeSlot,
            status: BookingStatus.PENDING,
            extraFieldsJson: dto.extraFields ? (dto.extraFields as any) : Prisma.JsonNull,
          },
          include: {
            service: { select: { id: true, name: true } },
            provider: { select: { id: true, name: true } },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    // Emit event outside transaction
    this.events.emit('booking.created', booking);
    this.logger.log(`Booking created: ${booking.reference}`);

    return booking;
  }

  // ──────────────────────────────────────────────
  // Lookup by reference
  // ──────────────────────────────────────────────

  async findByReference(reference: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { reference },
      include: {
        service: { select: { id: true, name: true, categoryId: true } },
        provider: { select: { id: true, name: true, specialization: true } },
        governorate: { select: { id: true, name: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'الحجز غير موجود' },
      });
    }

    return booking;
  }

  // ──────────────────────────────────────────────
  // Admin listing with filters
  // ──────────────────────────────────────────────

  async findAll(filters: BookingFiltersDto) {
    const { status, categoryId, providerId, governorateId, date, q, page, limit } =
      filters;

    const where: Prisma.BookingWhereInput = {};

    if (status) where.status = status;
    if (providerId) where.providerId = providerId;
    if (governorateId) where.governorateId = governorateId;
    if (date) where.date = new Date(date);
    if (categoryId) {
      where.service = { categoryId };
    }

    // Free-text search on applicantName, phone, or reference
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
          provider: { select: { id: true, name: true } },
          governorate: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
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

  // ──────────────────────────────────────────────
  // Update status (admin)
  // ──────────────────────────────────────────────

  async updateStatus(id: string, newStatus: string, adminId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'الحجز غير موجود' },
      });
    }

    // Validate the transition using the state machine
    validateTransition(booking.status, newStatus);

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: newStatus },
      include: {
        service: { select: { id: true, name: true } },
        provider: { select: { id: true, name: true } },
      },
    });

    this.events.emit('booking.statusChanged', {
      booking: updated,
      previousStatus: booking.status,
      newStatus,
      adminId,
    });

    this.logger.log(
      `Booking ${booking.reference} status: ${booking.status} → ${newStatus} by admin ${adminId}`,
    );

    return updated;
  }

  // ──────────────────────────────────────────────
  // Reschedule (change date/time without changing status)
  // ──────────────────────────────────────────────

  async reschedule(id: string, date: string, timeSlot: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'الحجز غير موجود' },
      });
    }

    const newDate = new Date(date);

    // Check if the new slot is available
    const conflict = await this.prisma.booking.findFirst({
      where: {
        providerId: booking.providerId,
        date: newDate,
        timeSlot,
        status: { not: BookingStatus.CANCELLED },
        id: { not: id }, // Exclude current booking
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

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { date: newDate, timeSlot },
      include: {
        service: { select: { id: true, name: true } },
        provider: { select: { id: true, name: true } },
      },
    });

    this.events.emit('booking.rescheduled', {
      booking: updated,
      previousDate: booking.date,
      previousTimeSlot: booking.timeSlot,
    });

    this.logger.log(
      `Booking ${booking.reference} rescheduled to ${date} ${timeSlot}`,
    );

    return updated;
  }

  // ──────────────────────────────────────────────
  // Calendar view (provider bookings grouped by date)
  // ──────────────────────────────────────────────

  async getCalendar(providerId: string, from: string, to: string) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        providerId,
        date: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      include: {
        service: { select: { id: true, name: true } },
      },
      orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
    });

    // Group by date
    const grouped: Record<string, typeof bookings> = {};
    for (const booking of bookings) {
      const dateStr = booking.date.toISOString().split('T')[0];
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(booking);
    }

    return grouped;
  }

  // ──────────────────────────────────────────────
  // User's bookings
  // ──────────────────────────────────────────────

  async getUserBookings(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [upcoming, past] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where: {
          userId,
          date: { gte: today },
          status: {
            in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
          },
        },
        include: {
          service: { select: { id: true, name: true } },
          provider: { select: { id: true, name: true } },
        },
        orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
      }),
      this.prisma.booking.findMany({
        where: {
          userId,
          OR: [
            { date: { lt: today } },
            {
              status: {
                in: [
                  BookingStatus.COMPLETED,
                  BookingStatus.CANCELLED,
                  BookingStatus.NO_SHOW,
                ],
              },
            },
          ],
        },
        include: {
          service: { select: { id: true, name: true } },
          provider: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return { upcoming, past };
  }

  // ──────────────────────────────────────────────
  // Export (returns raw data; controller handles format)
  // ──────────────────────────────────────────────

  async getExportData(filters: BookingFiltersDto) {
    const { status, categoryId, providerId, governorateId, date, q } = filters;

    const where: Prisma.BookingWhereInput = {};

    if (status) where.status = status;
    if (providerId) where.providerId = providerId;
    if (governorateId) where.governorateId = governorateId;
    if (date) where.date = new Date(date);
    if (categoryId) {
      where.service = { categoryId };
    }
    if (q) {
      where.OR = [
        { applicantName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { reference: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.booking.findMany({
      where,
      include: {
        service: { select: { name: true } },
        provider: { select: { name: true } },
        governorate: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
