import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // If response already has our pagination format, pass through
        if (data && typeof data === 'object' && 'data' in data && 'total' in data) {
          return data;
        }
        // Wrap in data envelope
        return { data };
      }),
    );
  }
}
