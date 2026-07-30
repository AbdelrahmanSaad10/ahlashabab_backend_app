import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Let specific filters handle known exceptions
    if (exception instanceof HttpException) {
      throw exception;
    }

    this.logger.error('Unhandled exception:', exception);

    response.status(500).json({
      error: {
        code: 'INTERNAL',
        message: 'خطأ داخلي في الخادم',
      },
    });
  }
}
