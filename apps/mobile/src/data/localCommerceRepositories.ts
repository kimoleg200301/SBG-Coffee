import {
  MAX_COMMENT_LENGTH,
  MAX_ITEM_QUANTITY,
  cartItemKey,
  createEmptyCart,
  parseStoredCart,
  resolveCart,
  validateCartDraft,
  validateCartItems,
} from '../domain/cart';
import { OrderCatalogChangedError, type Order, type OrderLine, type OrderStatus } from '../domain/orders';
import { createGuestProfile, parseStoredProfile, updateGuestProfile } from '../domain/profile';
import type { ProductImageKey } from '../domain/catalog';
import type { AppRepositories, CatalogRepository } from './repositories';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export const LOCAL_COMMERCE_KEYS = {
  cart: 'sbg-coffee:cart:v1',
  profile: 'sbg-coffee:profile:v1',
  orders: 'sbg-coffee:orders:v1',
} as const;

// Adapters sharing the same storage also share a queue. A rejected write does not poison it.
const storageQueues = new WeakMap<KeyValueStorage, Promise<unknown>>();

function serialize<T>(storage: KeyValueStorage, action: () => Promise<T>): Promise<T> {
  const pending = (storageQueues.get(storage) ?? Promise.resolve()).then(action, action);
  storageQueues.set(
    storage,
    pending.catch(() => undefined),
  );
  return pending;
}

async function readValue(storage: KeyValueStorage, key: string): Promise<unknown> {
  const raw = await storage.getItem(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, max = 200): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

const imageKeys = new Set<ProductImageKey>([
  'americano',
  'cappuccino',
  'latte',
  'chocolate',
  'pumpkin',
  'lavender',
]);
const statuses = new Set<OrderStatus>(['accepted', 'preparing', 'ready', 'completed', 'cancelled']);

function parseOrderLine(value: unknown): OrderLine | null {
  if (
    !record(value) ||
    !text(value.productId) ||
    !text(value.variantId) ||
    !text(value.name, 150) ||
    !text(value.variantLabel, 20)
  )
    return null;
  if (typeof value.image !== 'string' || !imageKeys.has(value.image as ProductImageKey))
    return null;
  if (
    typeof value.quantity !== 'number' ||
    !Number.isInteger(value.quantity) ||
    value.quantity < 1 ||
    value.quantity > MAX_ITEM_QUANTITY
  )
    return null;
  if (
    typeof value.unitPriceKzt !== 'number' ||
    !Number.isSafeInteger(value.unitPriceKzt) ||
    value.unitPriceKzt < 0
  )
    return null;
  if (
    typeof value.volumeMl !== 'number' ||
    !Number.isSafeInteger(value.volumeMl) ||
    value.volumeMl <= 0
  )
    return null;
  return {
    productId: value.productId,
    variantId: value.variantId,
    name: value.name,
    image: value.image as ProductImageKey,
    variantLabel: value.variantLabel,
    volumeMl: value.volumeMl,
    unitPriceKzt: value.unitPriceKzt,
    quantity: value.quantity,
  };
}

function parseOrder(value: unknown): Order | null {
  if (!record(value) || !text(value.id) || !text(value.requestId)) return null;
  if (typeof value.number !== 'string' || !/^\d{3,12}$/.test(value.number)) return null;
  if (typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)))
    return null;
  if (typeof value.status !== 'string' || !statuses.has(value.status as OrderStatus)) return null;
  if (typeof value.comment !== 'string' || value.comment.length > MAX_COMMENT_LENGTH) return null;
  if (
    value.paymentMethod !== 'on_pickup' ||
    value.fulfillment !== 'pickup' ||
    value.isDemo !== true
  )
    return null;
  if (!Array.isArray(value.items) || value.items.length === 0) return null;
  const items = value.items.map(parseOrderLine);
  if (items.some((item) => item === null)) return null;
  const validItems = items as OrderLine[];
  if (
    new Set(validItems.map((item) => cartItemKey(item.productId, item.variantId))).size !==
    items.length
  )
    return null;
  const totalKzt = validItems.reduce((sum, item) => sum + item.unitPriceKzt * item.quantity, 0);
  if (!Number.isSafeInteger(totalKzt) || value.totalKzt !== totalKzt) return null;
  return {
    id: value.id,
    requestId: value.requestId,
    number: value.number,
    createdAt: value.createdAt,
    status: value.status as OrderStatus,
    items: validItems,
    totalKzt,
    comment: value.comment,
    paymentMethod: 'on_pickup',
    fulfillment: 'pickup',
    isDemo: true,
  };
}

async function readOrders(storage: KeyValueStorage): Promise<Order[]> {
  const value = await readValue(storage, LOCAL_COMMERCE_KEYS.orders);
  if (!record(value) || value.version !== 1 || !Array.isArray(value.orders)) return [];
  const ids = new Set<string>();
  const requests = new Set<string>();
  return value.orders.flatMap((entry) => {
    const order = parseOrder(entry);
    if (!order || ids.has(order.id) || requests.has(order.requestId)) return [];
    ids.add(order.id);
    requests.add(order.requestId);
    return [order];
  });
}

/** Local demo adapter. A production backend must validate prices and authorize order creation again. */
export function createLocalCommerceRepositories(
  storage: KeyValueStorage,
  catalog: CatalogRepository,
): Pick<AppRepositories, 'cart' | 'profile' | 'orders'> {
  return {
    cart: {
      get: () =>
        serialize(storage, async () =>
          parseStoredCart(await readValue(storage, LOCAL_COMMERCE_KEYS.cart)),
        ),
      save: (draft) => {
        try {
          validateCartDraft(draft);
          // Snapshot before queuing: a caller cannot change the pending write through a retained array.
          const snapshot = JSON.stringify(parseStoredCart(draft));
          return serialize(storage, () => storage.setItem(LOCAL_COMMERCE_KEYS.cart, snapshot));
        } catch (error) {
          return Promise.reject(error);
        }
      },
    },
    profile: {
      get: () =>
        serialize(storage, async () =>
          parseStoredProfile(await readValue(storage, LOCAL_COMMERCE_KEYS.profile)),
        ),
      update: (changes) => {
        const snapshot = { ...changes };
        return serialize(storage, async () => {
          const current = parseStoredProfile(await readValue(storage, LOCAL_COMMERCE_KEYS.profile));
          const next = updateGuestProfile(current, snapshot);
          await storage.setItem(LOCAL_COMMERCE_KEYS.profile, JSON.stringify(next));
          return next;
        });
      },
      reset: () =>
        serialize(storage, async () => {
          const profile = createGuestProfile();
          await storage.setItem(LOCAL_COMMERCE_KEYS.profile, JSON.stringify(profile));
          return profile;
        }),
    },
    orders: {
      list: () =>
        serialize(storage, async () =>
          (await readOrders(storage)).sort(
            (a, b) => b.createdAt.localeCompare(a.createdAt) || Number(b.number) - Number(a.number),
          ),
        ),
      get: (id) =>
        serialize(
          storage,
          async () => (await readOrders(storage)).find((order) => order.id === id) ?? null,
        ),
      create: (input) => {
        if (!input || !text(input.requestId))
          return Promise.reject(new Error('Не удалось определить заказ. Вернитесь в корзину.'));
        let items;
        try {
          validateCartItems(input.items);
          items = input.items.map((item) => ({ ...item }));
        } catch (error) {
          return Promise.reject(error);
        }
        const { requestId, comment, expectedTotalKzt } = input;
        return serialize(storage, async () => {
          const orders = await readOrders(storage);
          const existing = orders.find((order) => order.requestId === requestId);
          if (existing) return existing;
          if (!items.length) throw new Error('Добавьте напиток в корзину.');
          if (typeof comment !== 'string' || comment.length > MAX_COMMENT_LENGTH)
            throw new Error(`Комментарий не должен превышать ${MAX_COMMENT_LENGTH} символов.`);
          const products = await catalog.list();
          const resolved = resolveCart(items, products);
          if (resolved.issues.length) throw new OrderCatalogChangedError(resolved.issues.join(' '), products);
          if (!Number.isSafeInteger(expectedTotalKzt) || expectedTotalKzt !== resolved.totalKzt)
            throw new OrderCatalogChangedError('Стоимость заказа изменилась. Проверьте корзину ещё раз.', products);
          const number = String(
            orders.reduce((max, order) => Math.max(max, Number(order.number)), 41) + 1,
          ).padStart(3, '0');
          const order: Order = {
            id: `order-${createEmptyCart().id.slice(6)}`,
            requestId,
            number,
            createdAt: new Date().toISOString(),
            status: 'preparing',
            items: resolved.lines.map((line) => ({
              productId: line.product.id,
              variantId: line.variant.id,
              name: line.product.name,
              image: line.product.image,
              variantLabel: line.variant.label,
              volumeMl: line.variant.volumeMl,
              unitPriceKzt: line.variant.priceKzt,
              quantity: line.quantity,
            })),
            comment: comment.trim(),
            totalKzt: resolved.totalKzt,
            paymentMethod: 'on_pickup',
            fulfillment: 'pickup',
            isDemo: true,
          };
          await storage.setItem(
            LOCAL_COMMERCE_KEYS.orders,
            JSON.stringify({ version: 1, orders: [order, ...orders] }),
          );
          return order;
        });
      },
    },
  };
}
