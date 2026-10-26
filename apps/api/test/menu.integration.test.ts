import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { catalogResponseSchema, catalogV2ResponseSchema, apiErrorSchema } from '@sbg/contracts';
import { createApp } from '../src/bootstrap';
import { parseConfig } from '../src/config/config';
import { seedCatalog } from '../prisma/seed';
import { importMenu } from '../prisma/import-menu';
import { realMenuManifest } from '../prisma/real-menu';

async function snapshot(prisma: PrismaClient) {
  return Promise.all([
    prisma.product.findMany({ orderBy: { id: 'asc' } }),
    prisma.productVariant.findMany({ orderBy: { id: 'asc' } }),
    prisma.dessert.findMany({ orderBy: { id: 'asc' } }),
    prisma.dessertVariant.findMany({ orderBy: { id: 'asc' } }),
    prisma.addon.findMany({ orderBy: { id: 'asc' } }),
  ]);
}

test('real menu migrations, atomic repeatable imports, namespaces, availability and live v1/v2 HTTP', { timeout: 90_000 }, async () => {
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, 'Set DATABASE_URL to the dedicated integration PostgreSQL database');
  const original = new URL(databaseUrl);
  assert.match(original.pathname, /test/i, 'Integration database name must contain "test"; never run against user/production data');
  const schema = `sbg_menu_it_${randomUUID().replaceAll('-', '')}`;
  const scopedUrl = new URL(databaseUrl);
  scopedUrl.searchParams.set('schema', schema);
  const admin = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const prisma = new PrismaClient({ datasources: { db: { url: scopedUrl.toString() } } });
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_URL: scopedUrl.toString(), NODE_ENV: 'test' }, stdio: 'pipe',
    });
    await seedCatalog(prisma);
    // Records outside the manifest, including variants of managed products, survive imports.
    await prisma.product.create({ data: { id: 'unmanaged', name: 'Другой напиток', description: '', category: 'coffee', image: 'americano', available: false } });
    await prisma.productVariant.create({ data: { id: 'unmanaged-s', productId: 'unmanaged', label: 'S', volumeMl: 250, priceKzt: 333, available: false } });
    await prisma.productVariant.create({ data: { id: 'americano-unmanaged', productId: 'americano', label: 'Другой', volumeMl: 300, priceKzt: 333, available: false } });
    await prisma.addon.create({ data: { id: 'unmanaged-addon', name: 'Другое', priceKzt: 77, available: false } });
    const before = await snapshot(prisma);
    const dryRun = await importMenu(prisma);
    assert.equal(dryRun.applied, false);
    assert.equal(dryRun.counts.create, 33);
    assert.deepEqual(await snapshot(prisma), before, 'Dry run must not change even timestamps');
    const applied = await importMenu(prisma, realMenuManifest, true);
    assert.equal(applied.counts.create, 33);
    assert.equal(applied.applied, true);
    assert.equal(await prisma.product.count({ where: { available: true } }), 14);
    assert.equal(await prisma.productVariant.count({ where: { available: true } }), 18);
    assert.equal(await prisma.dessertVariant.count(), 6);
    assert.equal(await prisma.addon.count({ where: { available: true } }), 10);
    const imported = await snapshot(prisma);
    const repeated = await importMenu(prisma, realMenuManifest, true);
    assert.deepEqual(repeated.counts, { create: 0, update: 0, unchanged: 49 });
    assert.deepEqual(await snapshot(prisma), imported, 'Idempotent import does not touch timestamps or unrelated rows');
    assert.equal((await prisma.productVariant.findUniqueOrThrow({ where: { id: 'americano-unmanaged' } })).priceKzt, 333);
    assert.equal((await prisma.addon.findUniqueOrThrow({ where: { id: 'unmanaged-addon' } })).priceKzt, 77);

    // A late invalid value cannot leave earlier valid price changes applied.
    const invalid = structuredClone(realMenuManifest);
    invalid.products[0]!.variants[0]!.priceKzt = 999;
    invalid.addons.at(-1)!.priceKzt = -1;
    await assert.rejects(importMenu(prisma, invalid, true));
    assert.deepEqual(await snapshot(prisma), imported);
    // A database failure after earlier writes rolls back the whole transaction too.
    await prisma.$executeRaw`ALTER TABLE "Addon" ADD CONSTRAINT "test_honey_limit" CHECK ("id" <> 'honey' OR "priceKzt" <= 200)`;
    const failedWrite = structuredClone(realMenuManifest);
    failedWrite.products[0]!.variants[0]!.priceKzt = 999;
    failedWrite.addons.at(-1)!.priceKzt = 201;
    await assert.rejects(importMenu(prisma, failedWrite, true));
    assert.deepEqual(await snapshot(prisma), imported);
    await prisma.$executeRaw`ALTER TABLE "Addon" DROP CONSTRAINT "test_honey_limit"`;

    const newOwner = structuredClone(realMenuManifest);
    newOwner.products[0]!.id = 'new-owner';
    await assert.rejects(importMenu(prisma, newOwner, true), /reparenting is forbidden/);
    const newDessertOwner = structuredClone(realMenuManifest);
    newDessertOwner.desserts[0]!.id = 'new-dessert-owner';
    await assert.rejects(importMenu(prisma, newDessertOwner, true), /reparenting is forbidden/);
    assert.deepEqual(await snapshot(prisma), imported);

    // Hidden, unmanaged IDs still belong to the global product/variant namespaces.
    await prisma.dessert.create({ data: { id: 'hidden-dessert', name: 'Скрытый', description: '', available: false } });
    await prisma.dessertVariant.create({ data: { id: 'hidden-dessert-variant', dessertId: 'hidden-dessert', label: 'Штука', priceKzt: 10, available: false } });
    const collisionBaseline = await snapshot(prisma);
    for (const collision of ['drink-product', 'dessert-product', 'drink-variant', 'dessert-variant']) {
      const menu = structuredClone(realMenuManifest);
      menu.addons[0]!.priceKzt = 999;
      if (collision === 'drink-product') menu.products[0]!.id = 'hidden-dessert';
      if (collision === 'dessert-product') menu.desserts[0]!.id = 'unmanaged';
      if (collision === 'drink-variant') menu.products[0]!.variants[0]!.id = 'hidden-dessert-variant';
      if (collision === 'dessert-variant') menu.desserts[0]!.variants[0]!.id = 'unmanaged-s';
      await assert.rejects(importMenu(prisma, menu, true), /ID collision/);
      assert.deepEqual(await snapshot(prisma), collisionBaseline);
    }
    // Even a pre-existing collision between two unmanaged rows aborts safely.
    await prisma.dessert.create({ data: { id: 'unmanaged', name: 'Коллизия', description: '', available: false } });
    const collidingDatabase = await snapshot(prisma);
    await assert.rejects(importMenu(prisma, realMenuManifest, true), /ID collision/);
    assert.deepEqual(await snapshot(prisma), collidingDatabase);
    await prisma.dessert.delete({ where: { id: 'unmanaged' } });

    // Preserving extras must not make the resultant public DTO exceed its limits.
    await prisma.addon.createMany({ data: Array.from({ length: 11 }, (_, index) => ({ id: `extra-addon-${index}`, name: 'Дополнение', priceKzt: 1, available: true })) });
    const excessAddons = await snapshot(prisma);
    await assert.rejects(importMenu(prisma, realMenuManifest, true));
    assert.deepEqual(await snapshot(prisma), excessAddons);
    await prisma.addon.deleteMany({ where: { id: { startsWith: 'extra-addon-' } } });
    await prisma.productVariant.createMany({ data: Array.from({ length: 49 }, (_, index) => ({ id: `extra-variant-${index}`, productId: 'americano', label: 'Ещё', volumeMl: 300, priceKzt: 1 })) });
    const excessVariants = await snapshot(prisma);
    await assert.rejects(importMenu(prisma, realMenuManifest, true));
    assert.deepEqual(await snapshot(prisma), excessVariants);
    await prisma.productVariant.deleteMany({ where: { id: { startsWith: 'extra-variant-' } } });

    app = await createApp(parseConfig({ DATABASE_URL: scopedUrl.toString(), NODE_ENV: 'test' }), true);
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const getV2 = async () => {
      const response = await fetch(`${base}/api/v2/catalog/products`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      return catalogV2ResponseSchema.parse(await response.json());
    };
    const v1Response = await fetch(`${base}/api/v1/catalog/products`);
    assert.equal(v1Response.status, 200);
    const v1 = catalogResponseSchema.parse(await v1Response.json());
    assert.equal(v1.products.length, 14);
    assert.equal(v1.products.some((product) => 'addons' in product), false);
    assert.equal(v1.products.every((product) => product.variants.every((variant) => variant.volumeMl > 0)), true);
    const v2 = await getV2();
    assert.equal(v2.products.length, 15);
    assert.equal(v2.products.filter((product) => product.category === 'tea').every((product) => product.image === 'tea'), true);
    assert.equal(v2.products.find((product) => product.id === 'chocopie')?.variants.length, 6);
    assert.equal(v2.products.find((product) => product.id === 'chocopie')?.variants.every((variant) => variant.volumeMl === null), true);
    assert.ok(v2.products.filter((product) => product.category !== 'dessert').every((product) => product.addons.length === 10));
    assert.deepEqual(v2.products.find((product) => product.id === 'chocopie')?.addons, []);
    await prisma.addon.update({ where: { id: 'milk' }, data: { priceKzt: 175 } });
    await prisma.dessertVariant.update({ where: { id: 'chocopie-original' }, data: { priceKzt: 225 } });
    const live = await getV2();
    assert.equal(live.products[0]?.addons.find((addon) => addon.id === 'milk')?.priceKzt, 175);
    assert.equal(live.products.find((product) => product.id === 'chocopie')?.variants.find((variant) => variant.id === 'chocopie-original')?.priceKzt, 225);
    const hidden = structuredClone(realMenuManifest);
    hidden.products.find((product) => product.id === 'latte')!.available = false;
    hidden.products[0]!.variants[0]!.available = false;
    hidden.desserts[0]!.variants[0]!.available = false;
    hidden.addons.find((addon) => addon.id === 'milk')!.available = false;
    await importMenu(prisma, hidden, true);
    const filtered = await getV2();
    assert.equal(filtered.products.some((product) => product.id === 'latte'), false);
    assert.equal(filtered.products.find((product) => product.id === 'americano')?.variants.some((variant) => variant.id === 'americano-s'), false);
    assert.equal(filtered.products.find((product) => product.id === 'chocopie')?.variants.length, 5);
    assert.ok(filtered.products.every((product) => !product.addons.some((addon) => addon.id === 'milk')));
    const filteredV1 = catalogResponseSchema.parse(await (await fetch(`${base}/api/v1/catalog/products`)).json());
    assert.equal(filteredV1.products.some((product) => product.id === 'latte'), false);
    hidden.desserts[0]!.available = false;
    for (const variant of hidden.products[0]!.variants) variant.available = false;
    await importMenu(prisma, hidden, true);
    const noVariants = await getV2();
    assert.equal(noVariants.products.some((product) => product.id === 'americano'), false);
    assert.equal(noVariants.products.some((product) => product.id === 'chocopie'), false);
    const badQuery = await fetch(`${base}/api/v2/catalog/products?limit=1`);
    assert.equal(badQuery.status, 400);
    assert.equal(apiErrorSchema.parse(await badQuery.json()).error.code, 'BAD_REQUEST');
    const openapi = await (await fetch(`${base}/docs-json`)).json() as { paths: Record<string, unknown> };
    assert.ok(openapi.paths['/api/v1/catalog/products']);
    assert.ok(openapi.paths['/api/v2/catalog/products']);
    await assert.rejects(prisma.dessertVariant.update({ where: { id: 'chocopie-original' }, data: { priceKzt: -1 } }));
    await assert.rejects(prisma.addon.update({ where: { id: 'milk' }, data: { priceKzt: -1 } }));
  } finally {
    await app?.close();
    await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
  }
});
