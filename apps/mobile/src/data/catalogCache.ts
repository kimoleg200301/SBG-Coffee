import { catalogV2ResponseSchema } from '@sbg/contracts';
import type { CatalogSnapshot } from './repositories';
import type { KeyValueStorage } from './localCommerceRepositories';

export const CATALOG_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function catalogCacheKey(apiUrl: string): string {
  return `sbg-coffee:catalog:v2:api:${encodeURIComponent(apiUrl.replace(/\/+$/, ''))}`;
}

export async function loadCatalogCache(
  storage: KeyValueStorage,
  key: string,
  now = Date.now(),
): Promise<CatalogSnapshot | null> {
  try {
    const raw = await storage.getItem(key);
    if (!raw) return null;
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== 'object' || !('version' in saved) || saved.version !== 2 ||
      !('receivedAt' in saved) || typeof saved.receivedAt !== 'number' ||
      !Number.isSafeInteger(saved.receivedAt) || saved.receivedAt <= 0 || saved.receivedAt > now ||
      now - saved.receivedAt > CATALOG_CACHE_MAX_AGE_MS || !('response' in saved)) return null;
    const parsed = catalogV2ResponseSchema.safeParse(saved.response);
    if (!parsed.success) return null;
    return { products: parsed.data.products, receivedAt: saved.receivedAt, restored: true };
  } catch {
    // An unreadable optional cache must not prevent a real network request.
    return null;
  }
}
