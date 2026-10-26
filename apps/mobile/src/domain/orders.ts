import type { CartItem } from './cart';
import type { Product, ProductImageKey } from './catalog';

/** Carries live prices so checkout can show changes before a second confirmation. */
export class OrderCatalogChangedError extends Error {
  constructor(message: string, readonly products: readonly Product[]) {
    super(message);
    this.name = 'OrderCatalogChangedError';
  }
}

export type OrderStatus = 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface OrderLine {
  readonly productId: string;
  readonly variantId: string;
  readonly name: string;
  readonly image: ProductImageKey;
  readonly variantLabel: string;
  readonly volumeMl: number;
  readonly unitPriceKzt: number;
  readonly quantity: number;
}

export interface Order {
  readonly id: string;
  readonly number: string;
  readonly createdAt: string;
  readonly status: OrderStatus;
  readonly items: readonly OrderLine[];
  readonly comment: string;
  readonly totalKzt: number;
  readonly paymentMethod: 'on_pickup';
  readonly fulfillment: 'pickup';
  readonly isDemo: true;
  readonly requestId: string;
}

export interface CreateOrderInput {
  readonly requestId: string;
  readonly items: readonly CartItem[];
  readonly comment: string;
  readonly expectedTotalKzt: number;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  accepted: 'Принят',
  preparing: 'Готовится',
  ready: 'Можно забирать',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

export function isActiveOrder(order: Order): boolean {
  return order.status === 'accepted' || order.status === 'preparing' || order.status === 'ready';
}
