export type CatalogConfig =
  | { source: 'mock' }
  | { source: 'api'; apiUrl: string };

export function parseCatalogConfig(source = 'mock', apiUrl?: string): CatalogConfig {
  if (source === 'mock') return { source };
  if (source !== 'api') {
    throw new Error('EXPO_PUBLIC_CATALOG_SOURCE должен быть mock или api.');
  }
  if (!apiUrl) throw new Error('Для каталога API укажите EXPO_PUBLIC_API_URL.');
  let url: URL;
  try {
    url = new URL(apiUrl);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL должен быть абсолютным HTTP(S)-адресом.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('EXPO_PUBLIC_API_URL должен быть HTTP(S)-адресом без секретов, query и fragment.');
  }
  return { source, apiUrl: url.toString().replace(/\/+$/, '') };
}
