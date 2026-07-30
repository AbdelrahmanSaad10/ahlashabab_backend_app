import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, DonationStatus } from '../common/constants/statuses';
import { ReportFiltersDto } from './dto/report-filters.dto';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────
  // Booking Report
  // ──────────────────────────────────────────────

  async bookingReport(filters: ReportFiltersDto) {
    const { groupBy = 'status', from, to } = filters;

    const where: Prisma.BookingWhereInput = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    let groupByField: string;
    let selectRelation: object | undefined;

    switch (groupBy) {
      case 'category':
        groupByField = 'service';
        selectRelation = {
          service: { select: { category: { select: { id: true, name: true } } } },
        };
        break;
      case 'provider':
        groupByField = 'providerId';
        break;
      case 'governorate':
        groupByField = 'governorateId';
        break;
      case 'status':
      default:
        groupByField = 'status';
        break;
    }

    // For category grouping, we need a different approach since groupBy doesn't support nested relations
    if (groupBy === 'category') {
      const bookings = await this.prisma.booking.findMany({
        where,
        include: {
          service: {
            select: { categoryId: true, category: { select: { id: true, name: true } } },
          },
        },
      });

      const grouped: Record<string, { label: string; count: number }> = {};
      for (const booking of bookings) {
        const catId = booking.service.categoryId;
        const catName = booking.service.category.name;
        if (!grouped[catId]) {
          grouped[catId] = { label: catName, count: 0 };
        }
        grouped[catId].count++;
      }

      return Object.entries(grouped).map(([id, { label, count }]) => ({
        id,
        label,
        count,
      }));
    }

    if (groupBy === 'provider') {
      const bookings = await this.prisma.booking.findMany({
        where,
        include: {
          provider: { select: { id: true, name: true } },
        },
      });

      const grouped: Record<string, { label: string; count: number }> = {};
      for (const booking of bookings) {
        const pid = booking.providerId;
        const pName = booking.provider.name;
        if (!grouped[pid]) {
          grouped[pid] = { label: pName, count: 0 };
        }
        grouped[pid].count++;
      }

      return Object.entries(grouped).map(([id, { label, count }]) => ({
        id,
        label,
        count,
      }));
    }

    if (groupBy === 'governorate') {
      const bookings = await this.prisma.booking.findMany({
        where,
        include: {
          governorate: { select: { id: true, name: true } },
        },
      });

      const grouped: Record<string, { label: string; count: number }> = {};
      for (const booking of bookings) {
        const gId = booking.governorateId ? String(booking.governorateId) : 'unknown';
        const gName = booking.governorate?.name ?? 'غير محدد';
        if (!grouped[gId]) {
          grouped[gId] = { label: gName, count: 0 };
        }
        grouped[gId].count++;
      }

      return Object.entries(grouped).map(([id, { label, count }]) => ({
        id,
        label,
        count,
      }));
    }

    // Default: group by status
    const bookings = await this.prisma.booking.findMany({ where });
    const grouped: Record<string, number> = {};
    for (const booking of bookings) {
      grouped[booking.status] = (grouped[booking.status] ?? 0) + 1;
    }

    return Object.entries(grouped).map(([label, count]) => ({
      label,
      count,
    }));
  }

  // ──────────────────────────────────────────────
  // Utilization Report
  // ──────────────────────────────────────────────

  async utilizationReport(from?: string, to?: string) {
    const where: Prisma.BookingWhereInput = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      select: { status: true, providerId: true },
    });

    const total = bookings.length;
    const completed = bookings.filter(
      (b) => b.status === BookingStatus.COMPLETED,
    ).length;
    const noShow = bookings.filter(
      (b) => b.status === BookingStatus.NO_SHOW,
    ).length;

    const providerIds = new Set(bookings.map((b) => b.providerId));
    const providerCount = providerIds.size;

    return {
      totalBookings: total,
      completionRate: total > 0 ? +(completed / total).toFixed(4) : 0,
      noShowRate: total > 0 ? +(noShow / total).toFixed(4) : 0,
      avgBookingsPerProvider:
        providerCount > 0 ? +(total / providerCount).toFixed(2) : 0,
    };
  }

  // ──────────────────────────────────────────────
  // Donation Report
  // ──────────────────────────────────────────────

  async donationReport(from?: string, to?: string) {
    const where: Prisma.DonationWhereInput = {
      status: DonationStatus.COMPLETED,
    };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const donations = await this.prisma.donation.findMany({
      where,
      select: { amount: true, method: true, createdAt: true },
    });

    const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
    const totalCount = donations.length;

    // By method
    const byMethod: Record<string, { count: number; amount: number }> = {};
    for (const d of donations) {
      if (!byMethod[d.method]) {
        byMethod[d.method] = { count: 0, amount: 0 };
      }
      byMethod[d.method].count++;
      byMethod[d.method].amount += d.amount;
    }

    // By month
    const byMonth: Record<string, { count: number; amount: number }> = {};
    for (const d of donations) {
      const month = d.createdAt.toISOString().slice(0, 7); // YYYY-MM
      if (!byMonth[month]) {
        byMonth[month] = { count: 0, amount: 0 };
      }
      byMonth[month].count++;
      byMonth[month].amount += d.amount;
    }

    return {
      totalAmount,
      totalCount,
      byMethod: Object.entries(byMethod).map(([method, data]) => ({
        method,
        ...data,
      })),
      byMonth: Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          ...data,
        })),
    };
  }

  // ──────────────────────────────────────────────
  // User Report
  // ──────────────────────────────────────────────

  async userReport() {
    const [totalUsers, guestCount, usersWithGovernorate] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isGuest: true } }),
      this.prisma.user.findMany({
        where: { governorateId: { not: null } },
        include: {
          governorate: true,
        },
      }),
    ]);

    const registeredCount = totalUsers - guestCount;

    // By governorate
    const byGovernorate: Record<string, { name: string; count: number }> = {};
    for (const user of usersWithGovernorate as any[]) {
      const gId = String(user.governorateId);
      const gName = user.governorate?.name ?? 'غير محدد';
      if (!byGovernorate[gId]) {
        byGovernorate[gId] = { name: gName, count: 0 };
      }
      byGovernorate[gId].count++;
    }

    return {
      total: totalUsers,
      guests: guestCount,
      registered: registeredCount,
      byGovernorate: Object.entries(byGovernorate).map(
        ([id, { name, count }]) => ({
          governorateId: parseInt(id, 10),
          name,
          count,
        }),
      ),
    };
  }

  // ──────────────────────────────────────────────
  // Export Data
  // ──────────────────────────────────────────────

  async exportData(
    type: string,
    format: string,
    filters: ReportFiltersDto,
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    let data: any[];
    let columns: { header: string; key: string; width: number }[];

    switch (type) {
      case 'bookings': {
        const where: Prisma.BookingWhereInput = {};
        if (filters.from || filters.to) {
          where.createdAt = {};
          if (filters.from) where.createdAt.gte = new Date(filters.from);
          if (filters.to) where.createdAt.lte = new Date(filters.to);
        }

        const bookings = await this.prisma.booking.findMany({
          where,
          include: {
            service: { select: { name: true } },
            provider: { select: { name: true } },
            governorate: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        data = bookings.map((b) => ({
          reference: b.reference,
          applicantName: b.applicantName,
          phone: b.phone,
          service: b.service.name,
          provider: b.provider.name,
          governorate: b.governorate?.name ?? '',
          date: b.date.toISOString().split('T')[0],
          timeSlot: b.timeSlot,
          status: b.status,
          createdAt: b.createdAt.toISOString(),
        }));

        columns = [
          { header: 'المرجع', key: 'reference', width: 15 },
          { header: 'الاسم', key: 'applicantName', width: 25 },
          { header: 'الهاتف', key: 'phone', width: 15 },
          { header: 'الخدمة', key: 'service', width: 25 },
          { header: 'مقدم الخدمة', key: 'provider', width: 20 },
          { header: 'المحافظة', key: 'governorate', width: 15 },
          { header: 'التاريخ', key: 'date', width: 12 },
          { header: 'الوقت', key: 'timeSlot', width: 10 },
          { header: 'الحالة', key: 'status', width: 15 },
          { header: 'تاريخ الإنشاء', key: 'createdAt', width: 20 },
        ];
        break;
      }

      case 'donations': {
        const where: Prisma.DonationWhereInput = {};
        if (filters.from || filters.to) {
          where.createdAt = {};
          if (filters.from) where.createdAt.gte = new Date(filters.from);
          if (filters.to) where.createdAt.lte = new Date(filters.to);
        }

        const donations = await this.prisma.donation.findMany({
          where,
          orderBy: { createdAt: 'desc' },
        });

        data = donations.map((d) => ({
          reference: d.reference,
          donorName: d.donorName,
          cause: d.cause,
          amount: d.amount,
          method: d.method,
          status: d.status,
          createdAt: d.createdAt.toISOString(),
        }));

        columns = [
          { header: 'المرجع', key: 'reference', width: 15 },
          { header: 'المتبرع', key: 'donorName', width: 25 },
          { header: 'الغرض', key: 'cause', width: 20 },
          { header: 'المبلغ', key: 'amount', width: 12 },
          { header: 'الطريقة', key: 'method', width: 15 },
          { header: 'الحالة', key: 'status', width: 15 },
          { header: 'تاريخ الإنشاء', key: 'createdAt', width: 20 },
        ];
        break;
      }

      case 'users': {
        const users = await this.prisma.user.findMany({
          include: {
            governorate: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        data = users.map((u) => ({
          name: u.name ?? '',
          email: u.email,
          phone: u.phone ?? '',
          governorate: u.governorate?.name ?? '',
          isGuest: u.isGuest ? 'نعم' : 'لا',
          createdAt: u.createdAt.toISOString(),
        }));

        columns = [
          { header: 'الاسم', key: 'name', width: 25 },
          { header: 'البريد', key: 'email', width: 30 },
          { header: 'الهاتف', key: 'phone', width: 15 },
          { header: 'المحافظة', key: 'governorate', width: 15 },
          { header: 'زائر', key: 'isGuest', width: 8 },
          { header: 'تاريخ التسجيل', key: 'createdAt', width: 20 },
        ];
        break;
      }

      default:
        throw new BadRequestException({
          error: {
            code: 'INVALID_EXPORT_TYPE',
            message: 'نوع التصدير غير صالح',
          },
        });
    }

    switch (format) {
      case 'csv':
        return this.generateCsv(data, columns, type);
      case 'xlsx':
        return this.generateXlsx(data, columns, type);
      case 'pdf':
        return this.generatePdf(data, columns, type);
      default:
        throw new BadRequestException({
          error: {
            code: 'INVALID_FORMAT',
            message: 'صيغة التصدير غير صالحة',
          },
        });
    }
  }

  // ── CSV ──

  private async generateCsv(
    data: any[],
    columns: { header: string; key: string }[],
    type: string,
  ) {
    const header = columns.map((c) => c.header).join(',');
    const rows = data.map((row) =>
      columns
        .map((c) => {
          const val = String(row[c.key] ?? '').replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(','),
    );

    const csv = [header, ...rows].join('\n');
    // Add BOM for Excel Arabic support
    const bom = '\uFEFF';
    const buffer = Buffer.from(bom + csv, 'utf-8');

    return {
      buffer,
      contentType: 'text/csv; charset=utf-8',
      filename: `${type}-export.csv`,
    };
  }

  // ── XLSX ──

  private async generateXlsx(
    data: any[],
    columns: { header: string; key: string; width: number }[],
    type: string,
  ) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('تقرير');

    sheet.columns = columns;
    sheet.addRows(data);

    // Style the header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    return {
      buffer,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${type}-export.xlsx`,
    };
  }

  // ── PDF ──

  private async generatePdf(
    data: any[],
    columns: { header: string; key: string }[],
    type: string,
  ) {
    return new Promise<{ buffer: Buffer; contentType: string; filename: string }>(
      (resolve, reject) => {
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            buffer,
            contentType: 'application/pdf',
            filename: `${type}-export.pdf`,
          });
        });
        doc.on('error', reject);

        // Title
        doc.fontSize(16).text(`${type} Report`, { align: 'center' });
        doc.moveDown();

        // Table headers
        doc.fontSize(8).font('Helvetica-Bold');
        const startX = 30;
        let y = doc.y;
        const colWidth = Math.floor(
          (doc.page.width - 60) / columns.length,
        );

        columns.forEach((col, i) => {
          doc.text(col.header, startX + i * colWidth, y, {
            width: colWidth,
            align: 'center',
          });
        });

        doc.font('Helvetica').fontSize(7);
        y += 20;

        // Table rows
        for (const row of data) {
          if (y > doc.page.height - 50) {
            doc.addPage();
            y = 30;
          }

          columns.forEach((col, i) => {
            const val = String(row[col.key] ?? '');
            doc.text(val, startX + i * colWidth, y, {
              width: colWidth,
              align: 'center',
            });
          });
          y += 15;
        }

        doc.end();
      },
    );
  }
}
