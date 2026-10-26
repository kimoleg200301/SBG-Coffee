import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseConfig } from '../src/config/config';
const DATABASE_URL = 'postgresql://test:password@localhost:5432/sbg_test';

test('validates configuration and defaults to a LAN-reachable interface', () => {
  const config = parseConfig({ DATABASE_URL, CORS_ORIGINS: 'http://localhost:8081,https://coffee.example' });
  assert.equal(config.PORT, 3000);
  assert.equal(config.HOST, '0.0.0.0');
  assert.deepEqual(config.CORS_ORIGINS, ['http://localhost:8081', 'https://coffee.example']);
});
test('rejects missing/non-PostgreSQL URLs, invalid ports and wildcard CORS', () => {
  for (const environment of [{}, { DATABASE_URL: 'https://example.com' }, { DATABASE_URL, PORT: '0' }, { DATABASE_URL, CORS_ORIGINS: '*' }, { DATABASE_URL, CORS_ORIGINS: 'https://example.com/path' }]) {
    assert.throws(() => parseConfig(environment), /Invalid API configuration/);
  }
  try { parseConfig({ DATABASE_URL: 'not-a-url-secret-value' }); }
  catch (error) { assert.equal(String(error).includes('not-a-url-secret-value'), false); }
});
