import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { callMcpToolForUser } from './mcp.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', '.data');
const SNAPSHOTS_FILE = path.join(DATA_DIR, 'ph-snapshots.json');

export const COLLECTION_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_SNAPSHOTS_PER_PERIOD = 120;
const MAX_PERIODS_STORED = 35;

export interface MakerEntry {
  name: string;
  username?: string;
  url?: string;
  headline?: string;
}

export interface SnapshotProductItem {
  slug: string;
  name: string;
  tagline: string;
  url: string | null;
  websiteUrl: string | null;
  thumbnailUrl: string | null;
  categories: string[];
  categorySlugs: string[];
  pricing: string | null;
  openSource: boolean;
  yc: boolean;
  hasMcpServer: boolean;
  points: number | null;
  rank: number | null;
  scoresHiddenUntil: string | null;
  reviewsCount: number | null;
  rating: number | null;
  commentsCount: number | null;
  launchedAt: string | null;
  makers: MakerEntry[];
  hunters: MakerEntry[];
}

export interface SnapshotRecord {
  capturedAt: string;
  periodKey: string;
  summaryText: string;
  items: SnapshotProductItem[];
}

interface SnapshotStore {
  periods: Record<string, SnapshotRecord[]>;
  lastCollectionAt: string | null;
  lastError: string | null;
}

export interface EnrichedLeaderboardEntry extends SnapshotProductItem {
  pointsDelta: number | null;
  pointsPerHour: number | null;
  velocitySource: 'snapshot_delta' | 'since_launch' | 'hidden';
  rankDelta: number | null;
  reviewsDelta: number | null;
  pulseScore: number | null;
  snapshotCountForProduct: number;
  pointsHidden: boolean;
}

export interface HunterLeaderboardRow {
  key: string;
  name: string;
  username: string | null;
  profileUrl: string | null;
  roleLabel: 'Hunter' | 'Maker';
  launchesCount: number;
  totalVisiblePoints: number | null;
  avgVisiblePoints: number | null;
  bestRank: number | null;
  totalReviews: number;
  topCategories: string[];
  products: Array<{
    slug: string;
    name: string;
    tagline: string;
    points: number | null;
    rank: number | null;
    url: string | null;
    launchedAt: string | null;
  }>;
}

let store: SnapshotStore = {
  periods: {},
  lastCollectionAt: null,
  lastError: null,
};

let schedulerHandle: ReturnType<typeof setInterval> | null = null;
let lastSchedulerTickAt: number | null = null;
let refreshInFlight: Promise<SnapshotRecord> | null = null;
let storeLoaded = false;

function ensureStoreLoaded() {
  if (storeLoaded) return;
  storeLoaded = true;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(SNAPSHOTS_FILE)) {
      const raw = fs.readFileSync(SNAPSHOTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<SnapshotStore>;
      if (parsed && typeof parsed === 'object' && parsed.periods) {
        store = {
          periods: parsed.periods,
          lastCollectionAt: parsed.lastCollectionAt || null,
          lastError: parsed.lastError || null,
        };
      }
    }
  } catch {
    // Keep clean in-memory store if disk load fails
  }
}

function persistStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const keys = Object.keys(store.periods);
    if (keys.length > MAX_PERIODS_STORED) {
      const sorted = keys.sort((a, b) => {
        const aLast = store.periods[a]?.[store.periods[a].length - 1]?.capturedAt || '';
        const bLast = store.periods[b]?.[store.periods[b].length - 1]?.capturedAt || '';
        return bLast.localeCompare(aLast);
      });
      for (const dropKey of sorted.slice(MAX_PERIODS_STORED)) {
        delete store.periods[dropKey];
      }
    }
    const tmpFile = `${SNAPSHOTS_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(store), 'utf-8');
    fs.renameSync(tmpFile, SNAPSHOTS_FILE);
  } catch {
    // Best-effort persistence
  }
}

export function getPacificDateString(offsetDays = 0): string {
  const target = new Date(Date.now() + offsetDays * 86400 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(target);
}

export interface IntelligenceStorageStatus {
  mode: 'local_file_ephemeral';
  survivesProcessRestart: boolean;
  survivesDeployment: boolean;
  notice: string;
}

export function getIntelligenceStorageStatus(): IntelligenceStorageStatus {
  return {
    mode: 'local_file_ephemeral',
    survivesProcessRestart: true,
    survivesDeployment: false,
    notice:
      'Snapshots are cached in local server storage (.data/ph-snapshots.json) and survive process restarts, but reset on fresh container deployments because no shared server snapshot database is configured. Your personal watchlists are saved permanently in Firebase.',
  };
}

export function isValidPeriodParam(dateParam?: string): boolean {
  if (!dateParam || !dateParam.trim()) return true;
  const clean = dateParam.trim();
  const lower = clean.toLowerCase();
  if (lower === 'today' || lower === 'yesterday') return true;
  return /^\d{4}(-\d{2}(-\d{2})?|-W\d{2})?$/.test(clean);
}

export function normalizePeriodKey(dateParam?: string): string {
  const clean = (dateParam || '').trim();
  if (!clean || clean.toLowerCase() === 'today') {
    return getPacificDateString(0);
  }
  if (clean.toLowerCase() === 'yesterday') {
    return getPacificDateString(-1);
  }
  if (!isValidPeriodParam(clean)) {
    throw new Error('Invalid date period format. Use today, yesterday, YYYY-MM-DD, YYYY-Www, or YYYY-MM.');
  }
  return clean;
}

export function setSnapshotsForTest(periods: Record<string, SnapshotRecord[]>): void {
  storeLoaded = true;
  store = {
    periods,
    lastCollectionAt: new Date().toISOString(),
    lastError: null,
  };
}

function extractMakersOrHunters(rawList: unknown): MakerEntry[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object'))
    .map((m) => ({
      name: String(m.name || m.username || 'Maker').trim(),
      username: typeof m.username === 'string' ? m.username : undefined,
      url: typeof m.url === 'string' ? m.url : undefined,
      headline: typeof m.headline === 'string' ? m.headline : undefined,
    }))
    .filter((m) => Boolean(m.name));
}

export function parseLeaderboardItems(data: Record<string, unknown> | null): SnapshotProductItem[] {
  if (!data) return [];
  const rawResults = Array.isArray(data.results) ? data.results : [];
  return rawResults
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
    .map((r) => {
      const launches = Array.isArray(r.launches)
        ? (r.launches.filter((l) => Boolean(l && typeof l === 'object')) as Array<
            Record<string, unknown>
          >)
        : [];
      const primaryLaunch = launches[0] || null;

      const points =
        typeof primaryLaunch?.points === 'number'
          ? primaryLaunch.points
          : typeof r.top_launch_points === 'number'
          ? r.top_launch_points
          : typeof r.points === 'number'
          ? r.points
          : null;

      const rank =
        typeof primaryLaunch?.daily_rank === 'number'
          ? primaryLaunch.daily_rank
          : typeof primaryLaunch?.rank === 'number'
          ? primaryLaunch.rank
          : typeof r.rank === 'number'
          ? r.rank
          : null;

      const scoresHiddenUntil =
        typeof primaryLaunch?.scores_hidden_until === 'string'
          ? primaryLaunch.scores_hidden_until
          : null;

      const launchedAt =
        typeof primaryLaunch?.launched_at === 'string'
          ? primaryLaunch.launched_at
          : typeof r.latest_launch_at === 'string'
          ? r.latest_launch_at
          : null;

      const rawCats = Array.isArray(r.categories) ? r.categories : [];
      const categories: string[] = [];
      const categorySlugs: string[] = [];
      for (const c of rawCats) {
        if (typeof c === 'string') {
          categories.push(c);
          categorySlugs.push(c.toLowerCase().replace(/\s+/g, '-'));
        } else if (c && typeof c === 'object') {
          const co = c as Record<string, unknown>;
          if (typeof co.name === 'string') categories.push(co.name);
          if (typeof co.slug === 'string') categorySlugs.push(co.slug);
        }
      }

      const commentsCount =
        typeof primaryLaunch?.comments_count === 'number'
          ? primaryLaunch.comments_count
          : typeof r.comments_count === 'number'
          ? r.comments_count
          : null;

      const reviewsCount = typeof r.reviews_count === 'number' ? r.reviews_count : null;
      const rating = typeof r.rating === 'number' ? r.rating : null;

      const makers = extractMakersOrHunters(r.makers);
      const singleHunter =
        r.hunter && typeof r.hunter === 'object' ? [r.hunter] : primaryLaunch?.hunter ? [primaryLaunch.hunter] : [];
      const hunters = extractMakersOrHunters(
        Array.isArray(r.hunters) ? r.hunters : singleHunter
      );

      return {
        slug: String(r.slug || r.name || 'unknown').trim(),
        name: String(r.name || 'Unnamed Product').trim(),
        tagline: String(r.tagline || '').trim(),
        url:
          typeof primaryLaunch?.url === 'string'
            ? primaryLaunch.url
            : typeof r.url === 'string'
            ? r.url
            : null,
        websiteUrl: typeof r.website_url === 'string' ? r.website_url : null,
        thumbnailUrl: typeof r.thumbnail_url === 'string' ? r.thumbnail_url : null,
        categories,
        categorySlugs,
        pricing: typeof r.pricing === 'string' ? r.pricing : null,
        openSource: r.open_source === true,
        yc: r.yc === true,
        hasMcpServer: r.has_mcp_server === true,
        points,
        rank,
        scoresHiddenUntil,
        reviewsCount,
        rating,
        commentsCount,
        launchedAt,
        makers,
        hunters,
      };
    });
}

export async function captureLeaderboardSnapshot(
  dateParam?: string,
  force = false
): Promise<SnapshotRecord> {
  const periodKey = normalizePeriodKey(dateParam);
  const existing = store.periods[periodKey] || [];
  const latest = existing[existing.length - 1];

  // Respect 20-second cooldown on repeated refreshes unless history is empty
  if (
    !force &&
    latest &&
    Date.now() - new Date(latest.capturedAt).getTime() < 20_000
  ) {
    return latest;
  }

  if (refreshInFlight && periodKey === getPacificDateString(0)) {
    return refreshInFlight;
  }

  const runCapture = async (): Promise<SnapshotRecord> => {
    const isToday = periodKey === getPacificDateString(0);
    const args: Record<string, unknown> = { limit: 25 };
    if (!isToday || (dateParam && /^\d{4}(-\d{2}(-\d{2})?|-W\d{2})?$/.test(dateParam))) {
      args.date = periodKey;
    }

    const res = await callMcpToolForUser(undefined, 'get_product_leaderboard', args);
    const items = parseLeaderboardItems(res.data);

    const record: SnapshotRecord = {
      capturedAt: new Date().toISOString(),
      periodKey,
      summaryText: res.summaryText || '',
      items,
    };

    const arr = store.periods[periodKey] || [];
    arr.push(record);
    if (arr.length > MAX_SNAPSHOTS_PER_PERIOD) {
      arr.splice(0, arr.length - MAX_SNAPSHOTS_PER_PERIOD);
    }
    store.periods[periodKey] = arr;
    store.lastCollectionAt = record.capturedAt;
    store.lastError = null;
    persistStore();
    return record;
  };

  try {
    const p = runCapture();
    if (periodKey === getPacificDateString(0)) {
      refreshInFlight = p;
    }
    return await p;
  } catch (err) {
    store.lastError =
      err instanceof Error ? err.message : 'Failed to capture Product Hunt snapshot.';
    persistStore();
    throw err;
  } finally {
    refreshInFlight = null;
  }
}

export function computeEnrichedEntries(snapshots: SnapshotRecord[]): EnrichedLeaderboardEntry[] {
  const latest = snapshots[snapshots.length - 1] || null;
  const previous = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;

  const firstBySlug = new Map<string, { item: SnapshotProductItem; capturedAt: string }>();
  const prevBySlug = new Map<string, { item: SnapshotProductItem; capturedAt: string }>();
  const countBySlug = new Map<string, number>();

  for (let i = 0; i < snapshots.length; i++) {
    const snap = snapshots[i];
    for (const item of snap.items) {
      countBySlug.set(item.slug, (countBySlug.get(item.slug) || 0) + 1);
      if (!firstBySlug.has(item.slug)) {
        firstBySlug.set(item.slug, { item, capturedAt: snap.capturedAt });
      }
      if (previous && snap.capturedAt === previous.capturedAt) {
        prevBySlug.set(item.slug, { item, capturedAt: snap.capturedAt });
      }
    }
  }

  const latestItems = latest?.items || [];
  const maxVisiblePoints = latestItems.reduce(
    (max, it) => (typeof it.points === 'number' && it.points > max ? it.points : max),
    0
  );

  return latestItems.map((item) => {
    const firstObs = firstBySlug.get(item.slug);
    const prevObs = prevBySlug.get(item.slug);
    const pointsHidden = item.points === null;

    let pointsDelta: number | null = null;
    let pointsPerHour: number | null = null;
    let velocitySource: 'snapshot_delta' | 'since_launch' | 'hidden' = 'hidden';

    if (!pointsHidden && item.points !== null) {
      if (
        firstObs &&
        firstObs.item.points !== null &&
        latest &&
        firstObs.capturedAt !== latest.capturedAt
      ) {
        const hours =
          (new Date(latest.capturedAt).getTime() - new Date(firstObs.capturedAt).getTime()) /
          3_600_000;
        pointsDelta = item.points - firstObs.item.points;
        if (hours >= 0.05) {
          pointsPerHour = Number((pointsDelta / hours).toFixed(2));
          velocitySource = 'snapshot_delta';
        }
      }

      if (pointsPerHour === null && item.launchedAt) {
        const launchMs = new Date(item.launchedAt).getTime();
        const refMs = latest ? new Date(latest.capturedAt).getTime() : Date.now();
        if (Number.isFinite(launchMs) && Number.isFinite(refMs) && refMs >= launchMs) {
          const elapsedHours = Math.max(0.25, Math.min(24, (refMs - launchMs) / 3_600_000));
          pointsPerHour = Number((item.points / elapsedHours).toFixed(2));
          velocitySource = 'since_launch';
        }
      }
    }

    const rankDelta =
      item.rank !== null && prevObs && prevObs.item.rank !== null
        ? prevObs.item.rank - item.rank
        : null;

    const reviewsDelta =
      item.reviewsCount !== null && firstObs && firstObs.item.reviewsCount !== null
        ? item.reviewsCount - firstObs.item.reviewsCount
        : null;

    // Pulse Score: transparent momentum index (0-100) calculated strictly from visible real signals
    let pulseScore: number | null = null;
    if (!pointsHidden && item.points !== null) {
      const pointRatio = maxVisiblePoints > 0 ? item.points / maxVisiblePoints : 0;
      const velocityBonus =
        pointsPerHour !== null ? Math.min(1, Math.max(0, pointsPerHour / 25)) : pointRatio;
      const engagementVal = item.commentsCount ?? item.reviewsCount;
      const engagementBonus =
        engagementVal !== null ? Math.min(1, Math.max(0, engagementVal / 20)) : 0;
      pulseScore = Math.round(
        pointRatio * 55 + velocityBonus * 30 + engagementBonus * 15
      );
    }

    return {
      ...item,
      pointsDelta,
      pointsPerHour,
      velocitySource,
      rankDelta,
      reviewsDelta,
      pulseScore,
      snapshotCountForProduct: countBySlug.get(item.slug) || 1,
      pointsHidden,
    };
  });
}

export function buildPersonLeaderboard(
  items: SnapshotProductItem[],
  role: 'Hunter' | 'Maker'
): HunterLeaderboardRow[] {
  const personMap = new Map<
    string,
    {
      key: string;
      name: string;
      username: string | null;
      profileUrl: string | null;
      roleLabel: 'Hunter' | 'Maker';
      products: Map<string, SnapshotProductItem>;
    }
  >();

  for (const item of items) {
    const list = role === 'Hunter' ? item.hunters : item.makers;
    for (const entry of list) {
      const key = (entry.username || entry.name).toLowerCase().trim();
      if (!key) continue;
      if (!personMap.has(key)) {
        personMap.set(key, {
          key,
          name: entry.name,
          username: entry.username || null,
          profileUrl: entry.url || null,
          roleLabel: role,
          products: new Map(),
        });
      }
      personMap.get(key)!.products.set(item.slug, item);
    }
  }

  return Array.from(personMap.values())
    .map((h) => {
      const prods = Array.from(h.products.values());
      const visiblePoints = prods
        .map((p) => p.points)
        .filter((v): v is number => typeof v === 'number');
      const ranks = prods
        .map((p) => p.rank)
        .filter((v): v is number => typeof v === 'number');
      const totalVisiblePoints =
        visiblePoints.length > 0
          ? visiblePoints.reduce((sum, v) => sum + v, 0)
          : null;
      const avgVisiblePoints =
        visiblePoints.length > 0
          ? Math.round(totalVisiblePoints! / visiblePoints.length)
          : null;
      const bestRank = ranks.length > 0 ? Math.min(...ranks) : null;
      const totalReviews = prods.reduce((sum, p) => sum + (p.reviewsCount ?? 0), 0);
      const cats = new Set<string>();
      for (const p of prods) {
        for (const c of p.categories) cats.add(c);
      }

      return {
        key: h.key,
        name: h.name,
        username: h.username,
        profileUrl: h.profileUrl,
        roleLabel: h.roleLabel,
        launchesCount: prods.length,
        totalVisiblePoints,
        avgVisiblePoints,
        bestRank,
        totalReviews,
        topCategories: Array.from(cats).slice(0, 4),
        products: prods.map((p) => ({
          slug: p.slug,
          name: p.name,
          tagline: p.tagline,
          points: p.points,
          rank: p.rank,
          url: p.url,
          launchedAt: p.launchedAt,
        })),
      };
    })
    .sort((a, b) => {
      if ((b.totalVisiblePoints ?? -1) !== (a.totalVisiblePoints ?? -1)) {
        return (b.totalVisiblePoints ?? -1) - (a.totalVisiblePoints ?? -1);
      }
      if (b.launchesCount !== a.launchesCount) return b.launchesCount - a.launchesCount;
      return a.name.localeCompare(b.name);
    });
}

export async function getLeaderboardIntelligence(params: {
  date?: string;
  sort?: string;
  category?: string;
  query?: string;
}) {
  ensureStoreLoaded();
  const periodKey = normalizePeriodKey(params.date);
  let snapshots = store.periods[periodKey] || [];

  if (snapshots.length === 0) {
    try {
      await captureLeaderboardSnapshot(periodKey, true);
      snapshots = store.periods[periodKey] || [];
    } catch {
      // Return empty with clear error metadata rather than crashing
    }
  }

  const latest = snapshots[snapshots.length - 1] || null;
  const latestItems = latest?.items || [];
  let entries = computeEnrichedEntries(snapshots);

  // Collect available categories before filtering
  const categorySet = new Set<string>();
  for (const entry of entries) {
    for (const c of entry.categories) categorySet.add(c);
  }

  // Filter by category & search query
  if (params.category && params.category !== 'all') {
    const target = params.category.toLowerCase();
    entries = entries.filter((e) =>
      e.categories.some((c) => c.toLowerCase() === target)
    );
  }
  if (params.query && params.query.trim()) {
    const q = params.query.trim().toLowerCase();
    entries = entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.tagline.toLowerCase().includes(q) ||
        e.makers.some((m) => m.name.toLowerCase().includes(q)) ||
        e.hunters.some((h) => h.name.toLowerCase().includes(q))
    );
  }

  // Sort strictly using real values (nulls last)
  const sortMode = params.sort || 'rank';
  entries.sort((a, b) => {
    if (sortMode === 'points') {
      return (b.points ?? -1) - (a.points ?? -1);
    }
    if (sortMode === 'speed') {
      return (b.pointsPerHour ?? -1) - (a.pointsPerHour ?? -1);
    }
    if (sortMode === 'comments') {
      const aVal = a.commentsCount ?? a.reviewsCount ?? -1;
      const bVal = b.commentsCount ?? b.reviewsCount ?? -1;
      return bVal - aVal;
    }
    if (sortMode === 'pulse') {
      return (b.pulseScore ?? -1) - (a.pulseScore ?? -1);
    }
    if (sortMode === 'name') {
      return a.name.localeCompare(b.name);
    }
    // default 'rank'
    if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
    if (a.rank !== null) return -1;
    if (b.rank !== null) return 1;
    return (b.points ?? -1) - (a.points ?? -1);
  });

  // Keep Hunters and Makers strictly separated — never label a Maker as a Hunter
  const hunterLeaderboard = buildPersonLeaderboard(latestItems, 'Hunter');
  const makerLeaderboard = buildPersonLeaderboard(latestItems, 'Maker');

  const nextSnapshotInSeconds = lastSchedulerTickAt
    ? Math.max(
        0,
        Math.round((lastSchedulerTickAt + COLLECTION_INTERVAL_MS - Date.now()) / 1000)
      )
    : 900;

  const scoresHiddenUntil =
    latestItems.find((i) => i.scoresHiddenUntil)?.scoresHiddenUntil || null;

  return {
    periodKey,
    todayPacific: getPacificDateString(0),
    yesterdayPacific: getPacificDateString(-1),
    lastUpdatedAt: latest?.capturedAt || store.lastCollectionAt,
    nextSnapshotInSeconds,
    collectionIntervalMinutes: 15,
    snapshotCount: snapshots.length,
    historyTimestamps: snapshots.map((s) => s.capturedAt),
    scoresHiddenUntil,
    pointsHidden: latestItems.length > 0 && latestItems.every((i) => i.points === null),
    summaryText: latest?.summaryText || '',
    sourceStatus: store.lastError ? 'error' : 'ok',
    sourceError: store.lastError,
    storageStatus: getIntelligenceStorageStatus(),
    availableCategories: Array.from(categorySet).sort(),
    availablePeriods: Object.keys(store.periods).sort().reverse(),
    entries,
    hunterLeaderboard,
    makerLeaderboard,
  };
}

export function getHistoricalSnapshots(params: { date?: string; slug?: string }) {
  ensureStoreLoaded();
  const periodKey = normalizePeriodKey(params.date);
  const snapshots = store.periods[periodKey] || [];

  const timeline = snapshots.map((snap) => {
    const visiblePoints = snap.items
      .map((i) => i.points)
      .filter((v): v is number => typeof v === 'number');
    const totalPoints =
      visiblePoints.length > 0 ? visiblePoints.reduce((s, v) => s + v, 0) : null;
    const avgPoints =
      visiblePoints.length > 0 ? Math.round(totalPoints! / visiblePoints.length) : null;
    const visibleReviews = snap.items
      .map((i) => i.reviewsCount)
      .filter((v): v is number => typeof v === 'number');
    const totalReviews =
      visibleReviews.length > 0 ? visibleReviews.reduce((s, v) => s + v, 0) : null;
    const targetProduct = params.slug
      ? snap.items.find(
          (i) => i.slug.toLowerCase() === params.slug!.toLowerCase()
        ) || null
      : null;

    return {
      capturedAt: snap.capturedAt,
      productCount: snap.items.length,
      totalPoints,
      avgPoints,
      totalReviews,
      productPoints: targetProduct ? targetProduct.points : null,
      productRank: targetProduct ? targetProduct.rank : null,
      productReviews: targetProduct ? targetProduct.reviewsCount : null,
    };
  });

  // Also summarize stored periods for multi-day historical comparison
  const periodSummaries = Object.entries(store.periods)
    .map(([key, snaps]) => {
      const latest = snaps[snaps.length - 1];
      if (!latest) return null;
      const visible = latest.items
        .map((i) => i.points)
        .filter((v): v is number => typeof v === 'number');
      const topItem = latest.items
        .filter((i) => typeof i.points === 'number')
        .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
      return {
        periodKey: key,
        snapshotCount: snaps.length,
        lastCapturedAt: latest.capturedAt,
        productsCount: latest.items.length,
        topProductName: topItem?.name || latest.items[0]?.name || null,
        topProductPoints: topItem?.points ?? null,
        totalVisiblePoints:
          visible.length > 0 ? visible.reduce((s, v) => s + v, 0) : null,
      };
    })
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey));

  return {
    periodKey,
    snapshotCount: snapshots.length,
    storageStatus: getIntelligenceStorageStatus(),
    timeline,
    periodSummaries,
    availableProducts:
      snapshots[snapshots.length - 1]?.items.map((i) => ({
        slug: i.slug,
        name: i.name,
      })) || [],
  };
}

export async function getProductPerformanceDetail(slugOrName: string) {
  const clean = slugOrName.trim();
  const [profileRes, altRes] = await Promise.allSettled([
    callMcpToolForUser(undefined, 'get_product_profile', { product_name: clean }),
    callMcpToolForUser(undefined, 'get_alternatives', { product: clean, limit: 6 }),
  ]);

  const profileData =
    profileRes.status === 'fulfilled' ? profileRes.value.data : null;
  const profileSummary =
    profileRes.status === 'fulfilled' ? profileRes.value.summaryText : '';
  const alternativesData =
    altRes.status === 'fulfilled' ? altRes.value.data : null;

  // Gather observed snapshot history for this product across all stored periods
  const snapshotHistory: Array<{
    periodKey: string;
    capturedAt: string;
    points: number | null;
    rank: number | null;
    reviewsCount: number | null;
  }> = [];

  for (const [periodKey, snaps] of Object.entries(store.periods)) {
    for (const snap of snaps) {
      const match = snap.items.find(
        (it) =>
          it.slug.toLowerCase() === clean.toLowerCase() ||
          it.name.toLowerCase() === clean.toLowerCase()
      );
      if (match) {
        snapshotHistory.push({
          periodKey,
          capturedAt: snap.capturedAt,
          points: match.points,
          rank: match.rank,
          reviewsCount: match.reviewsCount,
        });
      }
    }
  }

  snapshotHistory.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

  return {
    query: clean,
    profile: profileData,
    summaryText: profileSummary,
    alternatives: alternativesData,
    snapshotHistory,
  };
}

export async function getHunterAnalyticsDetail(nameOrUsername: string) {
  ensureStoreLoaded();
  const target = nameOrUsername.trim().toLowerCase();
  const matchedProducts = new Map<
    string,
    SnapshotProductItem & { periodKey: string; role: 'Hunter' | 'Maker' | 'Hunter & Maker' }
  >();
  let displayName = nameOrUsername.trim();
  let username: string | null = null;
  let profileUrl: string | null = null;
  let headline: string | null = null;
  const rolesObservedSet = new Set<'Hunter' | 'Maker'>();

  // Scan all captured snapshots across stored dates
  for (const [periodKey, snaps] of Object.entries(store.periods)) {
    const latestSnap = snaps[snaps.length - 1];
    if (!latestSnap) continue;
    for (const item of latestSnap.items) {
      const hunterMatch = item.hunters.find(
        (h) =>
          h.name.toLowerCase() === target ||
          (h.username && h.username.toLowerCase() === target)
      );
      const makerMatch = item.makers.find(
        (m) =>
          m.name.toLowerCase() === target ||
          (m.username && m.username.toLowerCase() === target)
      );
      const person = hunterMatch || makerMatch;
      if (person) {
        displayName = person.name || displayName;
        if (person.username) username = person.username;
        if (person.url) profileUrl = person.url;
        if (person.headline) headline = person.headline;
        if (hunterMatch) rolesObservedSet.add('Hunter');
        if (makerMatch) rolesObservedSet.add('Maker');
        const role: 'Hunter' | 'Maker' | 'Hunter & Maker' =
          hunterMatch && makerMatch ? 'Hunter & Maker' : hunterMatch ? 'Hunter' : 'Maker';
        matchedProducts.set(`${periodKey}:${item.slug}`, {
          ...item,
          periodKey,
          role,
        });
      }
    }
  }

  const launches = Array.from(matchedProducts.values()).sort((a, b) =>
    (b.launchedAt || b.periodKey).localeCompare(a.launchedAt || a.periodKey)
  );

  const visiblePoints = launches
    .map((l) => l.points)
    .filter((v): v is number => typeof v === 'number');
  const ranks = launches
    .map((l) => l.rank)
    .filter((v): v is number => typeof v === 'number');

  const categoriesCount = new Map<string, number>();
  for (const l of launches) {
    for (const c of l.categories) {
      categoriesCount.set(c, (categoriesCount.get(c) || 0) + 1);
    }
  }

  return {
    query: nameOrUsername.trim(),
    name: displayName,
    username,
    profileUrl,
    headline,
    rolesObserved: Array.from(rolesObservedSet),
    totalObservedLaunches: launches.length,
    totalVisiblePoints:
      visiblePoints.length > 0 ? visiblePoints.reduce((s, v) => s + v, 0) : null,
    avgVisiblePoints:
      visiblePoints.length > 0
        ? Math.round(visiblePoints.reduce((s, v) => s + v, 0) / visiblePoints.length)
        : null,
    bestRank: ranks.length > 0 ? Math.min(...ranks) : null,
    topCategories: Array.from(categoriesCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
    launches,
  };
}

export function startIntelligenceScheduler() {
  ensureStoreLoaded();
  if (schedulerHandle) return;

  const runInitialAndPeriodic = async () => {
    lastSchedulerTickAt = Date.now();
    try {
      await captureLeaderboardSnapshot(getPacificDateString(0), true);
      // Capture yesterday's completed leaderboard once if not yet cached for historical comparison
      const yesterday = getPacificDateString(-1);
      if (!store.periods[yesterday] || store.periods[yesterday].length === 0) {
        await captureLeaderboardSnapshot(yesterday, true);
      }
    } catch {
      // Errors are stored cleanly on store.lastError
    }
  };

  // Run initial collection asynchronously shortly after server starts
  setTimeout(() => {
    void runInitialAndPeriodic();
  }, 2000);

  schedulerHandle = setInterval(() => {
    lastSchedulerTickAt = Date.now();
    void captureLeaderboardSnapshot(getPacificDateString(0), true).catch(() => {});
  }, COLLECTION_INTERVAL_MS);
}
