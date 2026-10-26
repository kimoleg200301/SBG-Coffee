export type Category = 'coffee' | 'tea' | 'seasonal';

export type ProductImageKey =
  'americano' | 'cappuccino' | 'latte' | 'chocolate' | 'pumpkin' | 'lavender';

export interface ProductVariant {
  readonly id: string;
  readonly label: string;
  readonly volumeMl: number;
  readonly priceKzt: number;
}

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: Category;
  readonly image: ProductImageKey;
  readonly variants: readonly ProductVariant[];
  readonly tag?: string;
}

export const CATEGORIES: readonly { readonly id: Category; readonly label: string }[] = [
  { id: 'coffee', label: 'Кофе' },
  { id: 'tea', label: 'Чай' },
  { id: 'seasonal', label: 'Сезонное' },
];

interface ProductFilters {
  readonly products: readonly Product[];
  readonly category?: Category;
  readonly query?: string;
  readonly favoriteIds?: readonly string[];
  readonly favoritesOnly?: boolean;
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

export function filterProducts({
  products,
  category,
  query = '',
  favoriteIds = [],
  favoritesOnly = false,
}: ProductFilters): readonly Product[] {
  const search = normalizeSearch(query);
  const favorites = new Set(favoriteIds);

  return products.filter((product) => {
    if (category && product.category !== category) return false;
    if (favoritesOnly && !favorites.has(product.id)) return false;
    if (!search) return true;

    return normalizeSearch(`${product.name} ${product.description} ${product.tag ?? ''}`).includes(
      search,
    );
  });
}

const priceFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

export function formatPrice(priceKzt: number): string {
  if (!Number.isFinite(priceKzt) || priceKzt < 0) {
    throw new RangeError('Price must be a finite, non-negative amount in KZT.');
  }

  return `${priceFormatter.format(priceKzt).replace(/[\u00a0\u202f]/g, ' ')} ₸`;
}
