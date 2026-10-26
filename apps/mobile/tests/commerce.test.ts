import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addCartItem,
  cartItemKey,
  createEmptyCart,
  MAX_ITEM_QUANTITY,
  parseStoredCart,
  removeCartItem,
  resolveCart,
  setCartQuantity,
} from '../src/domain/cart';
import { OrderCatalogChangedError, type CreateOrderInput } from '../src/domain/orders';
import { createMockRepositories } from '../src/data/mockRepositories';
import {
  createLocalCommerceRepositories,
  LOCAL_COMMERCE_KEYS,
  type KeyValueStorage,
} from '../src/data/localCommerceRepositories';

function memoryStorage() {
  const values = new Map<string, string>();
  const storage: KeyValueStorage = {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
  };
  return { storage, values };
}

function orderInput(requestId = 'request-1'): CreateOrderInput {
  return {
    requestId,
    items: [{ productId: 'pumpkin', variantId: 'pumpkin-s', quantity: 2 }],
    comment: '  Не очень горячий  ',
    expectedTotalKzt: 2000,
  };
}

describe('cart business rules', () => {
  it('merges an exact variant, keeps other sizes separate, and removes quantities at zero', async () => {
    const first = addCartItem([], 'latte', 'latte-s', 2);
    const merged = addCartItem(first, 'latte', 'latte-s', 3);
    const withLarge = addCartItem(merged, 'latte', 'latte-l', 1);
    assert.equal(first[0]?.quantity, 2);
    assert.equal(withLarge.length, 2);
    assert.equal(withLarge[0]?.quantity, 5);
    const resolved = resolveCart(withLarge, await createMockRepositories().catalog.list());
    assert.equal(resolved.totalKzt, 5300);
    assert.equal(resolved.itemCount, 6);
    const removed = setCartQuantity(withLarge, cartItemKey('latte', 'latte-s'), 0);
    assert.deepEqual(removed, [{ productId: 'latte', variantId: 'latte-l', quantity: 1, addonIds: [] }]);
    assert.deepEqual(removeCartItem(removed, cartItemKey('latte', 'latte-l')), []);
  });

  it('rejects invalid quantities and prevents a merged item exceeding the cap', () => {
    for (const quantity of [-1, 0, 0.5, NaN, Infinity, MAX_ITEM_QUANTITY + 1]) {
      assert.throws(() => addCartItem([], 'latte', 'latte-s', quantity));
    }
    const full = addCartItem([], 'latte', 'latte-s', MAX_ITEM_QUANTITY);
    assert.throws(() => addCartItem(full, 'latte', 'latte-s', 1));
    assert.throws(() => setCartQuantity(full, cartItemKey('latte', 'latte-s'), -1));
  });

  it('reports unavailable items and rejects malformed persisted draft contents', async () => {
    const result = resolveCart(
      [{ productId: 'gone', variantId: 'gone-s', quantity: 1 }],
      await createMockRepositories().catalog.list(),
    );
    assert.equal(result.issues.length, 1);
    assert.equal(result.totalKzt, 0);
    const invalid = parseStoredCart({
      id: 'draft-old',
      comment: '',
      items: [{ productId: 'latte', variantId: 'latte-s', quantity: -4 }],
    });
    assert.deepEqual(invalid.items, []);
    assert.notEqual(invalid.id, 'draft-old');
    assert.notEqual(createEmptyCart().id, createEmptyCart().id);
  });
});

describe('local persistence and profile', () => {
  it('restores a draft and profile through a new repository instance', async () => {
    const { storage } = memoryStorage();
    const catalog = createMockRepositories().catalog;
    const first = createLocalCommerceRepositories(storage, catalog);
    const draft = {
      ...createEmptyCart(),
      items: addCartItem([], 'latte', 'latte-l'),
      comment: 'Без сахара',
    };
    await first.cart.save(draft);
    const profile = await first.profile.update({
      displayName: '  Анна   Ким  ',
      notificationsEnabled: false,
    });
    assert.equal(profile.displayName, 'Анна Ким');
    const second = createLocalCommerceRepositories(storage, catalog);
    assert.deepEqual(await second.cart.get(), draft);
    assert.deepEqual(await second.profile.get(), profile);
    await assert.rejects(second.profile.update({ displayName: '  ' }));
    await assert.rejects(second.profile.update({ displayName: 'a'.repeat(61) }));
    assert.deepEqual(await second.profile.get(), profile);
    assert.equal((await second.profile.reset()).displayName, 'Гость SBG');
    assert.deepEqual(await second.cart.get(), draft);
  });

  it('handles corrupt stored JSON and schema without creating orders or loyalty credit', async () => {
    const { storage, values } = memoryStorage();
    values.set(LOCAL_COMMERCE_KEYS.cart, '{bad json');
    values.set(
      LOCAL_COMMERCE_KEYS.profile,
      JSON.stringify({ displayName: 'Unexpected', notificationsEnabled: 'yes' }),
    );
    values.set(
      LOCAL_COMMERCE_KEYS.orders,
      JSON.stringify({ version: 1, orders: [{ id: 'tampered', totalKzt: -100 }] }),
    );
    const mock = createMockRepositories();
    const repositories = createLocalCommerceRepositories(storage, mock.catalog);
    assert.deepEqual((await repositories.cart.get()).items, []);
    assert.equal((await repositories.profile.get()).displayName, 'Гость SBG');
    assert.deepEqual(await repositories.orders.list(), []);
    assert.equal((await mock.loyalty.getCard()).stampsCollected, 0);
  });
});

describe('order creation boundary', () => {
  it('is idempotent for concurrent creates, repeated taps, and retries after a reload', async () => {
    const { storage } = memoryStorage();
    const catalog = createMockRepositories().catalog;
    const first = createLocalCommerceRepositories(storage, catalog);
    const second = createLocalCommerceRepositories(storage, catalog);
    const [a, b] = await Promise.all([
      first.orders.create(orderInput()),
      second.orders.create(orderInput()),
    ]);
    assert.equal(a.id, b.id);
    assert.equal(a.number, '042');
    assert.equal(a.status, 'preparing');
    assert.equal(a.comment, 'Не очень горячий');
    const afterReload = createLocalCommerceRepositories(storage, catalog);
    assert.equal((await afterReload.orders.create(orderInput())).id, a.id);
    assert.equal((await afterReload.orders.list()).length, 1);
    const next = await afterReload.orders.create(orderInput('request-2'));
    assert.equal(next.number, '043');
    assert.equal((await afterReload.orders.list()).length, 2);
  });

  it('checks current catalog prices, availability, empty carts and quantities', async () => {
    const repository = createMockRepositories().orders;
    await assert.rejects(
      repository.create({ ...orderInput('wrong-total'), expectedTotalKzt: 1 }),
      /Стоимость/,
    );
    await assert.rejects(
      repository.create({
        ...orderInput('missing'),
        items: [{ productId: 'gone', variantId: 'gone-s', quantity: 1 }],
      }),
      /недоступен/,
    );
    await assert.rejects(
      repository.create({
        ...orderInput('missing-size'),
        items: [{ productId: 'latte', variantId: 'gone-size', quantity: 1 }],
      }),
      /недоступен/,
    );
    await assert.rejects(repository.create({ ...orderInput('empty'), items: [] }), /Добавьте/);
    await assert.rejects(
      repository.create({
        ...orderInput('invalid-quantity'),
        items: [{ productId: 'pumpkin', variantId: 'pumpkin-s', quantity: -1 }],
      }),
    );
    await assert.rejects(repository.create({ ...orderInput('comment'), comment: 'x'.repeat(301) }));
    assert.deepEqual(await repository.list(), []);
  });

  it('supplies changed prices for display and requires a second explicit confirmation', async () => {
    const { storage } = memoryStorage();
    const products = (await createMockRepositories().catalog.list()).map((product) => ({
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant, priceKzt: product.id === 'pumpkin' ? 1200 : variant.priceKzt,
      })),
    }));
    const repository = createLocalCommerceRepositories(storage, { async list() { return products; } }).orders;
    let changed: OrderCatalogChangedError | undefined;
    await assert.rejects(repository.create(orderInput()), (cause: unknown) => {
      assert.ok(cause instanceof OrderCatalogChangedError);
      changed = cause;
      return true;
    });
    assert.deepEqual(await repository.list(), []);
    assert.ok(changed);
    const updated = resolveCart(orderInput().items, changed.products);
    assert.equal(updated.totalKzt, 2400);
    const confirmed = await repository.create({ ...orderInput(), expectedTotalKzt: updated.totalKzt });
    assert.equal(confirmed.totalKzt, 2400);
    assert.equal(confirmed.isDemo, true);
    assert.equal((await repository.list()).length, 1);
  });

  it('stores independent item snapshots and never awards cups at checkout', async () => {
    const { storage } = memoryStorage();
    const mock = createMockRepositories();
    let products = await mock.catalog.list();
    const catalog = {
      async list() {
        return products;
      },
    };
    const repository = createLocalCommerceRepositories(storage, catalog).orders;
    const created = await repository.create(orderInput());
    products = products.map((product) => ({
      ...product,
      name: 'New name',
      variants: product.variants.map((variant) => ({ ...variant, priceKzt: 9999 })),
    }));
    const fetched = await repository.get(created.id);
    assert.equal(fetched?.items[0]?.name, 'Тыквенный латте');
    assert.equal(fetched?.items[0]?.unitPriceKzt, 1000);
    assert.equal(fetched?.totalKzt, 2000);
    (created.items[0] as { name: string }).name = 'Changed by caller';
    assert.equal((await repository.get(created.id))?.items[0]?.name, 'Тыквенный латте');
    assert.equal((await mock.loyalty.getCard()).stampsCollected, 0);
    await assert.rejects(repository.create(orderInput('prices-changed')), /Стоимость/);
  });

  it('propagates failed writes and safely retries without inventing a successful order', async () => {
    const { storage: memory } = memoryStorage();
    let fail = true;
    const storage: KeyValueStorage = {
      getItem: (key) => memory.getItem(key),
      async setItem(key, value) {
        if (fail) throw new Error('disk unavailable');
        await memory.setItem(key, value);
      },
    };
    const repository = createLocalCommerceRepositories(storage, createMockRepositories().catalog);
    await assert.rejects(repository.orders.create(orderInput()), /disk unavailable/);
    assert.deepEqual(await repository.orders.list(), []);
    await assert.rejects(repository.cart.save(createEmptyCart()), /disk unavailable/);
    await assert.rejects(repository.profile.update({ displayName: 'Анна' }), /disk unavailable/);
    fail = false;
    assert.equal((await repository.orders.create(orderInput())).number, '042');
    assert.equal((await repository.orders.list()).length, 1);
  });

  it('keeps a committed order idempotent if clearing the saved cart fails', async () => {
    const { storage: memory } = memoryStorage();
    let failCartWrite = false;
    const storage: KeyValueStorage = {
      getItem: (key) => memory.getItem(key),
      async setItem(key, value) {
        if (failCartWrite && key === LOCAL_COMMERCE_KEYS.cart) {
          throw new Error('cart cleanup failed');
        }
        await memory.setItem(key, value);
      },
    };
    const catalog = createMockRepositories().catalog;
    const first = createLocalCommerceRepositories(storage, catalog);
    const draft = { ...createEmptyCart(), items: orderInput().items, comment: '' };
    await first.cart.save(draft);
    const input = { ...orderInput(draft.id), comment: draft.comment };
    const committed = await first.orders.create(input);
    failCartWrite = true;
    await assert.rejects(first.cart.save(createEmptyCart()), /cart cleanup failed/);

    const afterRestart = createLocalCommerceRepositories(storage, catalog);
    const savedDraft = await afterRestart.cart.get();
    const history = await afterRestart.orders.list();
    assert.equal(history.find((order) => order.requestId === savedDraft.id)?.id, committed.id);
    assert.equal((await afterRestart.orders.create(input)).id, committed.id);
    assert.equal((await afterRestart.orders.list()).length, 1);

    failCartWrite = false;
    await afterRestart.cart.save(createEmptyCart());
    assert.deepEqual((await afterRestart.cart.get()).items, []);
    assert.equal((await afterRestart.orders.list()).length, 1);
  });
});
