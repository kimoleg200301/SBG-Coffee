import { catalogResponseSchema } from '@sbg/contracts';

// Original mobile menu preserved verbatim; explicit development seed only.
export const seedProducts = catalogResponseSchema.parse({
  fetchedAt: '2026-10-26T00:00:00.000Z',
  products: [
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
    ]
}).products;
