import { z } from 'zod';
import { addonSchema, productSchema, productVariantSchema } from '@sbg/contracts';

const availability = { available: z.boolean() };
const drinkSchema = productSchema.extend({
  ...availability,
  variants: z.array(productVariantSchema.extend(availability).strict()).min(1).max(50),
}).strict();
const dessertSchema = productSchema.pick({ id: true, name: true, description: true, tag: true }).extend({
  ...availability,
  variants: z.array(productVariantSchema.omit({ volumeMl: true }).extend(availability).strict()).min(1).max(50),
}).strict();

// Storage-oriented manifest: availability is explicit, and omitted records are left alone.
export const menuManifestSchema = z.object({
  version: z.literal(1),
  products: z.array(drinkSchema).max(10_000),
  desserts: z.array(dessertSchema).max(10_000),
  addons: z.array(addonSchema.extend(availability).strict()).max(20),
}).strict().superRefine((menu, context) => {
  const productIds = new Set<string>();
  const variantIds = new Set<string>();
  for (const collection of ['products', 'desserts'] as const) {
    menu[collection].forEach((product, index) => {
      if (productIds.has(product.id)) context.addIssue({ code: 'custom', path: [collection, index, 'id'], message: 'Duplicate product ID across menu' });
      productIds.add(product.id);
      product.variants.forEach((variant, variantIndex) => {
        if (variantIds.has(variant.id)) context.addIssue({ code: 'custom', path: [collection, index, 'variants', variantIndex, 'id'], message: 'Duplicate variant ID across menu' });
        variantIds.add(variant.id);
      });
    });
  }
  const addonIds = new Set<string>();
  menu.addons.forEach((addon, index) => {
    if (addonIds.has(addon.id)) context.addIssue({ code: 'custom', path: ['addons', index, 'id'], message: 'Duplicate addition ID' });
    addonIds.add(addon.id);
  });
});
export type MenuManifest = z.infer<typeof menuManifestSchema>;

function variant(id: string, label: string, volumeMl: number, priceKzt: number) {
  return { id, label, volumeMl, priceKzt, available: true };
}

// Transcribed from the three SBG menu cards. See docs/menu.md for source notes.
// Tea volume and syrup prices were explicitly confirmed by the owner.
// The legacy image enum is retained for v1; v2 maps the tea category to its own image.
export const realMenuManifest = menuManifestSchema.parse({
  version: 1,
  products: [
    {
      id: 'americano', name: 'Американо', description: 'Эспрессо и горячая вода.', category: 'coffee', image: 'americano', available: true,
      variants: [variant('americano-s', 'S', 250, 600), variant('americano-l', 'L', 400, 800)],
    },
    {
      id: 'cappuccino', name: 'Капучино', description: 'Эспрессо и молоко.', category: 'coffee', image: 'cappuccino', available: true,
      variants: [variant('cappuccino-s', 'S', 250, 800), variant('cappuccino-l', 'L', 400, 1300)],
    },
    {
      id: 'latte', name: 'Латте', description: 'Эспрессо и молоко.', category: 'coffee', image: 'latte', available: true,
      variants: [variant('latte-s', 'S', 250, 800), variant('latte-l', 'L', 400, 1300)],
    },
    {
      id: 'chocolate', name: 'Горячий шоколад', description: 'Шоколадный напиток с молоком.', category: 'coffee', image: 'chocolate', available: true,
      variants: [variant('chocolate-s', 'S', 250, 800), variant('chocolate-l', 'L', 400, 1200)],
    },
    {
      id: 'tea-black', name: 'Чёрный чай', description: 'Чёрный чай.', category: 'tea', image: 'americano', available: true,
      variants: [variant('tea-black-400', 'L', 400, 250)],
    },
    {
      id: 'tea-lemon', name: 'Чай с лимоном', description: 'Чёрный чай и лимон.', category: 'tea', image: 'americano', available: true,
      variants: [variant('tea-lemon-400', 'L', 400, 350)],
    },
    {
      id: 'tea-raspberry', name: 'Чай с малиной', description: 'Чай с малиной.', category: 'tea', image: 'americano', available: true,
      variants: [variant('tea-raspberry-400', 'L', 400, 400)],
    },
    {
      id: 'tea-honey-ginger', name: 'Медово-имбирный чай', description: 'Чай, мёд и имбирь.', category: 'tea', image: 'americano', available: true,
      variants: [variant('tea-honey-ginger-400', 'L', 400, 450)],
    },
    {
      id: 'tea-citrus-comfort', name: 'Цитрусовый уют', description: 'Апельсин, лимон и имбирь.', category: 'tea', image: 'americano', available: true,
      variants: [variant('tea-citrus-comfort-400', 'L', 400, 600)],
    },
    {
      id: 'pumpkin-cappuccino', name: 'Тыквенный капучино', description: 'Капучино с тыквенным вкусом.', category: 'seasonal', image: 'pumpkin', available: true,
      variants: [variant('pumpkin-cappuccino-s', 'S', 250, 1000)],
    },
    {
      id: 'pumpkin', name: 'Тыквенный латте', description: 'Латте с тыквенным вкусом.', category: 'seasonal', image: 'pumpkin', tag: 'Осенний вкус', available: true,
      variants: [variant('pumpkin-s', 'S', 250, 1000)],
    },
    {
      id: 'raf', name: 'Обычный раф', description: 'Кофе, сливки и ванильный сироп.', category: 'seasonal', image: 'latte', available: true,
      variants: [variant('raf-s', 'S', 250, 1000)],
    },
    {
      id: 'pumpkin-raf', name: 'Тыквенный раф', description: 'Кофе, сливки, ванильный и тыквенный сиропы.', category: 'seasonal', image: 'pumpkin', available: true,
      variants: [variant('pumpkin-raf-s', 'S', 250, 1000)],
    },
    {
      id: 'lavender', name: 'Лавандовый раф', description: 'Кофе, сливки, ванильный и лавандовый сиропы.', category: 'seasonal', image: 'lavender', tag: 'Сезонное', available: true,
      variants: [variant('lavender-s', 'S', 250, 1000)],
    },
  ],
  desserts: [{
    id: 'chocopie', name: 'Чокопай', description: 'Штучный десерт. Выберите вкус.', available: true,
    variants: [
      ['chocopie-original', 'Обычный'], ['chocopie-strawberry', 'Клубника'],
      ['chocopie-orange', 'Апельсин'], ['chocopie-cherry', 'Вишня'],
      ['chocopie-mango', 'Манго'], ['chocopie-blackcurrant', 'Чёрная смородина'],
    ].map(([id, label]) => ({ id, label, priceKzt: 200, available: true })),
  }],
  addons: [
    { id: 'lemon', name: 'Лимон', priceKzt: 100, available: true },
    { id: 'ginger', name: 'Имбирь', priceKzt: 100, available: true },
    { id: 'milk', name: 'Молоко', priceKzt: 100, available: true },
    { id: 'syrup-caramel', name: 'Сироп «Карамель»', priceKzt: 100, available: true },
    { id: 'syrup-salted-caramel', name: 'Сироп «Солёная карамель»', priceKzt: 100, available: true },
    { id: 'syrup-vanilla', name: 'Сироп «Ваниль»', priceKzt: 100, available: true },
    { id: 'syrup-popcorn', name: 'Сироп «Попкорн»', priceKzt: 100, available: true },
    { id: 'syrup-pomegranate', name: 'Сироп «Гранат»', priceKzt: 100, available: true },
    { id: 'syrup-mojito', name: 'Сироп «Мохито»', priceKzt: 100, available: true },
    { id: 'honey', name: 'Мёд', priceKzt: 200, available: true },
  ],
});
