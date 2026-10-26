import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';

export function openApiSchema(schema: z.ZodType): SchemaObject {
  // Zod's return type also covers JSON Schema type arrays; this target emits OpenAPI 3.0.
  return z.toJSONSchema(schema, { target: 'openapi-3.0' }) as SchemaObject;
}
