import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLocalCommerceRepositories } from './localCommerceRepositories';
import { mockRepositories } from './mockRepositories';
import { parseCatalogConfig } from './catalogConfig';
import { createHttpCatalogRepository } from './httpCatalogRepository';
import type { AppRepositories } from './repositories';

// Expo replaces these explicit public environment references at bundle time.
const config = parseCatalogConfig(
  process.env.EXPO_PUBLIC_CATALOG_SOURCE,
  process.env.EXPO_PUBLIC_API_URL,
);
const catalog = config.source === 'api'
  ? createHttpCatalogRepository({ apiUrl: config.apiUrl, storage: AsyncStorage })
  : mockRepositories.catalog;

// Only the catalogue is remote. Orders/profile remain local demonstrations.
export const appRepositories: AppRepositories = {
  ...mockRepositories,
  ...createLocalCommerceRepositories(AsyncStorage, catalog),
  catalog,
};
