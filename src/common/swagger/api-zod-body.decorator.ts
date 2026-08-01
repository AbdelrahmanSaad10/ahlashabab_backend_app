import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { ZodTypeAny } from 'zod';
import { zodToOpenApi, zodToQueryParams } from './zod-to-openapi';

/**
 * Document a request body from the Zod schema that validates it.
 *
 *   @ApiZodBody(CreateConsultationSchema)
 *
 * Pairs with `@UsePipes(new ZodValidationPipe(CreateConsultationSchema))` — pass
 * the same schema to both and the docs cannot drift from the validation.
 */
export const ApiZodBody = (schema: ZodTypeAny, description?: string) =>
  ApiBody({ schema: zodToOpenApi(schema), description });

/**
 * Document a filter/pagination query string from its Zod schema, one `?param=`
 * entry per property — which is what Swagger UI needs to render input boxes.
 */
export const ApiZodQuery = (schema: ZodTypeAny) =>
  applyDecorators(
    ...zodToQueryParams(schema).map((p) =>
      ApiQuery({ name: p.name, required: p.required, schema: p.schema }),
    ),
  );
