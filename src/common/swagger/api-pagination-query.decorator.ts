import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

/**
 * The `?page=&limit=&q=` trio that every list route accepts.
 *
 * These arrive as strings and are parsed with `parseInt` in the controllers, so
 * they are documented as integers with the defaults those controllers apply.
 *
 *   @ApiPaginationQuery()             // page, limit, q
 *   @ApiPaginationQuery({ q: false }) // page, limit only
 */
export const ApiPaginationQuery = ({ q = true }: { q?: boolean } = {}) =>
  applyDecorators(
    ApiQuery({ name: 'page', required: false, schema: { type: 'integer', default: 1 } }),
    ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 20 } }),
    ...(q
      ? [ApiQuery({ name: 'q', required: false, description: 'Free-text search' })]
      : []),
  );
