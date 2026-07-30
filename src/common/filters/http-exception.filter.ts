import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // If the response already has our error format, pass it through
    if (typeof exceptionResponse === 'object' && 'error' in (exceptionResponse as any)) {
      response.status(status).json(exceptionResponse);
      return;
    }

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message || 'خطأ غير متوقع';

    const codeMap: Record<number, string> = {
      400: 'VALIDATION',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'RATE_LIMITED',
    };

    response.status(status).json({
      error: {
        code: codeMap[status] || 'INTERNAL',
        message: Array.isArray(message) ? message[0] : message,
      },
    });
  }
}
