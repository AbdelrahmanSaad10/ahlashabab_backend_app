import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { RequestWithId } from '../middleware/request-id.middleware';

/**
 * The last line before a 500 reaches a user.
 *
 * It logged `Unhandled exception:` and a stack, and nothing else. No method, no
 * path, no request id, no idea who was making the call — into a pm2 log shared
 * with three other applications on the same box. When somebody reported a
 * failure, there was no way to find it.
 *
 * The log line is now a single JSON object. That is not decoration: it is what
 * makes the difference between grepping and querying, and it is the format every
 * log-based monitoring product ingests without a parser. Choosing that product is
 * the foundation's call (row 46); this is the part that makes one useful when they
 * do, and is useful on its own in the meantime.
 *
 * The response carries the request id so a user can quote it — "خطأ داخلي" with
 * nothing else in it is unactionable for whoever has to look into it.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    // Let specific filters handle known exceptions
    if (exception instanceof HttpException) {
      throw exception;
    }

    const requestId = request?.requestId;

    this.logger.error(
      JSON.stringify({
        event: 'unhandled_exception',
        requestId,
        method: request?.method,
        path: request?.originalUrl ?? request?.url,
        // Whichever of the two the auth guard attached, if any. Identifiers only:
        // a log line is not the place for a name, a phone number or an email.
        actorId: (request as any)?.adminUser?.id ?? (request as any)?.user?.id,
        actorType: (request as any)?.adminUser ? 'admin' : (request as any)?.user ? 'user' : 'guest',
        ip: request?.ip,
        name: exception instanceof Error ? exception.name : typeof exception,
        message: exception instanceof Error ? exception.message : String(exception),
      }),
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(500).json({
      error: {
        code: 'INTERNAL',
        message: 'خطأ داخلي في الخادم',
        // Quotable by the user, greppable by whoever investigates. Deliberately
        // the only internal detail that crosses the boundary.
        ...(requestId ? { requestId } : {}),
      },
    });
  }
}
