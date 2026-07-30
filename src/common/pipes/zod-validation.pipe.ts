import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.');
        fields[path] = issue.message;
      }

      throw new BadRequestException({
        error: {
          code: 'VALIDATION',
          message: 'بيانات غير صحيحة',
          fields,
        },
      });
    }

    return result.data;
  }
}
