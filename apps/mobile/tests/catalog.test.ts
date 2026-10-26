import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHttpCatalogRepository } from '../src/data/httpCatalogRepository';
import { catalogCacheKey, CATALOG_CACHE_MAX_AGE_MS, loadCatalogCache } from '../src/data/catalogCache';
import { parseCatalogConfig } from '../src/data/catalogConfig';
import { createMockRepositories } from '../src/data/mockRepositories';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { catalogQueryOptions } from '../src/features/catalog/catalogQuery';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
  };
}
const baseUrl = 'http://localhost:3000';
const now = Date.parse('2026-10-26T08:00:00.000Z');
async function body() {
  return { products: await createMockRepositories().catalog.list(), fetchedAt: new Date(now).toISOString() };
}

describe('catalogue source configuration', () => {
  it('runs mock without a backend and validates api settings without falling back', () => {
    assert.deepEqual(parseCatalogConfig(), { source: 'mock' });
    assert.deepEqual(parseCatalogConfig('api', `${baseUrl}/`), { source: 'api', apiUrl: baseUrl });
    assert.throws(() => parseCatalogConfig('typo'), /mock или api/);
    assert.throws(() => parseCatalogConfig('api'), /EXPO_PUBLIC_API_URL/);
    for (const value of ['not-url', 'file:///tmp/db', 'https://user:secret@example.com', 'https://example.com?secret=1']) {
      assert.throws(() => parseCatalogConfig('api', value));
    }
  });
});

describe('HTTP catalogue and persistent offline cache', () => {
  it('fetches the real endpoint and restores validated products through a new repository after restart', async () => {
    const storage = memoryStorage();
    const expected = await body();
    let called = false;
    const fetcher: typeof fetch = async (url, options) => {
      called = true;
      assert.equal(url, `${baseUrl}/api/v1/catalog/products`);
      assert.equal(options?.cache, 'no-store');
      return new Response(JSON.stringify(expected));
    };
    const repository = createHttpCatalogRepository({ apiUrl: `${baseUrl}/`, storage, fetcher, now: () => now });
    assert.deepEqual(await repository.list(), expected.products);
    assert.equal(called, true);
    const restarted = createHttpCatalogRepository({ apiUrl: baseUrl, storage, now: () => now + 100 });
    const cached = await restarted.loadCached?.();
    assert.deepEqual(cached?.products, expected.products);
    assert.equal(cached?.receivedAt, now);
    assert.equal(cached?.restored, true);
    assert.equal(await createHttpCatalogRepository({ apiUrl: 'https://production.example', storage }).loadCached?.(), null);
  });

  it('never treats old cached data as a successful network answer', async () => {
    const storage = memoryStorage();
    const response = await body();
    const key = catalogCacheKey(baseUrl);
    await storage.setItem(key, JSON.stringify({ version: 1, receivedAt: now, response }));
    for (const fetcher of [
      async () => { throw new TypeError('Network request failed'); },
      async () => new Response('unavailable', { status: 503 }),
      async () => new Response('<html>bad gateway</html>'),
      async () => new Response(JSON.stringify({ products: [{ id: 'invalid' }], fetchedAt: response.fetchedAt })),
    ] as (typeof fetch)[]) {
      const repository = createHttpCatalogRepository({ apiUrl: baseUrl, storage, fetcher, now: () => now + 100 });
      await assert.rejects(repository.list());
      assert.deepEqual((await repository.loadCached?.())?.products, response.products);
      assert.equal((await repository.loadCached?.())?.receivedAt, now);
    }
  });

  it('rejects expired, future, corrupt, or incompatible cache records', async () => {
    const storage = memoryStorage();
    const response = await body();
    const key = catalogCacheKey(baseUrl);
    for (const raw of [
      'not json',
      JSON.stringify({ version: 1, receivedAt: now + 1, response }),
      JSON.stringify({ version: 1, receivedAt: now - CATALOG_CACHE_MAX_AGE_MS - 1, response }),
      JSON.stringify({ version: 2, receivedAt: now, response }),
      JSON.stringify({ version: 1, receivedAt: now, response: { products: [] } }),
    ]) {
      await storage.setItem(key, raw);
      assert.equal(await loadCatalogCache(storage, key, now), null);
    }
  });

  it('returns server data when optional cache storage fails', async () => {
    const expected = await body();
    const repository = createHttpCatalogRepository({
      apiUrl: baseUrl,
      storage: {
        async getItem() { throw new Error('disk unavailable'); },
        async setItem() { throw new Error('disk full'); },
      },
      fetcher: async () => new Response(JSON.stringify(expected)),
    });
    assert.equal(await repository.loadCached?.(), null);
    assert.deepEqual(await repository.list(), expected.products);
  });

  it('aborts a request on timeout and leaves prices unconfirmed', async () => {
    const repository = createHttpCatalogRepository({
      apiUrl: baseUrl,
      storage: memoryStorage(),
      timeoutMs: 5,
      fetcher: async (_url, options) => new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }),
    });
    await assert.rejects(repository.list(), /не ответил вовремя/);
    assert.equal(await repository.loadCached?.(), null);
  });

  it('keeps orders local and demo while using current API prices', async () => {
    const expected = await body();
    const { createLocalCommerceRepositories } = await import('../src/data/localCommerceRepositories');
    const storage = memoryStorage();
    let calls = 0;
    const repository = createHttpCatalogRepository({
      apiUrl: baseUrl, storage,
      fetcher: async () => { calls += 1; return new Response(JSON.stringify(expected)); },
    });
    const local = createLocalCommerceRepositories(storage, repository);
    const order = await local.orders.create({
      requestId: 'test-local-api-catalog',
      items: [{ productId: 'americano', variantId: 'americano-s', quantity: 1 }],
      comment: '', expectedTotalKzt: 600,
    });
    assert.equal(order.isDemo, true);
    assert.equal(calls, 1);
    assert.equal((await local.orders.list()).length, 1);
  });
});


describe('query cache recovery', () => {
  it('revalidates a recently restored cache and retains it when the network is unavailable', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const expected = await body();
    let calls = 0;
    const repository = createHttpCatalogRepository({
      apiUrl: baseUrl,
      storage: memoryStorage(),
      fetcher: async () => { calls += 1; throw new TypeError('offline'); },
    });
    const options = catalogQueryOptions(repository);
    client.setQueryData(options.queryKey, {
      products: expected.products, receivedAt: Date.now(), restored: true,
    });
    const observer = new QueryObserver(client, options);
    let unsubscribe = () => {};
    await new Promise<void>((resolve) => {
      unsubscribe = observer.subscribe((result) => {
        if (result.isError) {
          assert.deepEqual(result.data?.products, expected.products);
          assert.equal(result.data?.restored, true);
          resolve();
        }
      });
    });
    assert.equal(calls, 1);
    unsubscribe();
    client.clear();
  });
});
