import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';

/**
 * The health check, which could not fail.
 *
 * This endpoint returned `{ message: 'ok' }` unconditionally — it checked
 * nothing. Any uptime monitor pointed at it would have reported the platform
 * healthy while PostgreSQL was down and every request was 500ing. Verified
 * against production before the change: `{"data":{"message":"ok"}}`.
 *
 * A monitor that cannot go red is worse than no monitor: it converts an outage
 * into silence, and it is the first thing anyone wires an alert to.
 *
 * It now probes the database and answers **503** when a dependency is unreachable,
 * which is the status a load balancer, pm2 or an external checker acts on.
 */

/** Long enough for a slow query, short enough that a hung database still 503s. */
const PROBE_TIMEOUT_MS = 2_000;

interface Check {
  status: 'up' | 'down';
  latencyMs?: number;
  reason?: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({
    summary: 'Health check',
    description:
      'Probes every dependency the API cannot serve without. **200** when they all answer, '
      + '**503** when any is unreachable — so an uptime monitor pointed here goes red during an '
      + 'outage instead of reporting ok, which is what it did before.',
  })
  @Public()
  @Get()
  async check(@Res() res: Response) {
    const database = await this.probeDatabase();
    const healthy = database.status === 'up';

    res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
      status: healthy ? 'ok' : 'down',
      // Kept from the original response so anything checking for it still works.
      message: healthy ? 'ok' : 'unavailable',
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database },
    });
  }

  private async probeDatabase(): Promise<Check> {
    const started = Date.now();
    try {
      await Promise.race([
        this.prisma.$queryRawUnsafe('SELECT 1'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timed out')), PROBE_TIMEOUT_MS),
        ),
      ]);
      return { status: 'up', latencyMs: Date.now() - started };
    } catch (err) {
      /*
       * Deliberately NOT the driver's message. A Prisma connection error includes
       * the datasource URL, and this endpoint is @Public() — reporting the raw
       * error would publish the database host, user and password to anyone who
       * curls it during an outage.
       */
      return {
        status: 'down',
        latencyMs: Date.now() - started,
        reason: err instanceof Error && err.message === 'timed out' ? 'timed out' : 'unreachable',
      };
    }
  }
}
