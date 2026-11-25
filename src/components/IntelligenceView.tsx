import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  Award,
  Bookmark,
  ExternalLink,
  Flame,
  Gauge,
  History,
  MessageSquare,
  RefreshCw,
  Search,
  Star,
  Trash2,
  UserCheck,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  EnrichedLeaderboardEntry,
  HistoricalSnapshotsResponse,
  HunterAnalyticsResponse,
  LeaderboardIntelligenceResponse,
  ProductPerformanceResponse,
  SavedIntelligenceItem,
} from '../types';
import { authorizedFetch, formatTimestamp } from '../utils/validation';
import {
  PhBanner,
  PhCard,
  PhEmptyState,
  PhPageSection,
  PhProductThumbnail,
  PhSkeletonRows,
  PhVoteBox,
} from './ui/PhPrimitives';

interface IntelligenceViewProps {
  savedIntelligence: SavedIntelligenceItem[];
  onSaveIntelligence: (input: {
    kind: 'product' | 'hunter' | 'snapshot';
    slugOrKey: string;
    title: string;
    subtitle?: string;
    periodKey?: string;
    notes?: string;
    url?: string;
  }) => Promise<string>;
  onDeleteIntelligence: (itemId: string) => Promise<void>;
  externalSearchQuery?: string;
  onConsumeExternalSearch?: () => void;
}

type IntelSubTab =
  | 'points'
  | 'comments'
  | 'speed'
  | 'hunters'
  | 'pulse'
  | 'history'
  | 'product'
  | 'hunter';

const SUB_TABS: Array<{
  id: IntelSubTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'points', label: 'Points Leaderboard', icon: Award },
  { id: 'comments', label: 'Comments & Reviews', icon: MessageSquare },
  { id: 'speed', label: 'Speed Leaderboard', icon: Zap },
  { id: 'hunters', label: 'Makers & Hunters', icon: UserCheck },
  { id: 'pulse', label: 'Pulse Leaderboard', icon: Flame },
  { id: 'history', label: 'Historical Analytics', icon: History },
  { id: 'product', label: 'Product Performance', icon: Gauge },
  { id: 'hunter', label: 'Maker & Hunter Analytics', icon: Activity },
];

function extractObjField(obj: Record<string, unknown> | null, keys: string[]): unknown {
  if (!obj) return undefined;
  const inner =
    obj.product && typeof obj.product === 'object'
      ? (obj.product as Record<string, unknown>)
      : obj;
  for (const k of keys) {
    if (inner[k] !== undefined && inner[k] !== null) return inner[k];
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

export function IntelligenceView({
  savedIntelligence,
  onSaveIntelligence,
  onDeleteIntelligence,
  externalSearchQuery,
  onConsumeExternalSearch,
}: IntelligenceViewProps) {
  const [subTab, setSubTab] = useState<IntelSubTab>('points');
  const [periodPreset, setPeriodPreset] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [customDate, setCustomDate] = useState('');
  const [activeDateParam, setActiveDateParam] = useState<string>('today');

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'rank' | 'points' | 'speed' | 'comments' | 'pulse' | 'name'>('rank');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUiRefreshAt, setLastUiRefreshAt] = useState<string | null>(null);

  const [data, setData] = useState<LeaderboardIntelligenceResponse | null>(null);
  const [historyData, setHistoryData] = useState<HistoricalSnapshotsResponse | null>(null);
  const [historySlug, setHistorySlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshingSnapshot, setRefreshingSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Product Performance Page state
  const [productQueryInput, setProductQueryInput] = useState('');
  const [productDetail, setProductDetail] = useState<ProductPerformanceResponse | null>(null);
  const [productLoading, setProductLoading] = useState(false);

  // Maker & Hunter Analytics Page state
  const [personRoleTab, setPersonRoleTab] = useState<'makers' | 'hunters' | null>(null);
  const [hunterQueryInput, setHunterQueryInput] = useState('');
  const [hunterDetail, setHunterDetail] = useState<HunterAnalyticsResponse | null>(null);
  const [hunterLoading, setHunterLoading] = useState(false);

  useEffect(() => {
    if (externalSearchQuery !== undefined) {
      setSearchQuery(externalSearchQuery);
      setSubTab('points');
      onConsumeExternalSearch?.();
    }
  }, [externalSearchQuery, onConsumeExternalSearch]);

  const effectiveSort =
    subTab === 'speed'
      ? 'speed'
      : subTab === 'comments'
      ? 'comments'
      : subTab === 'pulse'
      ? 'pulse'
      : sortMode;

  const fetchIntelligence = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (activeDateParam && activeDateParam !== 'today') {
          qs.set('date', activeDateParam);
        }
        qs.set('sort', effectiveSort);
        if (categoryFilter && categoryFilter !== 'all') {
          qs.set('category', categoryFilter);
        }
        if (searchQuery.trim()) {
          qs.set('q', searchQuery.trim());
        }

        const histQs = new URLSearchParams();
        if (activeDateParam && activeDateParam !== 'today') {
          histQs.set('date', activeDateParam);
        }
        if (historySlug) {
          histQs.set('slug', historySlug);
        }

        const [lbRes, histRes] = await Promise.all([
          authorizedFetch<LeaderboardIntelligenceResponse>(
            `/api/intelligence/leaderboards?${qs.toString()}`
          ),
          authorizedFetch<HistoricalSnapshotsResponse>(
            `/api/intelligence/history?${histQs.toString()}`
          ),
        ]);

        setData(lbRes);
        setHistoryData(histRes);
        setLastUiRefreshAt(new Date().toISOString());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load Product Hunt intelligence.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [activeDateParam, effectiveSort, categoryFilter, searchQuery, historySlug]
  );

  useEffect(() => {
    void fetchIntelligence(false);
  }, [fetchIntelligence]);

  // 25-second live UI auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      void fetchIntelligence(true);
    }, 25_000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchIntelligence]);

  const handleForceSnapshotRefresh = async () => {
    setRefreshingSnapshot(true);
    setError(null);
    setNotice(null);
    try {
      const res = await authorizedFetch<LeaderboardIntelligenceResponse>(
        '/api/intelligence/refresh',
        {
          method: 'POST',
          body: JSON.stringify({
            date: activeDateParam === 'today' ? undefined : activeDateParam,
            sort: effectiveSort,
            category: categoryFilter,
            q: searchQuery.trim() || undefined,
          }),
        }
      );
      setData(res);
      setLastUiRefreshAt(new Date().toISOString());
      setNotice('Refreshed live Product Hunt snapshot from official MCP server.');
      void fetchIntelligence(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Snapshot refresh failed.');
    } finally {
      setRefreshingSnapshot(false);
    }
  };

  const applyPeriodChange = (preset: 'today' | 'yesterday' | 'custom') => {
    setPeriodPreset(preset);
    if (preset === 'today') {
      setActiveDateParam('today');
    } else if (preset === 'yesterday') {
      setActiveDateParam('yesterday');
    } else if (customDate.trim()) {
      setActiveDateParam(customDate.trim());
    }
  };

  const openProductPerformance = async (slugOrName: string) => {
    const clean = slugOrName.trim();
    if (!clean) return;
    setProductQueryInput(clean);
    setSubTab('product');
    setProductLoading(true);
    setError(null);
    try {
      const res = await authorizedFetch<ProductPerformanceResponse>(
        `/api/intelligence/product/${encodeURIComponent(clean)}`
      );
      setProductDetail(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load product performance.');
    } finally {
      setProductLoading(false);
    }
  };

  const openHunterAnalytics = async (nameOrUsername: string) => {
    const clean = nameOrUsername.trim();
    if (!clean) return;
    setHunterQueryInput(clean);
    setSubTab('hunter');
    setHunterLoading(true);
    setError(null);
    try {
      const res = await authorizedFetch<HunterAnalyticsResponse>(
        `/api/intelligence/hunter/${encodeURIComponent(clean)}`
      );
      setHunterDetail(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load hunter analytics.');
    } finally {
      setHunterLoading(false);
    }
  };

  const handleBookmark = async (input: {
    kind: 'product' | 'hunter' | 'snapshot';
    slugOrKey: string;
    title: string;
    subtitle?: string;
    url?: string;
  }) => {
    setError(null);
    setNotice(null);
    try {
      await onSaveIntelligence({
        ...input,
        periodKey: data?.periodKey,
      });
      setNotice(`Saved "${input.title}" to your Watchlist & Benchmarks.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save bookmark.');
    }
  };

  const formatTimeShort = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const renderPointsBadge = (entry: EnrichedLeaderboardEntry) => {
    if (entry.points === null) {
      return (
        <span className="text-xs font-medium text-[#92400E]">
          Votes Hidden
        </span>
      );
    }
    return (
      <span className="font-mono font-bold text-[#202020] tabular-nums">
        {entry.points.toLocaleString()} pts
      </span>
    );
  };

  const productProfileObj = productDetail?.profile || null;
  const productAlts = Array.isArray(productDetail?.alternatives?.results)
    ? (productDetail!.alternatives!.results as Array<Record<string, unknown>>)
    : Array.isArray(productDetail?.alternatives?.alternatives)
    ? (productDetail!.alternatives!.alternatives as Array<Record<string, unknown>>)
    : [];

  return (
    <PhPageSection className="space-y-6">
      {/* Header & Live Refresh Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#202020] tracking-tight">
            Live Product Hunt Intelligence
          </h1>
          <p className="text-sm text-[#777777] mt-1">
            Real-time Product Hunt leaderboards, launch velocity, pulse momentum, hunter rankings, and 15-minute server snapshot analytics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#EAEAEA] bg-white text-xs font-medium text-[#202020] cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-[#FF6154]"
            />
            Auto-refresh (25s)
          </label>
          <button
            type="button"
            disabled={refreshingSnapshot}
            onClick={handleForceSnapshotRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF6154] hover:bg-[#E54B3E] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshingSnapshot ? 'animate-spin' : ''}`} />
            {refreshingSnapshot ? 'Collecting...' : 'Refresh Live Snapshot'}
          </button>
        </div>
      </div>

      {/* Telemetry Strip: Strictly distinguishes UI Refresh vs Source Snapshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-[#EAEAEA] rounded-xl p-4">
          <p className="text-[11px] font-medium text-[#777777]">Selected Period (PT)</p>
          <p className="text-base font-bold font-mono text-[#202020] mt-1 tabular-nums">
            {data?.periodKey || '—'}
          </p>
          <p className="text-[11px] text-[#777777] mt-0.5 tabular-nums">
            {data?.entries.length ?? 0} tracked launches
          </p>
        </div>

        <div className="bg-white border border-[#EAEAEA] rounded-xl p-4">
          <p className="text-[11px] font-medium text-[#777777]">Last Source Snapshot (15m Collector)</p>
          <p className="text-base font-bold font-mono text-[#202020] mt-1 tabular-nums">
            {formatTimeShort(data?.lastUpdatedAt || null)}
          </p>
          <p className="text-[11px] text-[#777777] mt-0.5 tabular-nums">
            {data?.snapshotCount ?? 0} snapshots stored · next in {data?.nextSnapshotInSeconds ?? '—'}s
          </p>
        </div>

        <div className="bg-white border border-[#EAEAEA] rounded-xl p-4">
          <p className="text-[11px] font-medium text-[#777777]">Last UI Refresh (25s Poll)</p>
          <p className="text-base font-bold font-mono text-[#FF6154] mt-1 tabular-nums">
            {formatTimeShort(lastUiRefreshAt)}
          </p>
          <p className="text-[11px] text-[#777777] mt-0.5">
            {autoRefresh ? 'Live UI polling active' : 'Manual polling only'}
          </p>
        </div>

        <div className="bg-white border border-[#EAEAEA] rounded-xl p-4">
          <p className="text-[11px] font-medium text-[#777777]">MCP Feed Status</p>
          <p
            className={`text-base font-bold mt-1 ${
              data?.sourceStatus === 'ok' ? 'text-[#16A34A]' : 'text-[#D97706]'
            }`}
          >
            {loading && !data
              ? 'Loading...'
              : data?.sourceStatus === 'ok'
              ? 'Live Connected'
              : 'Source Warning'}
          </p>
          <p className="text-[11px] text-[#777777] mt-0.5 truncate">
            {data?.sourceError || 'Official Product Hunt MCP'}
          </p>
        </div>
      </div>

      {/* Storage & Persistence Status */}
      {data?.storageStatus && (
        <PhBanner tone="info">{data.storageStatus.notice}</PhBanner>
      )}

      {/* Blind Voting Window Notice when Product Hunt hides today's early scores */}
      {data?.pointsHidden && (
        <PhBanner tone="warning">
          <span className="font-semibold">Product Hunt Blind Voting Window Active:</span>{' '}
          Product Hunt hides upvote totals and daily ranks until{' '}
          <span className="font-mono font-semibold">
            {data.scoresHiddenUntil
              ? new Date(data.scoresHiddenUntil).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short',
                })
              : '4:00 AM PT'}
          </span>
          . HuntPilot displays “Votes Hidden” rather than estimating fake votes. Switch to{' '}
          <button
            type="button"
            onClick={() => applyPeriodChange('yesterday')}
            className="font-semibold text-[#FF6154] underline cursor-pointer"
          >
            Yesterday ({data.yesterdayPacific})
          </button>{' '}
          to inspect full completed point, speed, and pulse leaderboards.
        </PhBanner>
      )}

      {error && <PhBanner tone="error">{error}</PhBanner>}
      {notice && <PhBanner tone="success">{notice}</PhBanner>}

      {/* Filter & Period Toolbar */}
      <PhCard padding="p-4" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] font-medium text-[#555555] mb-1">Period</label>
          <div className="inline-flex rounded-lg border border-[#EAEAEA] bg-[#F3F3F3] p-0.5">
            <button
              type="button"
              onClick={() => applyPeriodChange('today')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                periodPreset === 'today'
                  ? 'bg-[#FF6154] text-white'
                  : 'text-[#555555] hover:text-[#202020]'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => applyPeriodChange('yesterday')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                periodPreset === 'yesterday'
                  ? 'bg-[#FF6154] text-white'
                  : 'text-[#555555] hover:text-[#202020]'
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('custom')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                periodPreset === 'custom'
                  ? 'bg-[#FF6154] text-white'
                  : 'text-[#555555] hover:text-[#202020]'
              }`}
            >
              Custom Date
            </button>
          </div>
        </div>

        {periodPreset === 'custom' && (
          <div className="flex items-end gap-1.5">
            <div>
              <label className="block text-[11px] font-medium text-[#555555] mb-1">
                YYYY-MM-DD / YYYY-Www / YYYY-MM
              </label>
              <input
                type="text"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                placeholder="e.g., 2026-11-23"
                className="px-3 py-1.5 rounded-lg border border-[#EAEAEA] text-xs font-mono text-[#202020] w-40 focus:outline-none focus:border-[#FF6154]"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (customDate.trim()) setActiveDateParam(customDate.trim());
              }}
              className="px-3 py-1.5 rounded-lg bg-[#202020] hover:bg-[#333333] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Load
            </button>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-medium text-[#555555] mb-1">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#EAEAEA] text-xs bg-white text-[#202020] focus:outline-none focus:border-[#FF6154]"
          >
            <option value="all">All Categories</option>
            {(data?.availableCategories || []).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[180px]">
          <label className="block text-[11px] font-medium text-[#555555] mb-1">Filter Results</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#999999] absolute left-3 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by product, tagline, or maker..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#EAEAEA] text-xs text-[#202020] focus:outline-none focus:border-[#FF6154]"
            />
          </div>
        </div>

        {(subTab === 'points' || subTab === 'speed' || subTab === 'comments' || subTab === 'pulse') && (
          <div>
            <label className="block text-[11px] font-medium text-[#555555] mb-1">Sort By</label>
            <select
              value={effectiveSort}
              onChange={(e) =>
                setSortMode(
                  e.target.value as 'rank' | 'points' | 'speed' | 'comments' | 'pulse' | 'name'
                )
              }
              className="px-3 py-1.5 rounded-lg border border-[#EAEAEA] text-xs bg-white text-[#202020] focus:outline-none focus:border-[#FF6154]"
            >
              <option value="rank">Daily Rank</option>
              <option value="points">Points</option>
              <option value="speed">Speed (pts/hr)</option>
              <option value="comments">Reviews / Comments</option>
              <option value="pulse">Pulse Score</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        )}
      </PhCard>

      {/* Sub-module Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-[#EAEAEA] pb-3">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`relative inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'text-[#CC3D31]'
                  : 'text-[#555555] hover:text-[#202020] hover:bg-[#F3F3F3]'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="intel-subtab-bg"
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-lg bg-[#FFF1F0] border border-[#FFD6D2]"
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#FF6154]' : ''}`} />
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* 1. POINTS LEADERBOARD — Authentic Product Hunt Discovery Feed */}
      {subTab === 'points' && (
        <PhCard className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#202020]">Points Leaderboard</h2>
              <p className="text-xs text-[#777777] mt-0.5">
                Ranked Product Hunt launches with real points, pricing, categories, and direct Product Performance inspection.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                handleBookmark({
                  kind: 'snapshot',
                  slugOrKey: data?.periodKey || 'today',
                  title: `Leaderboard Benchmark (${data?.periodKey || 'today'})`,
                  subtitle: `${data?.entries.length ?? 0} launches · Top: ${data?.entries[0]?.name || 'N/A'}`,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EAEAEA] bg-white hover:bg-[#F7F7F7] text-xs font-semibold text-[#202020] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Bookmark className="w-3.5 h-3.5 text-[#FF6154]" />
              Save Snapshot
            </button>
          </div>

          {loading && !data ? (
            <PhSkeletonRows rows={6} />
          ) : !data || data.entries.length === 0 ? (
            <PhEmptyState
              icon={<Award className="w-5 h-5" />}
              title="No launches match this filter"
              description="Try switching to Yesterday or clearing your search or category filter to inspect completed Product Hunt leaderboards."
            />
          ) : (
            <div className="divide-y divide-[#EAEAEA] border-t border-[#EAEAEA]">
              {data.entries.map((entry) => (
                <div
                  key={entry.slug}
                  className="py-3.5 px-2 -mx-2 rounded-xl hover:bg-[#FAFAFA] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    <span
                      className={`w-7 text-center font-mono text-sm font-bold tabular-nums shrink-0 ${
                        entry.rank !== null && entry.rank <= 3
                          ? 'text-[#FF6154]'
                          : entry.rank !== null
                          ? 'text-[#555555]'
                          : 'text-[#999999]'
                      }`}
                    >
                      {entry.rank !== null ? `#${entry.rank}` : '—'}
                    </span>

                    <PhProductThumbnail
                      src={entry.thumbnailUrl}
                      name={entry.name}
                      size="md"
                    />

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => openProductPerformance(entry.slug)}
                        className="text-sm font-bold text-[#202020] hover:text-[#FF6154] transition-colors text-left truncate block cursor-pointer"
                      >
                        {entry.name}
                      </button>
                      <p className="text-xs text-[#555555] line-clamp-1 mt-0.5">
                        {entry.tagline}
                      </p>

                      {/* Clean unboxed inline metadata */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#777777] mt-1.5">
                        {entry.categories.slice(0, 2).map((cat, idx) => (
                          <React.Fragment key={cat}>
                            {idx > 0 && <span aria-hidden="true">·</span>}
                            <span>{cat}</span>
                          </React.Fragment>
                        ))}
                        {entry.pricing && (
                          <>
                            {entry.categories.length > 0 && <span aria-hidden="true">·</span>}
                            <span>{entry.pricing}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {entry.reviewsCount !== null
                            ? `${entry.reviewsCount} reviews`
                            : 'Reviews N/A'}
                          {entry.rating !== null ? ` · ★ ${entry.rating.toFixed(1)}` : ''}
                        </span>
                        {entry.makers.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              Maker:{' '}
                              <button
                                type="button"
                                onClick={() =>
                                  openHunterAnalytics(
                                    entry.makers[0].username || entry.makers[0].name
                                  )
                                }
                                className="hover:text-[#FF6154] underline cursor-pointer"
                              >
                                {entry.makers[0].name}
                              </button>
                            </span>
                          </>
                        )}
                        {entry.hunters.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              Hunter:{' '}
                              <button
                                type="button"
                                onClick={() =>
                                  openHunterAnalytics(
                                    entry.hunters[0].username || entry.hunters[0].name
                                  )
                                }
                                className="hover:text-[#FF6154] underline cursor-pointer"
                              >
                                {entry.hunters[0].name}
                              </button>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => openProductPerformance(entry.slug)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#EAEAEA] bg-white hover:border-[#FF6154] hover:text-[#FF6154] text-xs font-semibold text-[#202020] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Inspect
                    </button>
                    <button
                      type="button"
                      title="Bookmark product"
                      onClick={() =>
                        handleBookmark({
                          kind: 'product',
                          slugOrKey: entry.slug,
                          title: entry.name,
                          subtitle: entry.tagline,
                          url: entry.url || undefined,
                        })
                      }
                      className="p-1.5 rounded-lg text-[#999999] hover:text-[#FF6154] hover:bg-[#FFF1F0] transition-colors cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                    </button>
                    {entry.url && (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-[#999999] hover:text-[#202020] hover:bg-[#F3F3F3] transition-colors"
                        title="Open on Product Hunt"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <PhVoteBox
                      points={entry.points}
                      hiddenLabel="Hidden"
                      onClick={() => openProductPerformance(entry.slug)}
                      compact
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </PhCard>
      )}

      {/* 2. COMMENTS & REVIEWS LEADERBOARD */}
      {subTab === 'comments' && (
        <PhCard className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#202020]">
                Comments &amp; Reviews Leaderboard
              </h2>
              <p className="text-xs text-[#777777] mt-0.5">
                Community discussion and review volume from Product Hunt MCP.
              </p>
            </div>
            <p className="text-[11px] text-[#777777]">
              Note: Product Hunt MCP exposes reviews_count &amp; rating; raw launch comment counts are shown only when present.
            </p>
          </div>

          {loading && !data ? (
            <PhSkeletonRows rows={5} />
          ) : !data || data.entries.length === 0 ? (
            <PhEmptyState
              icon={<MessageSquare className="w-5 h-5" />}
              title="No entries loaded"
              description="No launches match the selected period or filters."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#EAEAEA] text-xs text-[#777777]">
                    <th className="py-2.5 pr-4 font-medium">Product</th>
                    <th className="py-2.5 pr-4 font-medium">PH Reviews</th>
                    <th className="py-2.5 pr-4 font-medium">Rating</th>
                    <th className="py-2.5 pr-4 font-medium">Comments Count</th>
                    <th className="py-2.5 pr-4 font-medium">Reviews Delta</th>
                    <th className="py-2.5 text-right font-medium">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA]">
                  {data.entries.map((entry) => (
                    <tr key={entry.slug} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <PhProductThumbnail src={entry.thumbnailUrl} name={entry.name} size="sm" />
                          <div className="min-w-0">
                            <p className="font-semibold text-[#202020]">{entry.name}</p>
                            <p className="text-xs text-[#777777] line-clamp-1">{entry.tagline}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs font-bold text-[#202020] tabular-nums">
                        {entry.reviewsCount !== null ? entry.reviewsCount : 'N/A'}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-[#D97706] tabular-nums">
                        {entry.rating !== null ? `★ ${entry.rating.toFixed(1)}` : 'N/A'}
                      </td>
                      <td className="py-3 pr-4 text-xs text-[#555555] tabular-nums">
                        {entry.commentsCount !== null ? (
                          <span className="font-mono font-semibold text-[#202020]">
                            {entry.commentsCount}
                          </span>
                        ) : (
                          <span className="text-[#999999]">Not exposed by PH MCP</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-[#16A34A] tabular-nums">
                        {entry.reviewsDelta !== null && entry.reviewsDelta > 0
                          ? `+${entry.reviewsDelta}`
                          : entry.reviewsDelta === 0
                          ? '0'
                          : '—'}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openProductPerformance(entry.slug)}
                          className="text-xs font-semibold text-[#FF6154] hover:underline cursor-pointer"
                        >
                          Performance
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PhCard>
      )}

      {/* 3. SPEED LEADERBOARD */}
      {subTab === 'speed' && (
        <PhCard className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#202020]">
              Speed Leaderboard (Points Velocity)
            </h2>
            <p className="text-xs text-[#777777] mt-0.5">
              Real points-per-hour pace calculated from captured 15-minute server snapshots (or elapsed time since launch timestamp when points are visible).
            </p>
          </div>

          {loading && !data ? (
            <PhSkeletonRows rows={5} />
          ) : !data || data.entries.length === 0 ? (
            <PhEmptyState
              icon={<Zap className="w-5 h-5" />}
              title="No entries loaded"
              description="No launches match the selected period or filters."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#EAEAEA] text-xs text-[#777777]">
                    <th className="py-2.5 pr-4 font-medium">Product</th>
                    <th className="py-2.5 pr-4 font-medium">Current Points</th>
                    <th className="py-2.5 pr-4 font-medium">Velocity (pts/hr)</th>
                    <th className="py-2.5 pr-4 font-medium">Snapshot Delta</th>
                    <th className="py-2.5 pr-4 font-medium">Measurement Basis</th>
                    <th className="py-2.5 text-right font-medium">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA]">
                  {data.entries.map((entry) => (
                    <tr key={entry.slug} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <PhProductThumbnail src={entry.thumbnailUrl} name={entry.name} size="sm" />
                          <div className="min-w-0">
                            <p className="font-semibold text-[#202020]">{entry.name}</p>
                            <p className="text-xs text-[#777777] line-clamp-1">{entry.tagline}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-xs whitespace-nowrap">
                        {renderPointsBadge(entry)}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs font-bold text-[#FF6154] tabular-nums">
                        {entry.pointsPerHour !== null ? `${entry.pointsPerHour} pts/hr` : 'Hidden'}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-[#16A34A] tabular-nums">
                        {entry.pointsDelta !== null
                          ? `${entry.pointsDelta >= 0 ? '+' : ''}${entry.pointsDelta} pts`
                          : 'Baseline (1 snap)'}
                      </td>
                      <td className="py-3 pr-4 text-xs">
                        <span
                          className={`font-medium ${
                            entry.velocitySource === 'snapshot_delta'
                              ? 'text-[#15803D]'
                              : entry.velocitySource === 'since_launch'
                              ? 'text-[#555555]'
                              : 'text-[#92400E]'
                          }`}
                        >
                          {entry.velocitySource === 'snapshot_delta'
                            ? `15m Snapshot Delta (${entry.snapshotCountForProduct} snaps)`
                            : entry.velocitySource === 'since_launch'
                            ? 'Since Launch Timestamp'
                            : 'Votes Hidden Until 4AM PT'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openProductPerformance(entry.slug)}
                          className="text-xs font-semibold text-[#FF6154] hover:underline cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PhCard>
      )}

      {/* 4. MAKERS & HUNTERS LEADERBOARD */}
      {subTab === 'hunters' && (() => {
        const hunterRows = data?.hunterLeaderboard || [];
        const makerRows = data?.makerLeaderboard || [];
        const activeRoleView: 'hunters' | 'makers' =
          personRoleTab ?? (hunterRows.length > 0 ? 'hunters' : 'makers');
        const activeRows = activeRoleView === 'hunters' ? hunterRows : makerRows;

        return (
          <PhCard className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#202020]">
                  Makers &amp; Hunters Leaderboard
                </h2>
                <p className="text-xs text-[#777777] mt-0.5">
                  Roles are kept strictly separated based on fields returned by Product Hunt MCP.
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-[#EAEAEA] bg-[#F3F3F3] p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setPersonRoleTab('hunters')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    activeRoleView === 'hunters'
                      ? 'bg-[#FF6154] text-white'
                      : 'text-[#555555] hover:text-[#202020]'
                  }`}
                >
                  Hunters ({hunterRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPersonRoleTab('makers')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    activeRoleView === 'makers'
                      ? 'bg-[#FF6154] text-white'
                      : 'text-[#555555] hover:text-[#202020]'
                  }`}
                >
                  Makers ({makerRows.length})
                </button>
              </div>
            </div>

            {!data || activeRows.length === 0 ? (
              <PhEmptyState
                icon={<UserCheck className="w-5 h-5" />}
                title={
                  activeRoleView === 'hunters'
                    ? 'No separate hunter attribution found'
                    : 'No maker records observed yet'
                }
                description={
                  activeRoleView === 'hunters'
                    ? 'No separate hunter attribution was exposed by Product Hunt MCP for this period.'
                    : 'No maker records were observed for the selected period yet.'
                }
                action={
                  activeRoleView === 'hunters' && makerRows.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setPersonRoleTab('makers')}
                      className="text-xs font-semibold text-[#FF6154] underline cursor-pointer"
                    >
                      Switch to Makers ({makerRows.length})
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#EAEAEA] text-xs text-[#777777]">
                      <th className="py-2.5 pr-4 font-medium">
                        {activeRoleView === 'hunters' ? 'Hunter' : 'Maker'}
                      </th>
                      <th className="py-2.5 pr-4 font-medium">Verified Role</th>
                      <th className="py-2.5 pr-4 font-medium">Launches</th>
                      <th className="py-2.5 pr-4 font-medium">Visible Points</th>
                      <th className="py-2.5 pr-4 font-medium">Best Rank</th>
                      <th className="py-2.5 pr-4 font-medium">Top Categories</th>
                      <th className="py-2.5 text-right font-medium">Analytics</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAEAEA]">
                    {activeRows.map((h) => (
                      <tr key={`${h.roleLabel}-${h.key}`} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            onClick={() => openHunterAnalytics(h.username || h.name)}
                            className="font-semibold text-[#202020] hover:text-[#FF6154] text-left cursor-pointer"
                          >
                            {h.name}
                          </button>
                          {h.username && (
                            <p className="text-[11px] text-[#777777] font-mono">@{h.username}</p>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-xs">
                          <span
                            className={`font-semibold ${
                              h.roleLabel === 'Hunter' ? 'text-[#FF6154]' : 'text-[#202020]'
                            }`}
                          >
                            {h.roleLabel}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs font-bold text-[#202020] tabular-nums">
                          {h.launchesCount}
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-[#202020] tabular-nums">
                          {h.totalVisiblePoints !== null ? `${h.totalVisiblePoints} pts` : 'Hidden'}
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs font-semibold text-[#FF6154] tabular-nums">
                          {h.bestRank !== null ? `#${h.bestRank}` : '—'}
                        </td>
                        <td className="py-3 pr-4 text-xs text-[#555555]">
                          {h.topCategories.slice(0, 2).join(' · ') || '—'}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openHunterAnalytics(h.username || h.name)}
                              className="text-xs font-semibold text-[#FF6154] hover:underline cursor-pointer"
                            >
                              View Profile
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleBookmark({
                                  kind: 'hunter',
                                  slugOrKey: h.username || h.name,
                                  title: h.name,
                                  subtitle: `${h.launchesCount} launches · ${h.roleLabel}`,
                                  url: h.profileUrl || undefined,
                                })
                              }
                              className="p-1 text-[#999999] hover:text-[#FF6154] cursor-pointer"
                            >
                              <Bookmark className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PhCard>
        );
      })()}

      {/* 5. PULSE LEADERBOARD */}
      {subTab === 'pulse' && (
        <PhCard className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#202020]">
                Pulse Leaderboard (Momentum Index)
              </h2>
              <p className="text-xs text-[#777777] mt-0.5">
                Transparent composite momentum score (0–100) computed strictly from visible real points (55%), points/hr speed (30%), and review/comment volume (15%). Returns N/A while votes are hidden.
              </p>
            </div>
          </div>

          {loading && !data ? (
            <PhSkeletonRows rows={5} />
          ) : !data || data.entries.length === 0 ? (
            <PhEmptyState
              icon={<Flame className="w-5 h-5" />}
              title="No entries loaded"
              description="No launches match the selected period or filters."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#EAEAEA] text-xs text-[#777777]">
                    <th className="py-2.5 pr-4 font-medium">Product</th>
                    <th className="py-2.5 pr-4 font-medium">Pulse Index</th>
                    <th className="py-2.5 pr-4 font-medium">Points</th>
                    <th className="py-2.5 pr-4 font-medium">Speed</th>
                    <th className="py-2.5 pr-4 font-medium">Rank Shift</th>
                    <th className="py-2.5 text-right font-medium">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA]">
                  {data.entries.map((entry) => (
                    <tr key={entry.slug} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <PhProductThumbnail src={entry.thumbnailUrl} name={entry.name} size="sm" />
                          <div className="min-w-0">
                            <p className="font-semibold text-[#202020]">{entry.name}</p>
                            <p className="text-xs text-[#777777] line-clamp-1">{entry.tagline}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        {entry.pulseScore !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-[#F3F3F3] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#FF6154]"
                                style={{ width: `${Math.min(100, entry.pulseScore)}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs font-bold text-[#FF6154] tabular-nums">
                              {entry.pulseScore}/100
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-[#999999]">Hidden until 4AM PT</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs">{renderPointsBadge(entry)}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-[#FF6154] tabular-nums">
                        {entry.pointsPerHour !== null ? `${entry.pointsPerHour}/hr` : '—'}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs tabular-nums">
                        {entry.rankDelta === null ? (
                          <span className="text-[#999999]">—</span>
                        ) : entry.rankDelta > 0 ? (
                          <span className="text-[#16A34A] font-semibold">▲ +{entry.rankDelta}</span>
                        ) : entry.rankDelta < 0 ? (
                          <span className="text-[#DC2626] font-semibold">▼ {entry.rankDelta}</span>
                        ) : (
                          <span className="text-[#777777]">0</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openProductPerformance(entry.slug)}
                          className="text-xs font-semibold text-[#FF6154] hover:underline cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PhCard>
      )}

      {/* 6. HISTORICAL ANALYTICS & BOOKMARKS */}
      {subTab === 'history' && (
        <div className="space-y-6">
          <PhCard className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#202020]">
                  Captured Snapshot Trajectory ({historyData?.periodKey || '—'})
                </h2>
                <p className="text-xs text-[#777777] mt-0.5">
                  Time-series points &amp; review progression recorded by the 15-minute background collector.
                </p>
              </div>
              <select
                value={historySlug}
                onChange={(e) => setHistorySlug(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-[#EAEAEA] text-xs bg-white text-[#202020] max-w-xs focus:outline-none focus:border-[#FF6154]"
              >
                <option value="">All Top Launches (Aggregate Points)</option>
                {(historyData?.availableProducts || []).map((p) => (
                  <option key={p.slug} value={p.slug}>
                    Track Product: {p.name}
                  </option>
                ))}
              </select>
            </div>

            {!historyData || historyData.timeline.length === 0 ? (
              <PhEmptyState
                icon={<History className="w-5 h-5" />}
                title="No snapshots recorded yet"
                description="No snapshots recorded yet for this period. Click “Refresh Live Snapshot” to capture now."
              />
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart
                    data={historyData.timeline.map((t) => ({
                      time: formatTimeShort(t.capturedAt),
                      points: historySlug ? t.productPoints : t.totalPoints,
                      reviews: historySlug ? t.productReviews : t.totalReviews,
                    }))}
                    margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#777777' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#777777' }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #EAEAEA',
                        fontSize: '12px',
                        color: '#202020',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="points"
                      name={historySlug ? 'Product Points' : 'Total Visible Points'}
                      stroke="#FF6154"
                      fill="#FFE8E5"
                      strokeWidth={2}
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </PhCard>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Multi-Period Archive Summary */}
            <PhCard className="lg:col-span-7 space-y-4">
              <h3 className="text-sm font-bold text-[#202020]">
                Stored Periods Archive ({historyData?.periodSummaries.length ?? 0})
              </h3>
              {!historyData || historyData.periodSummaries.length === 0 ? (
                <p className="text-xs text-[#777777]">No historical periods archived yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#EAEAEA] text-[#777777]">
                        <th className="py-2 pr-3 font-medium">Period</th>
                        <th className="py-2 pr-3 font-medium">Snapshots</th>
                        <th className="py-2 pr-3 font-medium">Top Product</th>
                        <th className="py-2 pr-3 font-medium">Top Pts</th>
                        <th className="py-2 text-right font-medium">Open</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAEAEA]">
                      {historyData.periodSummaries.map((p) => (
                        <tr key={p.periodKey} className="hover:bg-[#FAFAFA]">
                          <td className="py-2.5 pr-3 font-mono font-semibold text-[#202020]">
                            {p.periodKey}
                          </td>
                          <td className="py-2.5 pr-3 font-mono tabular-nums text-[#555555]">
                            {p.snapshotCount}
                          </td>
                          <td className="py-2.5 pr-3 truncate max-w-[160px] text-[#202020]">
                            {p.topProductName || '—'}
                          </td>
                          <td className="py-2.5 pr-3 font-mono font-semibold text-[#FF6154] tabular-nums">
                            {p.topProductPoints !== null ? `${p.topProductPoints}` : 'Hidden'}
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setPeriodPreset('custom');
                                setCustomDate(p.periodKey);
                                setActiveDateParam(p.periodKey);
                              }}
                              className="text-xs font-semibold text-[#FF6154] hover:underline cursor-pointer"
                            >
                              Load
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PhCard>

            {/* Saved Watchlist & Intelligence Bookmarks */}
            <PhCard className="lg:col-span-5 space-y-4">
              <h3 className="text-sm font-bold text-[#202020]">
                Saved Intelligence Watchlist ({savedIntelligence.length})
              </h3>
              {savedIntelligence.length === 0 ? (
                <p className="text-xs text-[#777777]">
                  Bookmark products, hunters, or daily snapshots to build your personal benchmark library.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {savedIntelligence.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-[#EAEAEA] bg-[#FAFAFA] hover:bg-[#F3F3F3] transition-colors flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (item.kind === 'product') openProductPerformance(item.slugOrKey);
                          else if (item.kind === 'hunter') openHunterAnalytics(item.slugOrKey);
                          else if (item.periodKey) {
                            setPeriodPreset('custom');
                            setCustomDate(item.periodKey);
                            setActiveDateParam(item.periodKey);
                            setSubTab('points');
                          }
                        }}
                        className="text-left min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-[11px] font-semibold uppercase text-[#FF6154] shrink-0">
                            {item.kind}
                          </span>
                          <span aria-hidden="true" className="text-[#CCCCCC]">·</span>
                          <p className="font-semibold text-[#202020] truncate">
                            {item.title}
                          </p>
                        </div>
                        {item.subtitle && (
                          <p className="text-[11px] text-[#777777] truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteIntelligence(item.id)}
                        className="p-1 text-[#999999] hover:text-[#DC2626] transition-colors cursor-pointer shrink-0"
                        title="Remove bookmark"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </PhCard>
          </div>
        </div>
      )}

      {/* 7. PRODUCT PERFORMANCE PAGE */}
      {subTab === 'product' && (
        <PhCard className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void openProductPerformance(productQueryInput);
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <input
              type="text"
              value={productQueryInput}
              onChange={(e) => setProductQueryInput(e.target.value)}
              placeholder="Enter Product Hunt slug or name (e.g., cursor, linear, notion)..."
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-[#EAEAEA] text-sm text-[#202020] focus:outline-none focus:border-[#FF6154]"
            />
            <button
              type="submit"
              disabled={productLoading}
              className="px-5 py-2.5 rounded-lg bg-[#FF6154] hover:bg-[#E54B3E] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {productLoading ? 'Loading Product...' : 'Inspect Product Performance'}
            </button>
          </form>

          {!productDetail ? (
            <PhEmptyState
              icon={<Gauge className="w-5 h-5" />}
              title="Inspect any Product Hunt launch"
              description="Search any Product Hunt product above or click “Inspect” on any leaderboard row to view full profile metrics, sentiment pros/cons, snapshot trajectory, and alternatives."
            />
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#EAEAEA]">
                <div>
                  <p className="text-xs font-semibold text-[#FF6154]">
                    Official Product Hunt Performance Profile
                  </p>
                  <h2 className="text-xl font-bold text-[#202020] mt-0.5">
                    {String(extractObjField(productProfileObj, ['name']) || productDetail.query)}
                  </h2>
                  {Boolean(extractObjField(productProfileObj, ['tagline'])) && (
                    <p className="text-sm text-[#555555] mt-1">
                      {String(extractObjField(productProfileObj, ['tagline']))}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      handleBookmark({
                        kind: 'product',
                        slugOrKey: productDetail.query,
                        title: String(
                          extractObjField(productProfileObj, ['name']) || productDetail.query
                        ),
                        subtitle: String(extractObjField(productProfileObj, ['tagline']) || ''),
                        url:
                          (extractObjField(productProfileObj, ['url']) as string | undefined) ||
                          undefined,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EAEAEA] bg-white hover:bg-[#F7F7F7] text-xs font-semibold text-[#202020] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-[#FF6154]" />
                    Bookmark
                  </button>
                  {Boolean(extractObjField(productProfileObj, ['url'])) && (
                    <a
                      href={String(extractObjField(productProfileObj, ['url']))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#202020] hover:bg-[#333333] text-white text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      Open on PH <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#EAEAEA]">
                  <p className="text-[#777777]">Top Launch Points</p>
                  <p className="text-lg font-bold font-mono text-[#FF6154] mt-1 tabular-nums">
                    {String(extractObjField(productProfileObj, ['top_launch_points', 'points']) ?? 'N/A')}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#EAEAEA]">
                  <p className="text-[#777777]">Reviews</p>
                  <p className="text-lg font-bold font-mono text-[#202020] mt-1 tabular-nums">
                    {String(extractObjField(productProfileObj, ['reviews_count', 'review_count']) ?? 'N/A')}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#EAEAEA]">
                  <p className="text-[#777777]">Rating</p>
                  <p className="text-lg font-bold font-mono text-[#D97706] mt-1 tabular-nums flex items-center gap-1">
                    <Star className="w-4 h-4 fill-[#F59E0B] text-[#F59E0B]" />
                    {String(extractObjField(productProfileObj, ['rating']) ?? 'N/A')}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#EAEAEA]">
                  <p className="text-[#777777]">Pricing Model</p>
                  <p className="text-sm font-bold text-[#202020] mt-1.5">
                    {String(extractObjField(productProfileObj, ['pricing']) || 'Unspecified')}
                  </p>
                </div>
              </div>

              {productDetail.snapshotHistory.length > 0 && (
                <div className="p-4 rounded-xl border border-[#EAEAEA] bg-white space-y-2">
                  <p className="text-xs font-bold text-[#202020]">
                    Observed Snapshot History ({productDetail.snapshotHistory.length} snapshots)
                  </p>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart
                        data={productDetail.snapshotHistory.map((s) => ({
                          time: `${s.periodKey} ${formatTimeShort(s.capturedAt)}`,
                          points: s.points,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" />
                        <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#777777' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#777777' }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #EAEAEA',
                            fontSize: '12px',
                            color: '#202020',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="points"
                          name="Points"
                          stroke="#FF6154"
                          strokeWidth={2}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {productDetail.summaryText && (
                <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#EAEAEA] text-xs text-[#555555] whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                  {productDetail.summaryText}
                </div>
              )}

              {productAlts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-[#202020]">
                    Product Hunt Alternatives ({productAlts.length})
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {productAlts.map((alt, i) => {
                      const altName = String(alt.name || 'Alternative');
                      const altSlug = String(alt.slug || altName);
                      return (
                        <button
                          key={`${altSlug}-${i}`}
                          type="button"
                          onClick={() => openProductPerformance(altSlug)}
                          className="p-3 rounded-lg border border-[#EAEAEA] bg-[#FAFAFA] hover:border-[#FF6154] transition-colors text-left cursor-pointer"
                        >
                          <p className="text-xs font-bold text-[#202020] truncate">{altName}</p>
                          {typeof alt.tagline === 'string' && (
                            <p className="text-[11px] text-[#777777] line-clamp-2 mt-0.5">
                              {alt.tagline}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </PhCard>
      )}

      {/* 8. HUNTER ANALYTICS PAGE */}
      {subTab === 'hunter' && (
        <PhCard className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void openHunterAnalytics(hunterQueryInput);
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <input
              type="text"
              value={hunterQueryInput}
              onChange={(e) => setHunterQueryInput(e.target.value)}
              placeholder="Enter a hunter or maker name / @username from captured leaderboards..."
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-[#EAEAEA] text-sm text-[#202020] focus:outline-none focus:border-[#FF6154]"
            />
            <button
              type="submit"
              disabled={hunterLoading}
              className="px-5 py-2.5 rounded-lg bg-[#FF6154] hover:bg-[#E54B3E] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {hunterLoading ? 'Analyzing...' : 'Inspect Maker / Hunter'}
            </button>
          </form>

          {!hunterDetail ? (
            <PhEmptyState
              icon={<Activity className="w-5 h-5" />}
              title="Inspect any Maker or Hunter profile"
              description="Click any maker or hunter name in the Points or Makers & Hunters Leaderboard—or search above—to inspect their observed Product Hunt launches, average points, best daily rank, and top categories."
            />
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#EAEAEA]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-[#202020]">{hunterDetail.name}</h2>
                    {hunterDetail.rolesObserved.map((roleBadge) => (
                      <React.Fragment key={roleBadge}>
                        <span aria-hidden="true" className="text-[#CCCCCC]">·</span>
                        <span
                          className={`text-xs font-semibold ${
                            roleBadge === 'Hunter' ? 'text-[#FF6154]' : 'text-[#555555]'
                          }`}
                        >
                          {roleBadge}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                  <p className="text-xs text-[#777777] mt-0.5">
                    {hunterDetail.username ? `@${hunterDetail.username} · ` : ''}
                    {hunterDetail.headline || 'Observed Product Hunt Maker / Hunter'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      handleBookmark({
                        kind: 'hunter',
                        slugOrKey: hunterDetail.username || hunterDetail.name,
                        title: hunterDetail.name,
                        subtitle: `${hunterDetail.totalObservedLaunches} observed launches`,
                        url: hunterDetail.profileUrl || undefined,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EAEAEA] bg-white hover:bg-[#F7F7F7] text-xs font-semibold text-[#202020] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-[#FF6154]" />
                    Bookmark Profile
                  </button>
                  {hunterDetail.profileUrl && (
                    <a
                      href={hunterDetail.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#202020] hover:bg-[#333333] text-white text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      PH Profile <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#EAEAEA]">
                  <p className="text-[#777777]">Observed Launches</p>
                  <p className="text-lg font-bold font-mono text-[#202020] mt-1 tabular-nums">
                    {hunterDetail.totalObservedLaunches}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#EAEAEA]">
                  <p className="text-[#777777]">Total Visible Points</p>
                  <p className="text-lg font-bold font-mono text-[#FF6154] mt-1 tabular-nums">
                    {hunterDetail.totalVisiblePoints ?? 'Hidden'}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#EAEAEA]">
                  <p className="text-[#777777]">Avg Points / Launch</p>
                  <p className="text-lg font-bold font-mono text-[#202020] mt-1 tabular-nums">
                    {hunterDetail.avgVisiblePoints ?? 'Hidden'}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#EAEAEA]">
                  <p className="text-[#777777]">Best Daily Rank</p>
                  <p className="text-lg font-bold font-mono text-[#16A34A] mt-1 tabular-nums">
                    {hunterDetail.bestRank !== null ? `#${hunterDetail.bestRank}` : '—'}
                  </p>
                </div>
              </div>

              {hunterDetail.launches.length === 0 ? (
                <p className="text-xs text-[#777777]">
                  No captured launches found for “{hunterDetail.query}” in the stored leaderboard snapshots yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-[#202020]">Observed Launches</p>
                  {hunterDetail.launches.map((l) => (
                    <div
                      key={`${l.periodKey}-${l.slug}`}
                      className="p-3.5 rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => openProductPerformance(l.slug)}
                            className="text-sm font-bold text-[#202020] hover:text-[#FF6154] cursor-pointer"
                          >
                            {l.name}
                          </button>
                          <span aria-hidden="true" className="text-[#CCCCCC]">·</span>
                          <span className="text-[11px] font-semibold text-[#FF6154]">
                            {l.role}
                          </span>
                          <span aria-hidden="true" className="text-[#CCCCCC]">·</span>
                          <span className="text-[11px] font-mono text-[#777777] tabular-nums">
                            {l.periodKey}
                          </span>
                        </div>
                        <p className="text-xs text-[#555555] mt-0.5">{l.tagline}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono shrink-0 tabular-nums">
                        <span className="text-[#FF6154] font-bold">
                          {l.points !== null ? `${l.points} pts` : 'Votes Hidden'}
                        </span>
                        <span className="text-[#555555]">
                          {l.rank !== null ? `Rank #${l.rank}` : ''}
                        </span>
                        {l.launchedAt && (
                          <span className="text-[#777777]">{formatTimestamp(l.launchedAt)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </PhCard>
      )}
    </PhPageSection>
  );
}
