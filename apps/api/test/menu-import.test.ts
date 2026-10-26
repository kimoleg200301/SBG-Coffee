import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { menuManifestSchema, realMenuManifest } from '../prisma/real-menu';
import { formatImportPlan, importMenu } from '../prisma/import-menu';
import { seedProducts } from '../prisma/catalog-seed';

test('real menu matches confirmed quantities, prices, sizes, additions and stable legacy IDs', () => {
  const { products, desserts, addons } = realMenuManifest;
  assert.equal(products.length, 14);
  assert.equal(products.flatMap((product) => product.variants).length, 18);
  assert.deepEqual(products.filter((product) => product.category === 'coffee').map((product) => product.variants.map((variant) => [variant.volumeMl, variant.priceKzt])), [
    [[250, 600], [400, 800]], [[250, 800], [400, 1300]], [[250, 800], [400, 1300]], [[250, 800], [400, 1200]],
  ]);
  const teas = products.filter((product) => product.category === 'tea');
  assert.deepEqual(teas.map((product) => product.variants.map((variant) => [variant.volumeMl, variant.priceKzt])), [[[400, 250]], [[400, 350]], [[400, 400]], [[400, 450]], [[400, 600]]]);
  const seasonals = products.filter((product) => product.category === 'seasonal');
  assert.equal(seasonals.length, 5);
  assert.ok(seasonals.every((product) => product.variants.length === 1 && product.variants[0]?.volumeMl === 250 && product.variants[0]?.priceKzt === 1000));
  assert.equal(desserts.length, 1);
  assert.equal(desserts[0]?.variants.length, 6);
  assert.ok(desserts[0]?.variants.every((variant) => variant.priceKzt === 200 && !('volumeMl' in variant)));
  assert.equal(addons.length, 10);
  assert.equal(addons.filter((addon) => addon.id.startsWith('syrup-')).length, 6);
  assert.ok(addons.every((addon) => addon.priceKzt === (addon.id === 'honey' ? 200 : 100)));
  for (const legacy of seedProducts) {
    const product = products.find((product) => product.id === legacy.id);
    assert.ok(product);
    assert.deepEqual(product.variants.map(({ available: _, ...variant }) => variant), legacy.variants);
  }
  assert.ok([...products, ...desserts].every((product) => product.available && product.variants.every((variant) => variant.available)));
});

test('manifest rejects duplicates, malformed prices and missing explicit availability', async () => {
  const invalidPrice = structuredClone(realMenuManifest);
  invalidPrice.addons[0]!.priceKzt = -1;
  let contactedDatabase = false;
  const prisma = { $transaction: async () => { contactedDatabase = true; } } as unknown as PrismaClient;
  await assert.rejects(importMenu(prisma, invalidPrice, true));
  assert.equal(contactedDatabase, false, 'Invalid manifests must be rejected before any database access');
  const productCollision = structuredClone(realMenuManifest);
  productCollision.desserts[0]!.id = productCollision.products[0]!.id;
  assert.equal(menuManifestSchema.safeParse(productCollision).success, false);
  const variantCollision = structuredClone(realMenuManifest);
  variantCollision.desserts[0]!.variants[0]!.id = variantCollision.products[0]!.variants[0]!.id;
  assert.equal(menuManifestSchema.safeParse(variantCollision).success, false);
  const duplicateAddon = structuredClone(realMenuManifest);
  duplicateAddon.addons.push(duplicateAddon.addons[0]!);
  assert.equal(menuManifestSchema.safeParse(duplicateAddon).success, false);
  const missingAvailability = { ...realMenuManifest, addons: [{ id: 'milk', name: 'Молоко', priceKzt: 100 }] };
  assert.equal(menuManifestSchema.safeParse(missingAvailability).success, false);
});

test('import plan describes changed values and does not pretend a dry run wrote data', () => {
  const output = formatImportPlan({ applied: false, counts: { create: 0, update: 1, unchanged: 1 }, changes: [
    { entity: 'Addon', id: 'milk', action: 'update', before: { id: 'milk', priceKzt: 100 }, after: { id: 'milk', priceKzt: 150 } },
    { entity: 'Addon', id: 'honey', action: 'unchanged', before: { id: 'honey', priceKzt: 200 }, after: { id: 'honey', priceKzt: 200 } },
  ] });
  assert.match(output, /DRY RUN \(no data changed\): create=0, update=1, unchanged=1/);
  assert.match(output, /update Addon milk: priceKzt: 100 -> 150/);
  assert.equal(output.includes('honey'), false);
});
