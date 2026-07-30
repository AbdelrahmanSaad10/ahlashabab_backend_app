import { ZodTypeAny } from 'zod';

/**
 * Convert a Zod v3 schema to an OpenAPI 3 schema object.
 *
 * Validation in this codebase is Zod (`ZodValidationPipe`), and the DTO *types*
 * are `z.infer<typeof Schema>` — type aliases, which are erased at compile time.
 * `@nestjs/swagger` reflects on emitted metadata, so it sees nothing for them:
 * before this, every request body in the spec documented as an empty object.
 *
 * Rather than hand-maintain a parallel set of DTO classes (~30 files that would
 * drift from the schemas silently), this derives the schema from the Zod object
 * that actually does the validating. One source of truth.
 *
 * Zod 3.25 ships `z.toJSONSchema()`, but only for `zod/v4` schemas — these are
 * written against the v3 API (`required_error`), so it does not accept them.
 * Hence walking `_def` directly. Only the constructs this codebase uses are
 * handled; anything unrecognised degrades to `{}` (permissive) rather than
 * throwing, so an unsupported schema can never break app startup.
 */

/** Arabic validation copy lives on the schema. Surfacing it documents the real 400 body. */
function messages(def: any): string[] {
  const out: string[] = [];
  for (const c of def?.checks ?? []) if (c?.message) out.push(c.message);
  // `required_error` is folded into an errorMap by Zod, so it can only be read
  // back by invoking that map. Best-effort: enrich the description when it works.
  try {
    const m = def?.errorMap?.(
      { code: 'invalid_type', expected: 'string', received: 'undefined', path: [] },
      { defaultError: '', data: undefined },
    );
    if (m?.message) out.unshift(m.message);
  } catch {
    /* no errorMap, or a shape we don't understand — the checks above still apply */
  }
  return [...new Set(out)];
}

function applyStringChecks(def: any, schema: Record<string, any>) {
  for (const c of def.checks ?? []) {
    if (c.kind === 'min') schema.minLength = c.value;
    else if (c.kind === 'max') schema.maxLength = c.value;
    else if (c.kind === 'email') schema.format = 'email';
    else if (c.kind === 'url') schema.format = 'uri';
    else if (c.kind === 'uuid') schema.format = 'uuid';
    else if (c.kind === 'datetime') schema.format = 'date-time';
    else if (c.kind === 'regex') schema.pattern = c.regex?.source;
  }
}

function applyNumberChecks(def: any, schema: Record<string, any>) {
  for (const c of def.checks ?? []) {
    if (c.kind === 'int') schema.type = 'integer';
    else if (c.kind === 'min') schema.minimum = c.value;
    else if (c.kind === 'max') schema.maximum = c.value;
  }
}

/** True when a value may be omitted from the payload (optional, or has a default). */
export function isOptional(schema: ZodTypeAny): boolean {
  const t = (schema as any)?._def?.typeName;
  if (t === 'ZodOptional' || t === 'ZodDefault') return true;
  if (t === 'ZodNullable' || t === 'ZodEffects') {
    return isOptional((schema as any)._def.innerType ?? (schema as any)._def.schema);
  }
  return false;
}

export function zodToOpenApi(schema: ZodTypeAny): Record<string, any> {
  const def: any = (schema as any)?._def;
  if (!def) return {};

  const describe = (s: Record<string, any>) => {
    const notes = messages(def);
    const parts = [def.description, notes.length ? `الرسائل: ${notes.join(' / ')}` : null]
      .filter(Boolean);
    if (parts.length) s.description = parts.join(' — ');
    return s;
  };

  switch (def.typeName) {
    case 'ZodString':
      return describe(((s) => (applyStringChecks(def, s), s))({ type: 'string' }));

    case 'ZodNumber':
      return describe(((s) => (applyNumberChecks(def, s), s))({ type: 'number' }));

    case 'ZodBoolean':
      return describe({ type: 'boolean' });

    case 'ZodDate':
      return describe({ type: 'string', format: 'date-time' });

    case 'ZodEnum':
      return describe({ type: 'string', enum: def.values });

    case 'ZodNativeEnum':
      return describe({ type: 'string', enum: Object.values(def.values ?? {}) });

    case 'ZodLiteral':
      return describe({ type: typeof def.value, enum: [def.value] });

    case 'ZodArray':
      return describe({ type: 'array', items: zodToOpenApi(def.type) });

    case 'ZodObject': {
      const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
      const properties: Record<string, any> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries<ZodTypeAny>(shape ?? {})) {
        properties[key] = zodToOpenApi(value);
        if (!isOptional(value)) required.push(key);
      }
      const out: Record<string, any> = { type: 'object', properties };
      if (required.length) out.required = required;
      return describe(out);
    }

    case 'ZodRecord':
      return describe({ type: 'object', additionalProperties: zodToOpenApi(def.valueType) });

    case 'ZodUnion':
      return describe({ oneOf: (def.options ?? []).map(zodToOpenApi) });

    case 'ZodOptional':
      return zodToOpenApi(def.innerType);

    case 'ZodNullable':
      return { ...zodToOpenApi(def.innerType), nullable: true };

    case 'ZodDefault': {
      const inner = zodToOpenApi(def.innerType);
      try {
        return { ...inner, default: def.defaultValue() };
      } catch {
        return inner;
      }
    }

    // .transform() / .refine() wrap the real schema.
    case 'ZodEffects':
      return zodToOpenApi(def.schema);

    // z.any() / z.unknown() genuinely accept anything — an empty schema says so.
    case 'ZodAny':
    case 'ZodUnknown':
      return describe({});

    default:
      return {};
  }
}

/** Flatten a Zod object into per-property entries, for query/param documentation. */
export function zodToQueryParams(
  schema: ZodTypeAny,
): Array<{ name: string; required: boolean; schema: Record<string, any> }> {
  const def: any = (schema as any)?._def;
  const shape = typeof def?.shape === 'function' ? def.shape() : def?.shape;
  if (!shape) return [];
  return Object.entries<ZodTypeAny>(shape).map(([name, value]) => ({
    name,
    required: !isOptional(value),
    schema: zodToOpenApi(value),
  }));
}
