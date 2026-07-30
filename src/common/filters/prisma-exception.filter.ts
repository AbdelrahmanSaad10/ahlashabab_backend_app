import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    switch (exception.code) {
      case 'P2002': {
        const target = (exception.meta?.target as string[])?.join(', ') || 'unknown';
        response.status(409).json({
          error: {
            code: 'CONFLICT',
            message: `قيمة مكررة: ${target}`,
          },
        });
        break;
      }
      case 'P2025':
        response.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'العنصر غير موجود',
          },
        });
        break;
      case 'P2003':
        response.status(400).json({
          error: {
            code: 'VALIDATION',
            message: 'العنصر المرتبط غير موجود',
          },
        });
        break;
      default:
        response.status(500).json({
          error: {
            code: 'INTERNAL',
            message: 'خطأ في قاعدة البيانات',
          },
        });
    }
  }
}
