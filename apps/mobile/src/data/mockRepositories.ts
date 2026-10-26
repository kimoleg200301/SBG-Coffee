import type { Product } from '../domain/catalog';
import { LOYALTY_REWARD_TARGET, type LoyaltyCard } from '../domain/loyalty';
import type { AppRepositories, CatalogRepository } from './repositories';
import { createLocalCommerceRepositories } from './localCommerceRepositories';

// Prices and sizes follow the supplied SBG Coffee mockups.
const catalogFixture: readonly Product[] = Object.freeze(
  (
    [
      {
        id: 'americano',
        name: 'Американо',
        description: 'Эспрессо и горячая вода. Чистый вкус любимого кофе.',
        category: 'coffee',
        image: 'americano',
        variants: [
          { id: 'americano-s', label: 'S', volumeMl: 250, priceKzt: 600 },
          { id: 'americano-l', label: 'L', volumeMl: 400, priceKzt: 800 },
        ],
      },
      {
        id: 'cappuccino',
        name: 'Капучино',
        description: 'Эспрессо, молоко и нежная молочная пенка.',
        category: 'coffee',
        image: 'cappuccino',
        variants: [
          { id: 'cappuccino-s', label: 'S', volumeMl: 250, priceKzt: 800 },
          { id: 'cappuccino-l', label: 'L', volumeMl: 400, priceKzt: 1300 },
        ],
      },
      {
        id: 'latte',
        name: 'Латте',
        description: 'Мягкое сочетание эспрессо и тёплого молока.',
        category: 'coffee',
        image: 'latte',
        variants: [
          { id: 'latte-s', label: 'S', volumeMl: 250, priceKzt: 800 },
          { id: 'latte-l', label: 'L', volumeMl: 400, priceKzt: 1300 },
        ],
      },
      {
        id: 'chocolate',
        name: 'Горячий шоколад',
        description: 'Насыщенный шоколадный напиток с молоком.',
        category: 'coffee',
        image: 'chocolate',
        variants: [
          { id: 'chocolate-s', label: 'S', volumeMl: 250, priceKzt: 800 },
          { id: 'chocolate-l', label: 'L', volumeMl: 400, priceKzt: 1200 },
        ],
      },
      {
        id: 'pumpkin',
        name: 'Тыквенный латте',
        description: 'Эспрессо, молоко и тыквенный сироп. Мягкий вкус для уютной осени.',
        category: 'seasonal',
        image: 'pumpkin',
        tag: 'Осенний вкус',
        variants: [{ id: 'pumpkin-s', label: 'S', volumeMl: 250, priceKzt: 1000 }],
      },
      {
        id: 'lavender',
        name: 'Лавандовый раф',
        description: 'Нежный кофейный напиток с ароматом лаванды.',
        category: 'seasonal',
        image: 'lavender',
        tag: 'Сезонное',
        variants: [{ id: 'lavender-s', label: 'S', volumeMl: 250, priceKzt: 1000 }],
      },
    ] satisfies Product[]
  ).map((product) =>
    Object.freeze({
      ...product,
      variants: Object.freeze(product.variants.map((variant) => Object.freeze(variant))),
    }),
  ),
);

const loyaltyFixture: LoyaltyCard = Object.freeze({
  id: 'SBG-DEMO-0001',
  memberName: 'Гость SBG Coffee',
  stampsCollected: 0,
  rewardTarget: LOYALTY_REWARD_TARGET,
  rewardsAvailable: 0,
  isDemo: true,
});

/** Replace these adapters at the composition root when a backend is connected. */
export function createMockRepositories(): AppRepositories {
  const values = new Map<string, string>();
  const storage = {
    async getItem(key: string) {
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
  const catalog: CatalogRepository = {
    source: 'mock',
    async list() {
      return catalogFixture.map((product) => ({
        ...product,
        variants: product.variants.map((variant) => ({ ...variant })),
      }));
    },
  };
  return {
    catalog,
    loyalty: {
      async getCard() {
        return { ...loyaltyFixture };
      },
    },
    ...createLocalCommerceRepositories(storage, catalog),
  };
}

export const mockRepositories = createMockRepositories();
