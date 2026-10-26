import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogResponseSchema, catalogRequestQuerySchema, catalogV2ResponseSchema } from '../src';

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

const v2Drink = { ...product, addons: [{ id: 'honey', name: 'Мёд', priceKzt: 200 }] };
const dessert = {
  id: 'chocopie', name: 'Чокопай', description: '', category: 'dessert', image: 'dessert', addons: [],
  variants: [{ id: 'chocopie-original', label: 'Обычный', volumeMl: null, priceKzt: 200 }],
};
test('v2 represents additions and unit goods without changing the legacy wire format', () => {
  const complete = { ...response, products: [v2Drink, dessert] };
  assert.deepEqual(catalogV2ResponseSchema.parse(complete), complete);
  assert.equal(catalogResponseSchema.safeParse(complete).success, false, 'Desserts must not leak into v1');
  assert.deepEqual(catalogResponseSchema.parse(response), response);
  assert.equal(catalogV2ResponseSchema.safeParse(response).success, false, 'v1 is not a complete v2 catalog');
});
test('v2 rejects ambiguous identities, duplicate additions and incorrect serving units', () => {
  const invalidProducts = [
    [{ ...v2Drink, variants: [{ ...product.variants[0], volumeMl: null }] }],
    [{ ...dessert, variants: [{ ...dessert.variants[0], volumeMl: 250 }] }],
    [{ ...dessert, addons: v2Drink.addons }],
    [{ ...v2Drink, addons: [...v2Drink.addons, ...v2Drink.addons] }],
    [{ ...v2Drink, addons: [{ ...v2Drink.addons[0], priceKzt: 1.5 }] }],
    [v2Drink, { ...v2Drink, id: 'another-drink' }],
    [v2Drink, v2Drink],
    [{ ...v2Drink, image: 'unpublished-image' }],
  ];
  for (const products of invalidProducts) {
    assert.equal(catalogV2ResponseSchema.safeParse({ ...response, products }).success, false);
  }
});
