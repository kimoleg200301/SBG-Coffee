import { z } from 'zod';

const databaseUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return ['postgres:', 'postgresql:'].includes(url.protocol) && !!url.hostname && url.pathname.length > 1;
}, 'DATABASE_URL must point to a PostgreSQL database');
const origins = z.string().default('').transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean))
  .refine((values) => values.every((value) => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
    } catch { return false; }
  }), 'CORS_ORIGINS must be comma-separated HTTP(S) origins, without paths or wildcards');
const environmentSchema = z.object({
  DATABASE_URL: databaseUrl,
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGINS: origins,
});
export type ApiConfig = z.infer<typeof environmentSchema>;
export const API_CONFIG = Symbol('API_CONFIG');
export function parseConfig(environment: Record<string, string | undefined>): ApiConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    // Include only keys/reasons, never values containing credentials.
    throw new Error(`Invalid API configuration: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  }
  return result.data;
}
