import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { CatalogController } from '../src/modules/catalog/catalog.controller';
import type { PrismaService } from '../src/modules/database/prisma.service';
import { seedProducts } from '../prisma/catalog-seed';

test('maps database records into public DTOs and rejects malformed stored prices', async () => {
  const sample = seedProducts[0]!;
  let priceKzt = 600;
  const prisma = { product: { findMany: async () => [{ ...sample, tag: null, available: true, sortOrder: 1, internal: 'private', variants: [{ ...sample.variants[0], priceKzt, productId: sample.id, available: true }] }] } };
  const catalog = new CatalogService(prisma as unknown as PrismaService);
  const response = await catalog.list();
  assert.equal(response.products[0]?.variants[0]?.priceKzt, 600);
  assert.equal('available' in response.products[0]!, false);
  assert.equal('internal' in response.products[0]!, false);
  assert.equal('productId' in response.products[0]!.variants[0]!, false);
  priceKzt = -1;
  await assert.rejects(catalog.list());
});
test('rejects unsupported query parameters instead of silently ignoring them', () => {
  const controller = new CatalogController({ list: async () => ({ products: [], fetchedAt: new Date().toISOString() }) } as unknown as CatalogService);
  assert.throws(() => controller.list({ category: 'coffee' }), /does not support query parameters/);
});
