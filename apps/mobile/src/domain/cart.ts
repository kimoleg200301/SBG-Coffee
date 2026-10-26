import type { Product, ProductVariant } from './catalog';

export const MAX_ITEM_QUANTITY = 20;
export const MAX_COMMENT_LENGTH = 300;
const MAX_CART_LINES = 100;

export interface CartItem {
  readonly productId: string;
  readonly variantId: string;
  readonly quantity: number;
}

export interface CartDraft {
  readonly id: string;
  readonly items: readonly CartItem[];
  readonly comment: string;
}

export interface ResolvedCartLine {
  readonly key: string;
  readonly product: Product;
  readonly variant: ProductVariant;
  readonly quantity: number;
  readonly totalKzt: number;
}

export interface ResolvedCart {
  readonly lines: readonly ResolvedCartLine[];
  readonly totalKzt: number;
  readonly itemCount: number;
  readonly issues: readonly string[];
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
}

export function cartItemKey(productId: string, variantId: string): string {
  return JSON.stringify([productId, variantId]);
}

function assertQuantity(quantity: number, allowZero = false): void {
  if (
    !Number.isInteger(quantity) ||
    quantity < (allowZero ? 0 : 1) ||
    quantity > MAX_ITEM_QUANTITY
  ) {
    throw new RangeError(`Количество должно быть от ${allowZero ? 0 : 1} до ${MAX_ITEM_QUANTITY}.`);
  }
}

export function validateCartItems(items: readonly CartItem[]): void {
  if (!Array.isArray(items) || items.length > MAX_CART_LINES) {
    throw new Error('Не удалось прочитать состав корзины.');
  }
  const keys = new Set<string>();
  for (const item of items) {
    if (!item || !validId(item.productId) || !validId(item.variantId)) {
      throw new Error('В корзине есть неизвестный напиток.');
    }
    assertQuantity(item.quantity);
    const key = cartItemKey(item.productId, item.variantId);
    if (keys.has(key)) throw new Error('В корзине повторяется один и тот же напиток.');
    keys.add(key);
  }
}

export function validateCartDraft(draft: CartDraft): void {
  if (!draft || !validId(draft.id)) throw new Error('Не удалось прочитать корзину.');
  validateCartItems(draft.items);
  if (typeof draft.comment !== 'string' || draft.comment.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Комментарий не должен превышать ${MAX_COMMENT_LENGTH} символов.`);
  }
}

let draftSequence = 0;

/** A local operation identifier, never an authentication credential. */
export function createEmptyCart(): CartDraft {
  draftSequence += 1;
  return {
    id: `draft-${Date.now().toString(36)}-${draftSequence.toString(36)}-${Math.random().toString(36).slice(2, 12)}`,
    items: [],
    comment: '',
  };
}

export function addCartItem(
  items: readonly CartItem[],
  productId: string,
  variantId: string,
  quantity = 1,
): readonly CartItem[] {
  validateCartItems(items);
  if (!validId(productId) || !validId(variantId)) throw new Error('Выберите напиток и объём.');
  assertQuantity(quantity);
  const key = cartItemKey(productId, variantId);
  const existing = items.find((item) => cartItemKey(item.productId, item.variantId) === key);
  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  assertQuantity(nextQuantity);
  const next = existing
    ? items.map((item) =>
        cartItemKey(item.productId, item.variantId) === key
          ? { ...item, quantity: nextQuantity }
          : { ...item },
      )
    : [...items.map((item) => ({ ...item })), { productId, variantId, quantity }];
  validateCartItems(next);
  return next;
}

export function setCartQuantity(
  items: readonly CartItem[],
  key: string,
  quantity: number,
): readonly CartItem[] {
  validateCartItems(items);
  assertQuantity(quantity, true);
  return quantity === 0
    ? removeCartItem(items, key)
    : items.map((item) =>
        cartItemKey(item.productId, item.variantId) === key ? { ...item, quantity } : { ...item },
      );
}

export function removeCartItem(items: readonly CartItem[], key: string): readonly CartItem[] {
  validateCartItems(items);
  return items
    .filter((item) => cartItemKey(item.productId, item.variantId) !== key)
    .map((item) => ({ ...item }));
}

export function resolveCart(
  items: readonly CartItem[],
  products: readonly Product[],
): ResolvedCart {
  const lines: ResolvedCartLine[] = [];
  const issues: string[] = [];
  try {
    validateCartItems(items);
  } catch (error) {
    return {
      lines,
      totalKzt: 0,
      itemCount: 0,
      issues: [error instanceof Error ? error.message : 'Не удалось прочитать корзину.'],
    };
  }
  for (const item of items) {
    const product = products.find((entry) => entry.id === item.productId);
    const variant = product?.variants.find((entry) => entry.id === item.variantId);
    if (!product || !variant) {
      issues.push(
        product
          ? `Выбранный объём «${product.name}» больше недоступен.`
          : 'Один из напитков больше недоступен.',
      );
      continue;
    }
    if (!Number.isSafeInteger(variant.priceKzt) || variant.priceKzt < 0) {
      issues.push(`Не удалось уточнить цену «${product.name}».`);
      continue;
    }
    const totalKzt = variant.priceKzt * item.quantity;
    if (!Number.isSafeInteger(totalKzt)) {
      issues.push(`Не удалось рассчитать стоимость «${product.name}».`);
      continue;
    }
    lines.push({
      key: cartItemKey(item.productId, item.variantId),
      product,
      variant,
      quantity: item.quantity,
      totalKzt,
    });
  }
  const totalKzt = lines.reduce((total, line) => total + line.totalKzt, 0);
  if (!Number.isSafeInteger(totalKzt)) issues.push('Сумма заказа слишком велика.');
  return {
    lines,
    totalKzt: Number.isSafeInteger(totalKzt) ? totalKzt : 0,
    itemCount: lines.reduce((total, line) => total + line.quantity, 0),
    issues,
  };
}

/** Persisted drafts may predate the current schema; malformed data must not reach checkout. */
export function parseStoredCart(value: unknown): CartDraft {
  try {
    const draft = value as CartDraft;
    validateCartDraft(draft);
    return {
      id: draft.id,
      comment: draft.comment,
      items: draft.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    };
  } catch {
    return createEmptyCart();
  }
}
