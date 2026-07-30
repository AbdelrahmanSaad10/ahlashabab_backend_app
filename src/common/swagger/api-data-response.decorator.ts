import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

/**
 * Every response is wrapped in `{ data: … }` by the response interceptor.
 * Declaring that envelope on each of the ~113 routes by hand is not worth it —
 * this states it once.
 *
 *   @ApiDataResponse(CmsStateDto)              → { data: CmsStateDto }
 *   @ApiDataResponse(ConsultationTypeDto, true) → { data: ConsultationTypeDto[] }
 */
export const ApiDataResponse = <T extends Type<unknown>>(model: T, isArray = false) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        properties: {
          data: isArray
            ? { type: 'array', items: { $ref: getSchemaPath(model) } }
            : { $ref: getSchemaPath(model) },
        },
      },
    }),
  );

/** Paginated lists nest once more: `{ data: { data: T[], meta } }`. */
export const ApiPaginatedDataResponse = <T extends Type<unknown>>(model: T) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        properties: {
          data: {
            properties: {
              data: { type: 'array', items: { $ref: getSchemaPath(model) } },
              meta: {
                properties: {
                  total: { type: 'number', example: 12 },
                  page: { type: 'number', example: 1 },
                  limit: { type: 'number', example: 20 },
                  totalPages: { type: 'number', example: 1 },
                },
              },
            },
          },
        },
      },
    }),
  );
