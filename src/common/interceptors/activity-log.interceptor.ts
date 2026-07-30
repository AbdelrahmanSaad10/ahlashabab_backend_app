import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only log mutations
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    const adminUser = request.adminUser;
    if (!adminUser) {
      return next.handle();
    }

    const action = this.getAction(method);
    const ip = request.ip || request.headers['x-forwarded-for'];
    const userAgent = request.headers['user-agent'];

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          const entityType = this.extractEntityType(request.route?.path || request.url);
          const entityId =
            request.params?.id ||
            (responseData?.data?.id ?? responseData?.id ?? 'unknown');

          await this.prisma.activityLog.create({
            data: {
              actorId: adminUser.id,
              action,
              entityType,
              entityId: String(entityId),
              previousValue: request.body?._previousValue ?? null,
              newValue: request.body ?? null,
              ip: ip ?? null,
              userAgent: userAgent ?? null,
            },
          });
        } catch {
          // Never let logging failures break the response
        }
      }),
    );
  }

  private getAction(method: string): string {
    switch (method) {
      case 'POST':
        return 'create';
      case 'PATCH':
      case 'PUT':
        return 'update';
      case 'DELETE':
        return 'delete';
      default:
        return method.toLowerCase();
    }
  }

  private extractEntityType(path: string): string {
    // Extract the main resource from the path
    // e.g. /api/v1/admin/bookings/:id/status → bookings
    const parts = path
      .replace(/^\/api\/v1\/(admin\/)?/, '')
      .split('/')
      .filter((p) => !p.startsWith(':'));
    return parts[0] || 'unknown';
  }
}
