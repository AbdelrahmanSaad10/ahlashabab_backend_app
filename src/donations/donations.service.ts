import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import { DonationFiltersDto } from './dto/donation-filters.dto';
import { DonationStatus, DonationMethod } from '../common/constants/statuses';
import { generateReference } from '../common/utils/reference.util';

/** Manual payment methods that require admin review */
const MANUAL_METHODS: string[] = [DonationMethod.BANK_TRANSFER, DonationMethod.INSTAPAY];

/** Final (terminal) donation states that must never be regressed */
const FINAL_STATES: string[] = [DonationStatus.COMPLETED, DonationStatus.FAILED];

@Injectable()
export class DonationsService {
  private readonly logger = new Logger(DonationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Create a new donation.
   * SECURITY: status is NEVER accepted from the client; it is derived
   * from the payment method.
   */
  async create(dto: CreateDonationDto, userId?: string) {
    const status = MANUAL_METHODS.includes(dto.method)
      ? DonationStatus.PENDING_REVIEW
      : DonationStatus.PENDING_CONFIRMATION;

    const reference = generateReference('AS');

    const donation = await this.prisma.donation.create({
      data: {
        reference,
        donorName: dto.donorName,
        cause: dto.cause,
        amount: dto.amount,
        method: dto.method,
        recurring: dto.recurring,
        status,
        ...(userId ? { userId } : {}),
      },
    });

    this.events.emit('donation.created', {
      donationId: donation.id,
      reference: donation.reference,
      donorName: donation.donorName,
      amount: donation.amount,
      method: donation.method,
      status: donation.status,
      userId: donation.userId,
    });

    return donation;
  }

  /**
   * Look up a donation by its human-readable reference code.
   */
  async findByReference(reference: string) {
    const donation = await this.prisma.donation.findUnique({
      where: { reference },
    });

    if (!donation) {
      throw new NotFoundException('التبرع غير موجود');
    }

    return donation;
  }

  /**
   * Admin: list donations with optional filters + pagination.
   */
  async findAll(filters: DonationFiltersDto) {
    const { status, method, q, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (method) {
      where.method = method;
    }

    if (q) {
      where.OR = [
        { donorName: { contains: q, mode: 'insensitive' } },
        { reference: { contains: q, mode: 'insensitive' } },
        { cause: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.donation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.donation.count({ where }),
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

  /**
   * Fetch a user's donation history along with aggregate totals.
   */
  async findByUserId(userId: string) {
    const donations = await this.prisma.donation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const totals = await this.prisma.donation.aggregate({
      where: { userId, status: DonationStatus.COMPLETED },
      _sum: { amount: true },
      _count: true,
    });

    return {
      donations,
      totalAmount: totals._sum.amount ?? 0,
      totalCount: totals._count,
    };
  }

  /**
   * Admin: update the status of a donation.
   */
  async adminUpdateStatus(id: string, status: string, adminId: string) {
    const donation = await this.prisma.donation.findUnique({ where: { id } });

    if (!donation) {
      throw new NotFoundException('التبرع غير موجود');
    }

    if (FINAL_STATES.includes(donation.status)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_TRANSITION',
          message: `لا يمكن تغيير حالة تبرع في الحالة "${donation.status}"`,
        },
      });
    }

    const updated = await this.prisma.donation.update({
      where: { id },
      data: { status },
    });

    this.logger.log(
      `Admin ${adminId} changed donation ${id} status: ${donation.status} -> ${status}`,
    );

    if (status === DonationStatus.COMPLETED) {
      this.events.emit('donation.completed', {
        donationId: updated.id,
        reference: updated.reference,
        donorName: updated.donorName,
        amount: updated.amount,
        userId: updated.userId,
      });
    }

    return updated;
  }

  /**
   * Handle payment gateway webhook callback.
   * Idempotent: duplicate gatewayTxId returns 200 without error.
   */
  async handleWebhook(gatewayTxId: string, amount: number, status: string) {
    // Check if already processed (idempotent)
    const existing = await this.prisma.donation.findUnique({
      where: { gatewayTxId },
    });

    if (existing) {
      this.logger.log(`Webhook already processed for gatewayTxId=${gatewayTxId}`);
      return existing;
    }

    // Find pending donation matching this gateway callback
    // The gatewayTxId is not yet set, so we look for donations with status PENDING_CONFIRMATION
    // and match by amount. In practice the gateway sends us a reference; here we link by txId.
    // For the webhook flow: we update a donation that is still pending confirmation.
    const pendingDonations = await this.prisma.donation.findMany({
      where: {
        status: DonationStatus.PENDING_CONFIRMATION,
        amount,
        gatewayTxId: null,
      },
      orderBy: { createdAt: 'asc' },
      take: 1,
    });

    if (pendingDonations.length === 0) {
      throw new NotFoundException('لا يوجد تبرع مطابق');
    }

    const donation = pendingDonations[0];

    // Validate amount matches
    if (donation.amount !== amount) {
      throw new BadRequestException({
        error: {
          code: 'AMOUNT_MISMATCH',
          message: 'المبلغ غير مطابق',
        },
      });
    }

    // Never regress from final states
    if (FINAL_STATES.includes(donation.status)) {
      this.logger.warn(
        `Attempted to regress donation ${donation.id} from final state ${donation.status}`,
      );
      return donation;
    }

    const newStatus =
      status === 'success' ? DonationStatus.COMPLETED : DonationStatus.FAILED;

    const updated = await this.prisma.donation.update({
      where: { id: donation.id },
      data: {
        gatewayTxId,
        status: newStatus,
      },
    });

    if (newStatus === DonationStatus.COMPLETED) {
      this.events.emit('donation.completed', {
        donationId: updated.id,
        reference: updated.reference,
        donorName: updated.donorName,
        amount: updated.amount,
        userId: updated.userId,
      });
    }

    return updated;
  }
}
