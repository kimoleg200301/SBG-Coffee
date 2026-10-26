import { z } from 'zod';

// Public wire contracts only: no database, framework, platform or Node dependencies.
const identifier = z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9-]*$/);
export const categorySchema = z.enum(['coffee', 'tea', 'seasonal']);
export const productImageKeySchema = z.enum([
  'americano', 'cappuccino', 'latte', 'chocolate', 'pumpkin', 'lavender',
]);
export const productVariantSchema = z.object({
  id: identifier,
  label: z.string().min(1).max(40),
  volumeMl: z.number().int().positive().max(10_000),
  priceKzt: z.number().int().min(0).max(100_000_000),
});
export const productSchema = z.object({
  id: identifier,
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  category: categorySchema,
  image: productImageKeySchema,
  variants: z.array(productVariantSchema).min(1).max(50),
  tag: z.string().min(1).max(100).optional(),
});
export const catalogResponseSchema = z.object({
  products: z.array(productSchema).max(10_000),
  // The server's read time, not a promise that prices will remain valid until checkout.
  fetchedAt: z.iso.datetime(),
}).superRefine((catalog, context) => {
  const productIds = new Set<string>();
  const variantIds = new Set<string>();
  for (const [index, product] of catalog.products.entries()) {
    if (productIds.has(product.id)) {
      context.addIssue({ code: 'custom', path: ['products', index, 'id'], message: 'Duplicate product ID' });
    }
    productIds.add(product.id);
    for (const [variantIndex, variant] of product.variants.entries()) {
      if (variantIds.has(variant.id)) {
        context.addIssue({ code: 'custom', path: ['products', index, 'variants', variantIndex, 'id'], message: 'Duplicate variant ID' });
      }
      variantIds.add(variant.id);
    }
  }
});
// This endpoint has no supported query parameters. Reject typos/unsupported filters.
export const catalogRequestQuerySchema = z.object({}).strict();
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  database: z.literal('up'),
});
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
  }),
});
export type ProductVariantDto = z.infer<typeof productVariantSchema>;
export type ProductDto = z.infer<typeof productSchema>;
export type CatalogResponseDto = z.infer<typeof catalogResponseSchema>;
export type CatalogRequestQueryDto = z.infer<typeof catalogRequestQuerySchema>;
export type ApiErrorDto = z.infer<typeof apiErrorSchema>;
export type HealthResponseDto = z.infer<typeof healthResponseSchema>;
