import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPersonLeaderboard,
  computeEnrichedEntries,
  getHistoricalSnapshots,
  getHunterAnalyticsDetail,
  getIntelligenceStorageStatus,
  isValidPeriodParam,
  normalizePeriodKey,
  parseLeaderboardItems,
  setSnapshotsForTest,
  type SnapshotProductItem,
  type SnapshotRecord,
} from '../server/intelligence.ts';

function makeProduct(overrides: Partial<SnapshotProductItem> = {}): SnapshotProductItem {
  return {
    slug: 'alpha-tool',
    name: 'Alpha Tool',
    tagline: 'Ship faster',
    url: 'https://www.producthunt.com/posts/alpha-tool',
    websiteUrl: 'https://alphatool.example.com',
    thumbnailUrl: null,
    categories: ['Developer Tools'],
    categorySlugs: ['developer-tools'],
    pricing: 'Free',
    openSource: false,
    yc: false,
    hasMcpServer: false,
    points: 120,
    rank: 1,
    scoresHiddenUntil: null,
    reviewsCount: 10,
    rating: 4.9,
    commentsCount: 15,
    launchedAt: '2026-11-23T08:01:00Z',
    makers: [{ name: 'Alice Maker', username: 'alicemaker' }],
    hunters: [],
    ...overrides,
  };
}

test('isValidPeriodParam and normalizePeriodKey validate and reject malformed period strings', () => {
  assert.equal(isValidPeriodParam('today'), true);
  assert.equal(isValidPeriodParam('yesterday'), true);
  assert.equal(isValidPeriodParam('2026-11-23'), true);
  assert.equal(isValidPeriodParam('2026-W47'), true);
  assert.equal(isValidPeriodParam('2026-11'), true);
  assert.equal(isValidPeriodParam('invalid-date'), false);
  assert.equal(isValidPeriodParam('2026-11-23;drop'), false);

  assert.equal(normalizePeriodKey('2026-11-23'), '2026-11-23');
  assert.throws(() => normalizePeriodKey('not-a-period'));
});

test('parseLeaderboardItems keeps makers and hunters strictly separate and preserves hidden votes', () => {
  const parsed = parseLeaderboardItems({
    results: [
      {
        slug: 'blind-launch',
        name: 'Blind Launch',
        tagline: 'Testing blind window',
        makers: [{ name: 'Maker One', username: 'maker1' }],
        hunters: [],
        launches: [
          {
            points: null,
            daily_rank: null,
            scores_hidden_until: '2026-11-24T12:00:00Z',
            launched_at: '2026-11-24T08:01:00Z',
          },
        ],
      },
      {
        slug: 'hunted-launch',
        name: 'Hunted Launch',
        tagline: 'With separate hunter',
        makers: [{ name: 'Maker Two', username: 'maker2' }],
        hunter: { name: 'Hunter Pro', username: 'hunterpro' },
        reviews_count: null,
        launches: [{ points: 250, daily_rank: 2 }],
      },
    ],
  });

  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].points, null);
  assert.equal(parsed[0].rank, null);
  assert.equal(parsed[0].hunters.length, 0);
  assert.equal(parsed[0].makers.length, 1);

  assert.equal(parsed[1].points, 250);
  assert.equal(parsed[1].rank, 2);
  assert.equal(parsed[1].hunters.length, 1);
  assert.equal(parsed[1].hunters[0].username, 'hunterpro');
  assert.equal(parsed[1].reviewsCount, null);
});

test('buildPersonLeaderboard never shows Makers under Hunter role', () => {
  const items = [
    makeProduct({
      slug: 'p1',
      makers: [{ name: 'Pure Maker', username: 'puremaker' }],
      hunters: [],
    }),
    makeProduct({
      slug: 'p2',
      makers: [{ name: 'Pure Maker', username: 'puremaker' }],
      hunters: [{ name: 'Real Hunter', username: 'realhunter' }],
    }),
  ];

  const hunters = buildPersonLeaderboard(items, 'Hunter');
  const makers = buildPersonLeaderboard(items, 'Maker');

  assert.equal(hunters.length, 1);
  assert.equal(hunters[0].name, 'Real Hunter');
  assert.equal(hunters[0].roleLabel, 'Hunter');

  assert.equal(makers.length, 1);
  assert.equal(makers[0].name, 'Pure Maker');
  assert.equal(makers[0].roleLabel, 'Maker');
  assert.equal(makers[0].launchesCount, 2);
});

test('computeEnrichedEntries computes pointsDelta, pointsPerHour, rankDelta, pulseScore, and blind voting', () => {
  const snap1: SnapshotRecord = {
    capturedAt: '2026-11-23T10:00:00.000Z',
    periodKey: '2026-11-23',
    summaryText: '',
    items: [
      makeProduct({ slug: 'a', name: 'A', points: 100, rank: 3, reviewsCount: 4 }),
      makeProduct({ slug: 'b', name: 'B', points: 150, rank: 1, reviewsCount: 8 }),
      makeProduct({ slug: 'hidden', name: 'Hidden', points: null, rank: null, reviewsCount: null }),
    ],
  };

  const snap2: SnapshotRecord = {
    capturedAt: '2026-11-23T12:00:00.000Z',
    periodKey: '2026-11-23',
    summaryText: '',
    items: [
      makeProduct({ slug: 'a', name: 'A', points: 180, rank: 1, reviewsCount: 6 }),
      makeProduct({ slug: 'b', name: 'B', points: 170, rank: 2, reviewsCount: 8 }),
      makeProduct({ slug: 'hidden', name: 'Hidden', points: null, rank: null, reviewsCount: null }),
    ],
  };

  const enriched = computeEnrichedEntries([snap1, snap2]);
  const a = enriched.find((e) => e.slug === 'a')!;
  const b = enriched.find((e) => e.slug === 'b')!;
  const hidden = enriched.find((e) => e.slug === 'hidden')!;

  assert.equal(a.pointsDelta, 80);
  assert.equal(a.pointsPerHour, 40);
  assert.equal(a.velocitySource, 'snapshot_delta');
  assert.equal(a.rankDelta, 2); // moved from #3 to #1 (+2)
  assert.equal(a.reviewsDelta, 2);
  assert.ok(a.pulseScore !== null && a.pulseScore > 0 && a.pulseScore <= 100);

  assert.equal(b.rankDelta, -1); // moved from #1 to #2 (-1)
  assert.equal(hidden.pointsHidden, true);
  assert.equal(hidden.pointsPerHour, null);
  assert.equal(hidden.pulseScore, null);
  assert.equal(hidden.velocitySource, 'hidden');
});

test('getHistoricalSnapshots distinguishes null totalReviews from 0 and hunter analytics records accurate roles', async () => {
  setSnapshotsForTest({
    '2026-11-23': [
      {
        capturedAt: '2026-11-23T12:00:00.000Z',
        periodKey: '2026-11-23',
        summaryText: '',
        items: [
          makeProduct({
            slug: 'p1',
            reviewsCount: null,
            makers: [{ name: 'Dual User', username: 'dual' }],
            hunters: [{ name: 'Dual User', username: 'dual' }],
          }),
        ],
      },
    ],
  });

  const hist = getHistoricalSnapshots({ date: '2026-11-23' });
  assert.equal(hist.timeline[0].totalReviews, null);
  assert.equal(hist.storageStatus.mode, getIntelligenceStorageStatus().mode);

  const detail = await getHunterAnalyticsDetail('dual');
  assert.deepEqual(detail.rolesObserved, ['Hunter', 'Maker']);
  assert.equal(detail.launches[0].role, 'Hunter & Maker');
});
