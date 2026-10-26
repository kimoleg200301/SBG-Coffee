import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogResponseSchema, catalogRequestQuerySchema } from '../src';

const product = {
  id: 'americano', name: 'Американо', description: '', category: 'coffee', image: 'americano',
  variants: [{ id: 'americano-s', label: 'S', volumeMl: 250, priceKzt: 600 }],
};
const response = { products: [product], fetchedAt: '2026-10-26T00:00:00.000Z' };
test('accepts the public catalog and ignores additive server fields', () => {
  assert.deepEqual(catalogResponseSchema.parse({ ...response, internalField: 'ignored' }), response);
});
test('rejects invalid prices, image keys, duplicate identifiers and missing timestamp', () => {
  assert.equal(catalogResponseSchema.safeParse({ ...response, products: [{ ...product, image: 'unknown' }] }).success, false);
  for (const priceKzt of [-1, 0.5, Infinity]) {
    assert.equal(catalogResponseSchema.safeParse({ ...response, products: [{ ...product, variants: [{ ...product.variants[0], priceKzt }] }] }).success, false);
  }
  assert.equal(catalogResponseSchema.safeParse({ ...response, products: [product, product] }).success, false);
  assert.equal(catalogResponseSchema.safeParse({ products: [] }).success, false);
  assert.equal(catalogRequestQuerySchema.safeParse({ category: 'coffee' }).success, false);
});
