import type { Addon, Product, ProductVariant } from './catalog';

export const MAX_ITEM_QUANTITY = 20;
export const MAX_COMMENT_LENGTH = 300;
const MAX_CART_LINES = 100;

export interface CartItem {
  readonly productId: string;
  readonly variantId: string;
  readonly quantity: number;
  /** Missing only in legacy drafts; it means no additions. */
  readonly addonIds?: readonly string[];
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
  readonly addons: readonly Addon[];
  readonly unitPriceKzt: number;
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

/** Reject duplicate portions, and normalize order so the same selection is one line. */
export function canonicalAddonIds(addonIds: readonly string[] = []): readonly string[] {
  if (!Array.isArray(addonIds) || addonIds.length > 20 || addonIds.some((id) => !validId(id)))
    throw new Error('Не удалось прочитать добавки.');
  if (new Set(addonIds).size !== addonIds.length)
    throw new Error('Каждую добавку можно выбрать только один раз.');
  return [...addonIds].sort();
}

export function cartItemKey(
  productId: string,
  variantId: string,
  addonIds: readonly string[] = [],
): string {
  return JSON.stringify([productId, variantId, canonicalAddonIds(addonIds)]);
}

function copyCartItem(item: CartItem): CartItem {
  return { ...item, addonIds: canonicalAddonIds(item.addonIds) };
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
      throw new Error('В корзине есть неизвестный товар.');
    }
    assertQuantity(item.quantity);
    const key = cartItemKey(item.productId, item.variantId, item.addonIds);
    if (keys.has(key)) throw new Error('В корзине повторяется одна и та же позиция.');
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
  addonIds: readonly string[] = [],
): readonly CartItem[] {
  validateCartItems(items);
  if (!validId(productId) || !validId(variantId)) throw new Error('Выберите товар и вариант.');
  assertQuantity(quantity);
  const selectedAddonIds = canonicalAddonIds(addonIds);
  const key = cartItemKey(productId, variantId, selectedAddonIds);
  const existing = items.find((item) => cartItemKey(item.productId, item.variantId, item.addonIds) === key);
  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  assertQuantity(nextQuantity);
  const next = existing
    ? items.map((item) =>
        cartItemKey(item.productId, item.variantId, item.addonIds) === key
          ? { ...copyCartItem(item), quantity: nextQuantity }
          : copyCartItem(item),
      )
    : [...items.map(copyCartItem), { productId, variantId, quantity, addonIds: selectedAddonIds }];
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
        cartItemKey(item.productId, item.variantId, item.addonIds) === key ? { ...copyCartItem(item), quantity } : copyCartItem(item),
      );
}

export function removeCartItem(items: readonly CartItem[], key: string): readonly CartItem[] {
  validateCartItems(items);
  return items
    .filter((item) => cartItemKey(item.productId, item.variantId, item.addonIds) !== key)
    .map(copyCartItem);
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
          ? `Выбранный вариант «${product.name}» больше недоступен.`
          : 'Один из товаров больше недоступен.',
      );
      continue;
    }
    if (!Number.isSafeInteger(variant.priceKzt) || variant.priceKzt < 0) {
      issues.push(`Не удалось уточнить цену «${product.name}».`);
      continue;
    }
    const selectedAddonIds = canonicalAddonIds(item.addonIds);
    const addons = selectedAddonIds.map((id) => product.addons.find((addon) => addon.id === id));
    if (addons.some((addon) => !addon) || (product.category === 'dessert' && selectedAddonIds.length)) {
      issues.push(`Выбранные добавки к «${product.name}» больше недоступны. Уберите позицию и выберите её заново.`);
      continue;
    }
    const availableAddons = addons as Addon[];
    if (availableAddons.some((addon) => !Number.isSafeInteger(addon.priceKzt) || addon.priceKzt < 0)) {
      issues.push(`Не удалось уточнить цену добавок к «${product.name}».`);
      continue;
    }
    const unitPriceKzt = availableAddons.reduce((total, addon) => total + addon.priceKzt, variant.priceKzt);
    const totalKzt = unitPriceKzt * item.quantity;
    if (!Number.isSafeInteger(totalKzt)) {
      issues.push(`Не удалось рассчитать стоимость «${product.name}».`);
      continue;
    }
    lines.push({
      key: cartItemKey(item.productId, item.variantId, item.addonIds),
      product,
      variant,
      addons: availableAddons,
      unitPriceKzt,
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
        addonIds: canonicalAddonIds(item.addonIds),
      })),
    };
  } catch {
    return createEmptyCart();
  }
}
