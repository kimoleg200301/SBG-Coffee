import { PrismaClient } from '@prisma/client';
import { seedProducts } from './catalog-seed';

export async function seedCatalog(prisma: PrismaClient) {
  // One transaction: an interruption never leaves only half of the menu updated.
  await prisma.$transaction(async (transaction) => {
    for (const [sortOrder, product] of seedProducts.entries()) {
      const { variants, ...fields } = product;
      const data = { ...fields, tag: product.tag ?? null, sortOrder, available: true };
      await transaction.product.upsert({ where: { id: product.id }, create: data, update: data });
      for (const [variantSortOrder, variant] of variants.entries()) {
        const variantData = { ...variant, productId: product.id, sortOrder: variantSortOrder, available: true };
        await transaction.productVariant.upsert({ where: { id: variant.id }, create: variantData, update: variantData });
      }
    }
  });
}
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production');
  const prisma = new PrismaClient();
  try {
    await seedCatalog(prisma);
    console.log(`Seed complete: ${seedProducts.length} products (safe to rerun).`);
  } finally { await prisma.$disconnect(); }
}
if (require.main === module) {
  void main().catch(() => {
    console.error('Seed failed. Check the database connection and migrations; demo seed is disabled in production.');
    process.exitCode = 1;
  });
}
