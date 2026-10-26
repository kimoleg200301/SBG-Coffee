import { catalogResponseSchema } from '@sbg/contracts';
import type { CatalogRepository } from './repositories';
import type { KeyValueStorage } from './localCommerceRepositories';
import { catalogCacheKey, loadCatalogCache } from './catalogCache';

interface HttpCatalogOptions {
  apiUrl: string;
  storage: KeyValueStorage;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
}

export function createHttpCatalogRepository({
  apiUrl,
  storage,
  fetcher = fetch,
  timeoutMs = 10_000,
  now = Date.now,
}: HttpCatalogOptions): CatalogRepository {
  const baseUrl = apiUrl.replace(/\/+$/, '');
  const cacheKey = catalogCacheKey(baseUrl);
  return {
    source: 'api',
    cacheKey,
    loadCached: () => loadCatalogCache(storage, cacheKey, now()),
    async list() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetcher(`${baseUrl}/api/v1/catalog/products`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
          // Browser HTTP cache must not turn an old response into a fresh price check.
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Каталог недоступен (HTTP ${response.status}). Попробуйте ещё раз.`);
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          throw new Error('Сервер вернул некорректный каталог. Попробуйте обновить меню.');
        }
        const parsed = catalogResponseSchema.safeParse(body);
        if (!parsed.success) throw new Error('Формат каталога не поддерживается. Попробуйте обновить приложение.');
        // Storage failure does not invalidate an otherwise valid server response.
        await storage.setItem(cacheKey, JSON.stringify({
          version: 1,
          receivedAt: now(),
          response: parsed.data,
        })).catch(() => {});
        return parsed.data.products;
      } catch (cause) {
        if (controller.signal.aborted) throw new Error('Сервер не ответил вовремя. Проверьте соединение и повторите.');
        if (cause instanceof TypeError) throw new Error('Нет соединения с сервером. Проверьте сеть и повторите.');
        throw cause;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
