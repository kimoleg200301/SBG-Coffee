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

// v1 remains frozen for installed clients. Unit goods and additions are a v2 contract.
export const addonSchema = z.object({
  id: identifier,
  name: z.string().min(1).max(200),
  priceKzt: z.number().int().min(0).max(100_000_000),
});
export const categoryV2Schema = z.enum(['coffee', 'tea', 'seasonal', 'dessert']);
export const productImageKeyV2Schema = z.enum([
  'americano', 'cappuccino', 'latte', 'chocolate', 'pumpkin', 'lavender', 'tea', 'dessert',
]);
export const productVariantV2Schema = productVariantSchema.extend({
  volumeMl: z.number().int().positive().max(10_000).nullable(),
});
export const productV2Schema = productSchema.extend({
  category: categoryV2Schema,
  image: productImageKeyV2Schema,
  variants: z.array(productVariantV2Schema).min(1).max(50),
  // Each listed addition can be selected at most once per unit of this product.
  addons: z.array(addonSchema).max(20),
}).superRefine((product, context) => {
  for (const [index, variant] of product.variants.entries()) {
    if ((product.category === 'dessert') !== (variant.volumeMl === null)) {
      context.addIssue({ code: 'custom', path: ['variants', index, 'volumeMl'], message: 'Drinks require a volume; desserts use null' });
    }
  }
  if (product.category === 'dessert' && product.addons.length) {
    context.addIssue({ code: 'custom', path: ['addons'], message: 'Additions are only available for drinks' });
  }
  const addonIds = new Set<string>();
  for (const [index, addon] of product.addons.entries()) {
    if (addonIds.has(addon.id)) context.addIssue({ code: 'custom', path: ['addons', index, 'id'], message: 'Duplicate addition ID' });
    addonIds.add(addon.id);
  }
});
export const catalogV2ResponseSchema = z.object({
  products: z.array(productV2Schema).max(10_000),
  fetchedAt: z.iso.datetime(),
}).superRefine((catalog, context) => {
  const productIds = new Set<string>();
  const variantIds = new Set<string>();
  for (const [index, product] of catalog.products.entries()) {
    if (productIds.has(product.id)) context.addIssue({ code: 'custom', path: ['products', index, 'id'], message: 'Duplicate product ID' });
    productIds.add(product.id);
    for (const [variantIndex, variant] of product.variants.entries()) {
      if (variantIds.has(variant.id)) context.addIssue({ code: 'custom', path: ['products', index, 'variants', variantIndex, 'id'], message: 'Duplicate variant ID' });
      variantIds.add(variant.id);
    }
  }
});
export type AddonDto = z.infer<typeof addonSchema>;
export type ProductVariantV2Dto = z.infer<typeof productVariantV2Schema>;
export type ProductV2Dto = z.infer<typeof productV2Schema>;
export type CatalogV2ResponseDto = z.infer<typeof catalogV2ResponseSchema>;
