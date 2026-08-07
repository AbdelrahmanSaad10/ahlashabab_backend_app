import 'reflect-metadata';
import { integrationDb } from './db';
import { ReportsService } from '../../src/reports/reports.service';

/**
 * Reports, checked against the DATABASE rather than against mocks.
 *
 * The audit rule is explicit: *"never mark reports completed until values are
 * compared against database data."* A mocked Prisma cannot satisfy that — it
 * proves the arithmetic runs, not that the answer is right. So this suite talks
 * to a real PostgreSQL, writes known rows, and compares the service's output to
 * SQL computed independently over the same rows.
 *
 * It runs against a disposable database (a CI service container, or a throwaway
 * local cluster). It never touches production: the URL must be supplied, and the
 * suite refuses to run without one rather than skipping quietly, because a
 * silently-skipped test is exactly the false green T-12 removed.
 */

const prisma = integrationDb();
const service = new ReportsService(prisma as any);

/** Unique marker so this suite only ever counts its own rows. */
const TAG = 'INT-REPORTS';

beforeAll(async () => {
  await prisma.$connect();
  await prisma.donation.deleteMany({ where: { donorName: { startsWith: TAG } } });
});

afterAll(async () => {
  await prisma.donation.deleteMany({ where: { donorName: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe('donationReport — values must match the database', () => {
  beforeAll(async () => {
    // Known rows, deliberately spanning two months, three methods and two
    // statuses so every branch of the aggregation is exercised.
    await prisma.donation.createMany({
      data: [
        { reference: `${TAG}-REF-a`, donorName: `${TAG}-a`, cause: 'دعم عام', amount: 100, method: 'تحويل بنكي', status: 'مكتمل', createdAt: new Date('2026-01-10T00:00:00Z') },
        { reference: `${TAG}-REF-b`, donorName: `${TAG}-b`, cause: 'دعم عام', amount: 250, method: 'تحويل بنكي', status: 'مكتمل', createdAt: new Date('2026-01-20T00:00:00Z') },
        { reference: `${TAG}-REF-c`, donorName: `${TAG}-c`, cause: 'دعم عام', amount: 400, method: 'فوري', status: 'مكتمل', createdAt: new Date('2026-02-05T00:00:00Z') },
        { reference: `${TAG}-REF-d`, donorName: `${TAG}-d`, cause: 'دعم عام', amount: 700, method: 'فودافون كاش', status: 'مكتمل', createdAt: new Date('2026-02-11T00:00:00Z') },
        // Must NOT be counted — only completed donations are real money.
        { reference: `${TAG}-REF-e`, donorName: `${TAG}-e`, cause: 'دعم عام', amount: 9999, method: 'فوري', status: 'قيد المراجعة', createdAt: new Date('2026-02-12T00:00:00Z') },
      ],
    });
  });

  const window = { from: '2026-01-01', to: '2026-02-28' };

  it('total equals SUM(amount) computed by SQL over the same window', async () => {
    const report = await service.donationReport(window.from, window.to);

    const [sql] = await prisma.$queryRawUnsafe<{ total: bigint | null; n: bigint }[]>(
      `SELECT COALESCE(SUM(amount),0)::bigint AS total, COUNT(*)::bigint AS n
         FROM donations
        WHERE status = 'مكتمل'
          AND created_at >= $1::timestamp AND created_at <= $2::timestamp
          AND donor_name LIKE $3`,
      window.from, window.to, `${TAG}%`,
    );

    expect(report.totalAmount).toBe(Number(sql.total));
    expect(report.totalCount).toBe(Number(sql.n));
    expect(report.totalAmount).toBe(1450); // 100+250+400+700
  });

  it('excludes donations that are not «مكتمل» — pending money is not income', async () => {
    const report = await service.donationReport(window.from, window.to);
    // 9999 would dominate the total if the status filter regressed.
    expect(report.totalAmount).not.toBe(1450 + 9999);
    expect(report.totalCount).toBe(4);
  });

  it('byMethod matches a SQL GROUP BY, method for method', async () => {
    const report = await service.donationReport(window.from, window.to);

    const sql = await prisma.$queryRawUnsafe<{ method: string; n: bigint; total: bigint }[]>(
      `SELECT method, COUNT(*)::bigint AS n, SUM(amount)::bigint AS total
         FROM donations
        WHERE status = 'مكتمل'
          AND created_at >= $1::timestamp AND created_at <= $2::timestamp
          AND donor_name LIKE $3
        GROUP BY method`,
      window.from, window.to, `${TAG}%`,
    );

    for (const row of sql) {
      const fromReport = report.byMethod.find((m) => m.method === row.method);
      expect(fromReport).toBeDefined();
      expect(fromReport!.count).toBe(Number(row.n));
      expect(fromReport!.amount).toBe(Number(row.total));
    }
    expect(report.byMethod).toHaveLength(sql.length);
  });

  it('byMonth buckets by calendar month, in order', async () => {
    const report = await service.donationReport(window.from, window.to);
    const months = report.byMonth.map((m) => m.month);
    expect(months).toEqual([...months].sort());
    expect(months).toEqual(['2026-01', '2026-02']);

    const jan = report.byMonth.find((m) => m.month === '2026-01')!;
    const feb = report.byMonth.find((m) => m.month === '2026-02')!;
    expect(jan.amount).toBe(350);   // 100 + 250
    expect(feb.amount).toBe(1100);  // 400 + 700
    expect(jan.amount + feb.amount).toBe(report.totalAmount);
  });

  it('respects the date window — a donation outside it is not counted', async () => {
    const narrow = await service.donationReport('2026-02-01', '2026-02-28');
    expect(narrow.totalAmount).toBe(1100);
    expect(narrow.byMonth.map((m) => m.month)).toEqual(['2026-02']);
  });

  it('returns zeros, not NaN or null, for an empty window', async () => {
    const empty = await service.donationReport('2030-01-01', '2030-01-31');
    expect(empty.totalAmount).toBe(0);
    expect(empty.totalCount).toBe(0);
    expect(empty.byMethod).toEqual([]);
    expect(empty.byMonth).toEqual([]);
  });
});
