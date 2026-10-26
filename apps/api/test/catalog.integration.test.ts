import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { catalogResponseSchema, apiErrorSchema } from '@sbg/contracts';
import { createApp } from '../src/bootstrap';
import { parseConfig } from '../src/config/config';
import { seedCatalog } from '../prisma/seed';
import { seedProducts } from '../prisma/catalog-seed';

test('migrations, repeatable seed, HTTP contracts, CORS and live PostgreSQL catalog', { timeout: 60_000 }, async () => {
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, 'Set DATABASE_URL to the dedicated integration PostgreSQL database');
  const original = new URL(databaseUrl);
  assert.match(original.pathname, /test/i, 'Integration database name must contain "test"; never run against user/production data');
  const schema = `sbg_it_${randomUUID().replaceAll('-', '')}`;
  const admin = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const scopedUrl = new URL(databaseUrl);
  scopedUrl.searchParams.set('schema', schema);
  const prisma = new PrismaClient({ datasources: { db: { url: scopedUrl.toString() } } });
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: scopedUrl.toString(), NODE_ENV: 'test' },
      stdio: 'pipe',
    });
    await seedCatalog(prisma);
    await seedCatalog(prisma);
    assert.equal(await prisma.product.count(), 6);
    assert.equal(await prisma.productVariant.count(), 10);
    app = await createApp(parseConfig({ DATABASE_URL: scopedUrl.toString(), NODE_ENV: 'test', CORS_ORIGINS: 'https://coffee.example' }), true);
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok', database: 'up' });
    const catalogResponse = await fetch(`${base}/api/v1/catalog/products`, { headers: { origin: 'https://coffee.example' } });
    assert.equal(catalogResponse.headers.get('access-control-allow-origin'), 'https://coffee.example');
    assert.equal(catalogResponse.headers.get('cache-control'), 'no-store');
    assert.ok(catalogResponse.headers.get('x-request-id'));
    const catalog = catalogResponseSchema.parse(await catalogResponse.json());
    assert.deepEqual(catalog.products, seedProducts);
    await prisma.productVariant.update({ where: { id: 'americano-s' }, data: { priceKzt: 725 } });
    const updated = catalogResponseSchema.parse(await (await fetch(`${base}/api/v1/catalog/products`)).json());
    assert.equal(updated.products[0]?.variants[0]?.priceKzt, 725, 'Response must read the database, not a fixture');
    await prisma.product.update({ where: { id: 'latte' }, data: { available: false } });
    const available = catalogResponseSchema.parse(await (await fetch(`${base}/api/v1/catalog/products`)).json());
    assert.equal(available.products.some((product) => product.id === 'latte'), false);
    const badRequest = await fetch(`${base}/api/v1/catalog/products?limit=invalid`);
    assert.equal(badRequest.status, 400);
    assert.equal(apiErrorSchema.parse(await badRequest.json()).error.code, 'BAD_REQUEST');
    const missing = await fetch(`${base}/missing`);
    assert.equal(missing.status, 404);
    assert.equal(apiErrorSchema.parse(await missing.json()).error.code, 'NOT_FOUND');
    const denied = await fetch(`${base}/health`, { headers: { origin: 'https://untrusted.example' } });
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
    const openapi = await (await fetch(`${base}/docs-json`)).json() as { paths: Record<string, unknown> };
    assert.ok(openapi.paths['/api/v1/catalog/products']);
    assert.ok(openapi.paths['/health']);
    await assert.rejects(prisma.productVariant.update({ where: { id: 'americano-s' }, data: { priceKzt: -1 } }));
  } finally {
    await app?.close();
    await prisma.$disconnect();
    // Only this test's random schema; never reset or truncate an existing database.
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
  }
});

test('unreachable PostgreSQL returns readiness/catalog 503 without leaking credentials', { timeout: 15_000 }, async () => {
  const app = await createApp(parseConfig({ DATABASE_URL: 'postgresql://sbg:secret-marker@127.0.0.1:1/sbg_test?connect_timeout=1', NODE_ENV: 'test' }), true);
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    for (const path of ['/health', '/api/v1/catalog/products']) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 503);
      const body = await response.text();
      assert.equal(body.includes('secret-marker'), false);
      assert.equal(apiErrorSchema.parse(JSON.parse(body)).error.code, 'DATABASE_UNAVAILABLE');
    }
  } finally { await app.close(); }
});
