import type { Product } from '../domain/catalog';
import type { LoyaltyCard } from '../domain/loyalty';
import type { CartDraft } from '../domain/cart';
import type { CreateOrderInput, Order } from '../domain/orders';
import type { GuestProfile, ProfileChanges } from '../domain/profile';

export interface CatalogSnapshot {
  readonly products: readonly Product[];
  readonly receivedAt: number;
  readonly restored: boolean;
}

export interface CatalogRepository {
  readonly source?: 'mock' | 'api';
  readonly cacheKey?: string;
  loadCached?(): Promise<CatalogSnapshot | null>;
  list(): Promise<readonly Product[]>;
}

export interface LoyaltyRepository {
  getCard(): Promise<LoyaltyCard>;
}

export interface CartRepository {
  get(): Promise<CartDraft>;
  save(draft: CartDraft): Promise<void>;
}

export interface ProfileRepository {
  get(): Promise<GuestProfile>;
  update(changes: ProfileChanges): Promise<GuestProfile>;
  reset(): Promise<GuestProfile>;
}

export interface OrdersRepository {
  list(): Promise<readonly Order[]>;
  get(id: string): Promise<Order | null>;
  create(input: CreateOrderInput): Promise<Order>;
}

export interface AppRepositories {
  readonly catalog: CatalogRepository;
  readonly loyalty: LoyaltyRepository;
  readonly cart: CartRepository;
  readonly profile: ProfileRepository;
  readonly orders: OrdersRepository;
}
