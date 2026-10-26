import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HealthController } from '../src/modules/health/health.controller';
import type { PrismaService } from '../src/modules/database/prisma.service';

test('readiness depends on a successful PostgreSQL query', async () => {
  const ready = new HealthController({ $queryRaw: async () => [{ '?column?': 1 }] } as unknown as PrismaService);
  assert.deepEqual(await ready.readiness(), { status: 'ok', database: 'up' });
  const failed = new HealthController({ $queryRaw: async () => { throw new Error('database password must not leak'); } } as unknown as PrismaService);
  await assert.rejects(failed.readiness(), (error: Error & { getStatus?: () => number }) => {
    assert.equal(error.getStatus?.(), 503);
    assert.equal(error.message, 'Database is temporarily unavailable');
    return true;
  });
});
