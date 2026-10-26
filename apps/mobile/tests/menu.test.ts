import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addCartItem,
  cartItemKey,
  createEmptyCart,
  parseStoredCart,
  removeCartItem,
  resolveCart,
  setCartQuantity,
  type CartItem,
} from '../src/domain/cart';
import { filterProducts, type Product } from '../src/domain/catalog';
import { cartItemsFromOrder, OrderCatalogChangedError } from '../src/domain/orders';
import {
  createLocalCommerceRepositories,
  LOCAL_COMMERCE_KEYS,
  type KeyValueStorage,
} from '../src/data/localCommerceRepositories';

function menu(): Product[] {
  return [
    {
      id: 'tea-test', name: 'Чай', description: 'Тестовый чай', category: 'tea', image: 'tea',
      variants: [{ id: 'tea-test-400', label: '400 мл', volumeMl: 400, priceKzt: 800 }],
      addons: [
        { id: 'lemon', name: 'Лимон', priceKzt: 100 },
        { id: 'ginger', name: 'Имбирь', priceKzt: 100 },
        { id: 'milk', name: 'Молоко', priceKzt: 100 },
        { id: 'honey', name: 'Мёд', priceKzt: 200 },
        ...['vanilla', 'caramel', 'hazelnut', 'coconut', 'chocolate', 'lavender'].map((flavor) => ({
          id: `syrup-${flavor}`, name: `Сироп ${flavor}`, priceKzt: 100,
        })),
      ],
    },
    {
      id: 'chocopie', name: 'Чокопай', description: 'Десерт', category: 'dessert', image: 'dessert',
      variants: [
        { id: 'chocopie-original', label: 'Оригинальный', volumeMl: null, priceKzt: 200 },
        { id: 'chocopie-berry', label: 'Ягодный', volumeMl: null, priceKzt: 200 },
      ],
      addons: [],
    },
  ];
}

function memoryStorage() {
  const values = new Map<string, string>();
  const storage: KeyValueStorage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
  };
  return { values, storage };
}

const teaItem = (addonIds: readonly string[], quantity = 1): CartItem => ({
  productId: 'tea-test', variantId: 'tea-test-400', quantity, addonIds,
});

describe('menu additions and unit goods', () => {
  it('merges the same set in any order and preserves distinct selections through quantity edits', () => {
    const selected = ['lemon', 'honey'];
    let items = addCartItem([], 'tea-test', 'tea-test-400', 2, selected);
    assert.deepEqual(selected, ['lemon', 'honey']);
    assert.deepEqual(items[0]?.addonIds, ['honey', 'lemon']);
    items = addCartItem(items, 'tea-test', 'tea-test-400', 1, ['honey', 'lemon']);
    items = addCartItem(items, 'tea-test', 'tea-test-400', 1, ['lemon']);
    items = addCartItem(items, 'tea-test', 'tea-test-400');
    assert.equal(items.length, 3);
    assert.equal(items[0]?.quantity, 3);
    assert.equal(resolveCart(items, menu()).totalKzt, 5000);
    const lemonKey = cartItemKey('tea-test', 'tea-test-400', ['lemon']);
    items = setCartQuantity(items, lemonKey, 2);
    assert.equal(resolveCart(items, menu()).totalKzt, 5900);
    items = removeCartItem(items, lemonKey);
    assert.equal(items.length, 2);
    assert.equal(resolveCart(items, menu()).totalKzt, 4100);
    assert.equal(
      cartItemKey('tea-test', 'tea-test-400', ['lemon', 'honey']),
      cartItemKey('tea-test', 'tea-test-400', ['honey', 'lemon']),
    );
    assert.equal(cartItemKey('tea-test', 'tea-test-400'), cartItemKey('tea-test', 'tea-test-400', []));
  });

  it('charges every selected addition once per unit, including when all ten are selected', () => {
    const products = menu();
    const addons = products[0]!.addons;
    const resolved = resolveCart([teaItem(addons.map(({ id }) => id), 2)], products);
    assert.deepEqual(resolved.issues, []);
    assert.equal(resolved.lines[0]?.addons.length, 10);
    assert.equal(resolved.lines[0]?.unitPriceKzt, 1900);
    assert.equal(resolved.lines[0]?.totalKzt, 3800);
    assert.equal(resolved.totalKzt, 3800);
    assert.equal(resolved.itemCount, 2);
  });

  it('rejects duplicate additions and duplicate lines regardless of selection order', () => {
    assert.throws(() => addCartItem([], 'tea-test', 'tea-test-400', 1, ['lemon', 'lemon']));
    assert.ok(resolveCart([teaItem(['lemon', 'lemon'])], menu()).issues.length);
    const duplicateLines = [teaItem(['honey', 'lemon']), teaItem(['lemon', 'honey'])];
    assert.ok(resolveCart(duplicateLines, menu()).issues.length);
    assert.deepEqual(parseStoredCart({ ...createEmptyCart(), items: duplicateLines }).items, []);
    assert.deepEqual(parseStoredCart({ ...createEmptyCart(), items: [teaItem(['lemon', 'lemon'])] }).items, []);
  });

  it('blocks unknown or newly unavailable additions instead of silently dropping their charge', () => {
    const products = menu();
    for (const items of [[teaItem(['not-in-menu'])], [teaItem(['honey'])]]) {
      const current = products.map((product) => ({
        ...product, addons: product.addons.filter(({ id }) => id !== 'honey'),
      }));
      const resolved = resolveCart(items, current);
      assert.equal(resolved.lines.length, 0);
      assert.equal(resolved.totalKzt, 0);
      assert.ok(resolved.issues.length);
    }
  });

  it('filters desserts, keeps flavors distinct, and refuses drink additions on desserts', () => {
    const products = menu();
    assert.deepEqual(filterProducts({ products, category: 'dessert' }).map(({ id }) => id), ['chocopie']);
    let items = addCartItem([], 'chocopie', 'chocopie-original', 2);
    items = addCartItem(items, 'chocopie', 'chocopie-berry');
    const resolved = resolveCart(items, products);
    assert.equal(resolved.lines.length, 2);
    assert.equal(resolved.totalKzt, 600);
    assert.equal(resolved.lines[0]?.variant.volumeMl, null);
    assert.deepEqual(resolved.lines[0]?.addons, []);
    assert.ok(resolveCart([
      { productId: 'chocopie', variantId: 'chocopie-original', quantity: 1, addonIds: ['honey'] },
    ], products).issues.length);
  });
});

describe('addition storage and demo order snapshots', () => {
  it('loads legacy drafts using the existing storage key and persists canonical selections across restart', async () => {
    const { storage, values } = memoryStorage();
    const catalog = { async list() { return menu(); } };
    const legacyItem = { productId: 'tea-test', variantId: 'tea-test-400', quantity: 1 };
    values.set('sbg-coffee:cart:v1', JSON.stringify({ id: 'legacy-draft', comment: 'С собой', items: [legacyItem] }));
    const repository = createLocalCommerceRepositories(storage, catalog);
    const legacy = await repository.cart.get();
    assert.equal(legacy.id, 'legacy-draft');
    assert.deepEqual(legacy.items, [{ ...legacyItem, addonIds: [] }]);
    assert.equal(resolveCart(legacy.items, menu()).totalKzt, 800);
    const addonIds = ['lemon', 'honey'];
    const draft = { ...legacy, items: [teaItem(addonIds, 2)] };
    const save = repository.cart.save(draft);
    addonIds.push('ginger');
    await save;
    const afterRestart = await createLocalCommerceRepositories(storage, catalog).cart.get();
    assert.deepEqual(afterRestart.items[0]?.addonIds, ['honey', 'lemon']);
    assert.equal(resolveCart(afterRestart.items, menu()).totalKzt, 2200);
    assert.equal(LOCAL_COMMERCE_KEYS.cart, 'sbg-coffee:cart:v1');
    assert.equal(LOCAL_COMMERCE_KEYS.orders, 'sbg-coffee:orders:v1');
  });

  it('reads pre-addition orders and repeats them without adding options from the current catalog', async () => {
    const { storage, values } = memoryStorage();
    const legacyOrder = {
      id: 'legacy-order', requestId: 'legacy-request', number: '042',
      createdAt: '2026-10-26T08:00:00.000Z', status: 'completed', comment: '',
      items: [{
        productId: 'tea-test', variantId: 'tea-test-400', name: 'Старый чай', image: 'americano',
        variantLabel: '400 мл', volumeMl: 400, unitPriceKzt: 700, quantity: 2,
      }],
      totalKzt: 1400, paymentMethod: 'on_pickup', fulfillment: 'pickup', isDemo: true,
    };
    values.set('sbg-coffee:orders:v1', JSON.stringify({ version: 1, orders: [legacyOrder] }));
    const repository = createLocalCommerceRepositories(storage, { async list() { return menu(); } });
    const restored = await repository.orders.get('legacy-order');
    assert.ok(restored);
    assert.equal(restored.totalKzt, 1400);
    assert.deepEqual(restored.items[0]?.addons, []);
    const repeated = cartItemsFromOrder(restored);
    assert.deepEqual(repeated, [teaItem([], 2)]);
    assert.equal(resolveCart(repeated, menu()).totalKzt, 1600);
  });

  it('retains distinct addition lines and dessert snapshots after restart, then repeats at current prices', async () => {
    const { storage } = memoryStorage();
    let products = menu();
    const catalog = { async list() { return products; } };
    const repository = createLocalCommerceRepositories(storage, catalog);
    const items = [
      teaItem(['lemon', 'honey'], 2),
      teaItem(['lemon']),
      { productId: 'chocopie', variantId: 'chocopie-berry', quantity: 1, addonIds: [] },
    ];
    const created = await repository.orders.create({
      requestId: 'addition-order', items, comment: '', expectedTotalKzt: 3300,
    });
    assert.equal(created.items[0]?.unitPriceKzt, 1100);
    assert.equal(created.items[2]?.volumeMl, null);
    assert.equal(created.isDemo, true);
    const originalSnapshot = JSON.parse(JSON.stringify(created));
    products = products.map((product) => ({
      ...product,
      name: 'Обновлённое название',
      addons: product.addons.map((addon) => ({ ...addon, name: 'Новое имя', priceKzt: addon.priceKzt + 50 })),
    }));
    const mutableAddon = created.items[0]?.addons[0];
    assert.ok(mutableAddon);
    (mutableAddon as { name: string; priceKzt: number }).name = 'Изменено вызывающим кодом';
    (mutableAddon as { priceKzt: number }).priceKzt = 1;
    const reloaded = await createLocalCommerceRepositories(storage, catalog).orders.get(created.id);
    assert.deepEqual(reloaded, originalSnapshot);
    assert.ok(reloaded);
    const repeated = cartItemsFromOrder(reloaded);
    assert.deepEqual(repeated[0]?.addonIds, ['honey', 'lemon']);
    assert.deepEqual(repeated[1]?.addonIds, ['lemon']);
    assert.equal(resolveCart(repeated, products).totalKzt, 3550);
    const afterRemoval = products.map((product) => ({
      ...product, addons: product.addons.filter(({ id }) => id !== 'honey'),
    }));
    assert.ok(resolveCart(repeated, afterRemoval).issues.length);
  });

  it('rejects changed addition prices until explicitly reconfirmed and blocks removed additions', async () => {
    const { storage } = memoryStorage();
    let products = menu();
    const repository = createLocalCommerceRepositories(storage, { async list() { return products; } });
    const input = { requestId: 'live-addons', items: [teaItem(['honey'], 2)], comment: '', expectedTotalKzt: 2000 };
    products = products.map((product) => ({
      ...product, addons: product.addons.map((addon) => ({ ...addon, priceKzt: addon.id === 'honey' ? 300 : addon.priceKzt })),
    }));
    let changed: OrderCatalogChangedError | undefined;
    await assert.rejects(repository.orders.create(input), (error: unknown) => {
      assert.ok(error instanceof OrderCatalogChangedError);
      changed = error;
      return true;
    });
    assert.deepEqual(await repository.orders.list(), []);
    assert.ok(changed);
    assert.equal(resolveCart(input.items, changed.products).totalKzt, 2200);
    const confirmed = await repository.orders.create({ ...input, expectedTotalKzt: 2200 });
    assert.equal(confirmed.items[0]?.unitPriceKzt, 1100);
    assert.equal(confirmed.items[0]?.addons[0]?.priceKzt, 300);
    products = products.map((product) => ({ ...product, addons: [] }));
    await assert.rejects(repository.orders.create({ ...input, requestId: 'removed-addon', expectedTotalKzt: 1600 }), OrderCatalogChangedError);
    assert.equal((await repository.orders.list()).length, 1);
  });

  it('rejects corrupted saved selections and detects duplicate order lines using the canonical additions', async () => {
    const { storage, values } = memoryStorage();
    const repository = createLocalCommerceRepositories(storage, { async list() { return menu(); } });
    const order = await repository.orders.create({
      requestId: 'valid-snapshot', items: [teaItem(['lemon', 'honey'])], comment: '', expectedTotalKzt: 1100,
    });
    const line = order.items[0]!;
    const corruptions = [
      { ...order, items: [line, { ...line, addons: [...line.addons].reverse() }], totalKzt: 2200 },
      { ...order, items: [{ ...line, addons: [line.addons[0], line.addons[0]] }] },
      { ...order, items: [{ ...line, addons: [{ ...line.addons[0], priceKzt: -1 }] }] },
    ];
    for (const corrupted of corruptions) {
      values.set(LOCAL_COMMERCE_KEYS.orders, JSON.stringify({ version: 1, orders: [corrupted] }));
      assert.deepEqual(await repository.orders.list(), []);
    }
  });
});
