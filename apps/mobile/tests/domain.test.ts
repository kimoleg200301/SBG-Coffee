import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMockRepositories } from '../src/data/mockRepositories';
import { filterProducts, formatPrice } from '../src/domain/catalog';
import { getLoyaltyProgress, type LoyaltyCard } from '../src/domain/loyalty';

describe('catalog filtering', () => {
  it('matches Russian search case-insensitively within the selected category', async () => {
    const products = await createMockRepositories().catalog.list();

    assert.deepEqual(
      filterProducts({ products, category: 'coffee', query: '  ЛаТтЕ  ' }).map(({ id }) => id),
      ['latte'],
    );
    assert.deepEqual(
      filterProducts({ products, category: 'seasonal', query: 'латте' }).map(({ id }) => id),
      ['pumpkin'],
    );
  });

  it('supports search without a category and treats е / ё equivalently', async () => {
    const products = await createMockRepositories().catalog.list();

    assert.equal(filterProducts({ products, query: 'латте' }).length, 2);
    assert.equal(filterProducts({ products, query: 'теплого' })[0]?.id, 'latte');
  });

  it('intersects favorites, category, and search without changing the input', async () => {
    const products = await createMockRepositories().catalog.list();
    const before = JSON.stringify(products);

    assert.deepEqual(
      filterProducts({
        products,
        category: 'seasonal',
        query: 'латте',
        favoriteIds: ['americano', 'pumpkin'],
        favoritesOnly: true,
      }).map(({ id }) => id),
      ['pumpkin'],
    );
    assert.deepEqual(filterProducts({ products, favoritesOnly: true }), []);
    assert.equal(JSON.stringify(products), before);
  });

  it('returns empty results for an unavailable category or unmatched query', async () => {
    const products = await createMockRepositories().catalog.list();

    assert.deepEqual(filterProducts({ products, category: 'tea' }), []);
    assert.deepEqual(filterProducts({ products, query: 'несуществующий напиток' }), []);
  });
});

describe('loyalty display progress', () => {
  const card: LoyaltyCard = {
    id: 'test-card',
    memberName: 'Гость',
    stampsCollected: 0,
    rewardTarget: 7,
    rewardsAvailable: 0,
    isDemo: true,
  };

  it('keeps empty, partial, and complete cards within the seven-stamp program', () => {
    assert.deepEqual(getLoyaltyProgress(card), {
      collected: 0,
      target: 7,
      remaining: 7,
      ratio: 0,
      isComplete: false,
      rewardsAvailable: 0,
    });
    const partial = getLoyaltyProgress({ ...card, stampsCollected: 3 });
    assert.equal(partial.remaining, 4);
    assert.equal(partial.ratio, 3 / 7);
    const complete = getLoyaltyProgress({ ...card, stampsCollected: 7, rewardsAvailable: 1 });
    assert.equal(complete.isComplete, true);
    assert.equal(complete.remaining, 0);
    assert.equal(complete.rewardsAvailable, 1);
  });

  it('clamps malformed progress without inventing redeemable rewards', () => {
    for (const value of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(getLoyaltyProgress({ ...card, stampsCollected: value }).collected, 0);
    }
    assert.equal(getLoyaltyProgress({ ...card, stampsCollected: 3.9 }).collected, 3);
    const overflow = getLoyaltyProgress({ ...card, stampsCollected: 15 });
    assert.equal(overflow.collected, 7);
    assert.equal(overflow.rewardsAvailable, 0);
    assert.equal(getLoyaltyProgress({ ...card, rewardsAvailable: -2 }).rewardsAvailable, 0);
  });
});

describe('mock repository boundaries', () => {
  it('returns separate nested product snapshots on every read', async () => {
    const repository = createMockRepositories().catalog;
    const first = await repository.list();
    const second = await repository.list();

    assert.notEqual(first, second);
    assert.notEqual(first[0], second[0]);
    assert.notEqual(first[0]?.variants, second[0]?.variants);
    const firstVariant = first[0]?.variants[0];
    assert.ok(firstVariant);
    (firstVariant as { priceKzt: number }).priceKzt = 1;
    assert.equal((await repository.list())[0]?.variants[0]?.priceKzt, 600);
  });

  it('does not share mutable loyalty state between reads or adapters', async () => {
    const repositories = createMockRepositories();
    const first = await repositories.loyalty.getCard();
    (first as { stampsCollected: number }).stampsCollected = 7;

    assert.equal((await repositories.loyalty.getCard()).stampsCollected, 0);
    assert.equal((await createMockRepositories().loyalty.getCard()).stampsCollected, 0);
    assert.equal((await repositories.loyalty.getCard()).isDemo, true);
  });
});

describe('KZT prices', () => {
  it('uses the tenge sign and readable thousands separators', () => {
    assert.equal(formatPrice(600), '600 ₸');
    assert.equal(formatPrice(1300), '1 300 ₸');
  });

  it('rejects invalid amounts', () => {
    assert.throws(() => formatPrice(-1), RangeError);
    assert.throws(() => formatPrice(Number.NaN), RangeError);
  });
});
