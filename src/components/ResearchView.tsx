import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  Columns2,
  ExternalLink,
  FolderTree,
  Layers,
  PlugZap,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { CompetitorEntry, CompetitorResearch, Project } from '../types';
import { authorizedFetch, formatTimestamp } from '../utils/validation';
import { UseProductHuntMcpResult } from '../hooks/useProductHuntMcp';

interface ParsedMcpResponse {
  summaryText: string;
  data: Record<string, unknown> | null;
}

interface ResearchApiResponse {
  summary: string;
  differentiationAngles: string[];
  competitors: CompetitorEntry[];
  dataSource: 'mcp' | 'ai_framework';
  rawMcpData?: unknown;
  mcpError: string | null;
}

interface CompareProfileEntry {
  query: string;
  ok: boolean;
  data?: Record<string, unknown> | null;
  summaryText?: string;
  error?: string;
}

interface ResearchViewProps {
  projects: Project[];
  activeProjectId: string;
  researchReports: CompetitorResearch[];
  onSaveResearch: (input: {
    projectId: string;
    query: string;
    category: string;
    dataSource: 'mcp' | 'ai_framework';
    summary: string;
    differentiationAngles: string[];
    competitors: CompetitorEntry[];
  }) => Promise<string>;
  onDeleteResearch: (id: string) => Promise<void>;
  onSendBriefToAnalyzer?: (brief: {
    id?: string;
    query: string;
    category: string;
    summary: string;
    differentiationAngles: string[];
    competitors: CompetitorEntry[];
  }) => void;
  mcp: UseProductHuntMcpResult;
}

type ResearchTab = 'search' | 'alternatives' | 'leaderboard' | 'compare' | 'categories';

interface ProductListItem {
  name: string;
  slug?: string;
  tagline?: string;
  url?: string;
  pricing?: string;
  rating?: number | null;
  points?: number | null;
  rank?: number | null;
  categories?: string[];
  raw: Record<string, unknown>;
}

function extractProductList(data: Record<string, unknown> | null): ProductListItem[] {
  if (!data) return [];
  const candidateArrays = [
    data.results,
    data.products,
    data.alternatives,
    data.entries,
    data.items,
    data.leaderboard,
  ];
  const arr = candidateArrays.find((a) => Array.isArray(a)) as Array<unknown> | undefined;
  if (!arr) return [];

  return arr
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => {
      const productObj =
        item.product && typeof item.product === 'object'
          ? (item.product as Record<string, unknown>)
          : item;
      const name = String(productObj.name || item.name || 'Unnamed Product');
      const slug =
        typeof productObj.slug === 'string'
          ? productObj.slug
          : typeof item.slug === 'string'
          ? item.slug
          : undefined;
      const tagline =
        typeof productObj.tagline === 'string'
          ? productObj.tagline
          : typeof item.tagline === 'string'
          ? item.tagline
          : undefined;
      const url =
        typeof productObj.url === 'string'
          ? productObj.url
          : typeof item.url === 'string'
          ? item.url
          : undefined;
      const pricing =
        typeof productObj.pricing === 'string'
          ? productObj.pricing
          : typeof item.pricing === 'string'
          ? item.pricing
          : undefined;
      const rating =
        typeof productObj.rating === 'number'
          ? productObj.rating
          : typeof item.rating === 'number'
          ? item.rating
          : null;
      const points =
        typeof item.points === 'number'
          ? item.points
          : typeof item.votes === 'number'
          ? item.votes
          : typeof productObj.top_launch_points === 'number'
          ? productObj.top_launch_points
          : typeof item.top_launch_points === 'number'
          ? item.top_launch_points
          : null;
      const rank = typeof item.rank === 'number' ? item.rank : null;
      const rawCats = Array.isArray(productObj.categories)
        ? productObj.categories
        : Array.isArray(productObj.topics)
        ? productObj.topics
        : [];
      const categories = rawCats
        .map((c) => (typeof c === 'string' ? c : (c as Record<string, unknown>)?.name))
        .filter((c): c is string => typeof c === 'string');

      return {
        name,
        slug,
        tagline,
        url,
        pricing,
        rating,
        points,
        rank,
        categories,
        raw: item,
      };
    });
}

function getProfileField(data: Record<string, unknown> | null | undefined, keys: string[]): unknown {
  if (!data) return undefined;
  const nested =
    data.product && typeof data.product === 'object'
      ? (data.product as Record<string, unknown>)
      : data;
  for (const k of keys) {
    if (nested[k] !== undefined && nested[k] !== null) return nested[k];
    if (data[k] !== undefined && data[k] !== null) return data[k];
  }
  return undefined;
}

export function ResearchView({
  projects,
  activeProjectId,
  researchReports,
  onSaveResearch,
  onDeleteResearch,
  onSendBriefToAnalyzer,
  mcp,
}: ResearchViewProps) {
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0] || null;
  const [subTab, setSubTab] = useState<ResearchTab>('search');

  // Search & AI Synthesis state
  const [query, setQuery] = useState(activeProject?.category ? `${activeProject.category}` : 'AI developer tools');
  const [categorySlug, setCategorySlug] = useState('');
  const [pricingFilter, setPricingFilter] = useState<'any' | 'free' | 'free_options' | 'payment_required'>('any');
  const [openSourceOnly, setOpenSourceOnly] = useState(false);
  const [ycOnly, setYcOnly] = useState(false);
  const [productDescription, setProductDescription] = useState(activeProject?.description || '');
  const [usp, setUsp] = useState(activeProject?.usp || '');

  const [searching, setSearching] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [liveResults, setLiveResults] = useState<ProductListItem[]>([]);
  const [liveSummaryText, setLiveSummaryText] = useState('');
  const [currentReport, setCurrentReport] = useState<CompetitorResearch | ResearchApiResponse | null>(
    researchReports[0] || null
  );

  // Alternatives state
  const [altProduct, setAltProduct] = useState('');
  const [altResults, setAltResults] = useState<ProductListItem[]>([]);
  const [altSummaryText, setAltSummaryText] = useState('');
  const [altLoading, setAltLoading] = useState(false);

  // Leaderboard state
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'today' | 'day' | 'week' | 'month' | 'year'>('today');
  const [leaderboardDateValue, setLeaderboardDateValue] = useState('');
  const [leaderboardResults, setLeaderboardResults] = useState<ProductListItem[]>([]);
  const [leaderboardSummaryText, setLeaderboardSummaryText] = useState('');
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Categories state
  const [categoriesData, setCategoriesData] = useState<{ summaryText: string; items: Array<{ name: string; slug: string }> }>({
    summaryText: '',
    items: [],
  });
  const [categoriesFilter, setCategoriesFilter] = useState('');
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Product Profile Drawer state
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeProfile, setActiveProfile] = useState<{
    name: string;
    data: Record<string, unknown> | null;
    summaryText: string;
  } | null>(null);

  // Compare 2-3 products state
  const [compareInputs, setCompareInputs] = useState<string[]>(['', '', '']);
  const [compareProfiles, setCompareProfiles] = useState<CompareProfileEntry[]>([]);
  const [comparing, setComparing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeProject) {
      setQuery(activeProject.category || activeProject.name || 'SaaS');
      setProductDescription(activeProject.description || '');
      setUsp(activeProject.usp || '');
    }
  }, [activeProject?.id]);

  const handleDirectSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!query.trim() && !categorySlug.trim()) {
      setError('Enter a product keyword or category slug to search Product Hunt.');
      return;
    }

    setSearching(true);
    try {
      const res = await authorizedFetch<ParsedMcpResponse>('/api/mcp/products/search', {
        method: 'POST',
        body: JSON.stringify({
          query: query.trim() || undefined,
          category: categorySlug.trim() || undefined,
          pricing: pricingFilter,
          open_source: openSourceOnly || undefined,
          yc: ycOnly || undefined,
          limit: 12,
        }),
      });
      setLiveResults(extractProductList(res.data));
      setLiveSummaryText(res.summaryText || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Product Hunt search failed.');
    } finally {
      setSearching(false);
    }
  };

  const handleSynthesizeReport = async () => {
    setError(null);
    const searchQuery = query.trim() || categorySlug.trim();
    const catLabel = categorySlug.trim() || activeProject?.category || 'SaaS';
    if (!searchQuery) {
      setError('Enter a search query first to generate a positioning brief.');
      return;
    }
    setSynthesizing(true);
    try {
      const res = await authorizedFetch<ResearchApiResponse>('/api/ai/competitor-research', {
        method: 'POST',
        body: JSON.stringify({
          query: searchQuery,
          category: catLabel,
          productDescription: productDescription.trim(),
          usp: usp.trim(),
          mode: subTab === 'alternatives' ? 'get_alternatives' : 'search_products',
        }),
      });
      setCurrentReport(res);
      await onSaveResearch({
        projectId: activeProject?.id || 'general',
        query: searchQuery,
        category: catLabel,
        dataSource: 'mcp',
        summary: res.summary,
        differentiationAngles: res.differentiationAngles || [],
        competitors: res.competitors || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate positioning brief.');
    } finally {
      setSynthesizing(false);
    }
  };

  const handleLookupAlternatives = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!altProduct.trim()) {
      setError('Enter a product name or Product Hunt slug (e.g., notion, linear, cursor).');
      return;
    }
    setAltLoading(true);
    try {
      const res = await authorizedFetch<ParsedMcpResponse>('/api/mcp/products/alternatives', {
        method: 'POST',
        body: JSON.stringify({ product: altProduct.trim(), limit: 12 }),
      });
      setAltResults(extractProductList(res.data));
      setAltSummaryText(res.summaryText || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alternatives.');
    } finally {
      setAltLoading(false);
    }
  };

  const handleLoadLeaderboard = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    let dateArg = '';
    if (leaderboardPeriod !== 'today') {
      dateArg = leaderboardDateValue.trim();
      if (!dateArg) {
        setError(
          leaderboardPeriod === 'day'
            ? 'Enter date as YYYY-MM-DD.'
            : leaderboardPeriod === 'week'
            ? 'Enter week as YYYY-Www (e.g., 2025-W10).'
            : leaderboardPeriod === 'month'
            ? 'Enter month as YYYY-MM (e.g., 2025-03).'
            : 'Enter year as YYYY (e.g., 2025).'
        );
        return;
      }
    }
    setLeaderboardLoading(true);
    try {
      const res = await authorizedFetch<ParsedMcpResponse>('/api/mcp/leaderboard', {
        method: 'POST',
        body: JSON.stringify({ date: dateArg || undefined, limit: 15 }),
      });
      setLeaderboardResults(extractProductList(res.data));
      setLeaderboardSummaryText(res.summaryText || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Product Hunt leaderboard.');
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const handleLoadCategories = async () => {
    setError(null);
    setCategoriesLoading(true);
    try {
      const res = await authorizedFetch<ParsedMcpResponse>('/api/mcp/categories');
      const items: Array<{ name: string; slug: string }> = [];
      const rawCats = res.data?.categories;
      if (Array.isArray(rawCats)) {
        for (const c of rawCats) {
          if (c && typeof c === 'object') {
            const obj = c as Record<string, unknown>;
            if (typeof obj.name === 'string') {
              items.push({
                name: obj.name,
                slug: typeof obj.slug === 'string' ? obj.slug : obj.name.toLowerCase().replace(/\s+/g, '-'),
              });
            }
          }
        }
      }
      setCategoriesData({ summaryText: res.summaryText || '', items });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Product Hunt categories.');
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'categories' && categoriesData.items.length === 0 && !categoriesData.summaryText) {
      handleLoadCategories();
    }
    if (subTab === 'leaderboard' && leaderboardResults.length === 0 && !leaderboardSummaryText) {
      handleLoadLeaderboard();
    }
  }, [subTab]);

  const handleInspectProfile = async (productNameOrSlug: string) => {
    setError(null);
    setProfileLoading(true);
    try {
      const res = await authorizedFetch<ParsedMcpResponse>('/api/mcp/products/profile', {
        method: 'POST',
        body: JSON.stringify({ productName: productNameOrSlug }),
      });
      setActiveProfile({
        name: productNameOrSlug,
        data: res.data,
        summaryText: res.summaryText || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load product profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAddToCompare = (slugOrName: string) => {
    setCompareInputs((prev) => {
      if (prev.includes(slugOrName)) return prev;
      const next = [...prev];
      const emptyIdx = next.findIndex((v) => !v.trim());
      if (emptyIdx !== -1) {
        next[emptyIdx] = slugOrName;
      } else {
        next[2] = slugOrName;
      }
      return next;
    });
    setSubTab('compare');
  };

  const handleRunCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleaned = compareInputs.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length < 2) {
      setError('Enter or add at least 2 Product Hunt products to compare side-by-side.');
      return;
    }
    setComparing(true);
    try {
      const res = await authorizedFetch<{ profiles: CompareProfileEntry[] }>(
        '/api/mcp/products/compare',
        {
          method: 'POST',
          body: JSON.stringify({ products: cleaned }),
        }
      );
      setCompareProfiles(res.profiles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed.');
    } finally {
      setComparing(false);
    }
  };

  const renderProductCard = (item: ProductListItem, idx: number) => {
    const identifier = item.slug || item.name;
    return (
      <div
        key={`${identifier}-${idx}`}
        className="border border-slate-200 rounded-xl p-4 bg-white hover:border-violet-200 transition-colors flex flex-col justify-between gap-3"
      >
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {typeof item.rank === 'number' && (
                  <span className="px-1.5 py-0.5 rounded bg-orange-50 text-[#C2410C] font-mono text-[11px] font-bold">
                    #{item.rank}
                  </span>
                )}
                <h3 className="text-sm font-bold text-[#0F172A] truncate">{item.name}</h3>
              </div>
              {item.tagline && (
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.tagline}</p>
              )}
            </div>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-[#6D28D9] shrink-0"
                title="View on Product Hunt"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600">
            {item.pricing && (
              <span className="px-2 py-0.5 rounded bg-slate-100 font-medium">
                {item.pricing}
              </span>
            )}
            {typeof item.points === 'number' && (
              <span className="px-2 py-0.5 rounded bg-orange-50 text-[#C2410C] font-mono font-semibold tabular-nums">
                {item.points} pts
              </span>
            )}
            {typeof item.rating === 'number' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-mono">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                {item.rating.toFixed(1)}
              </span>
            )}
            {item.categories?.slice(0, 2).map((c) => (
              <span key={c} className="px-2 py-0.5 rounded bg-violet-50 text-[#6D28D9]">
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => handleInspectProfile(identifier)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0F172A] cursor-pointer"
          >
            View Profile
          </button>
          <button
            type="button"
            onClick={() => handleAddToCompare(identifier)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 text-xs font-semibold text-[#6D28D9] cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            Compare
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
          Competitor Research &amp; Live Product Hunt Explorer
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Search real Product Hunt launches, inspect product profiles and sentiment, browse leaderboards, and compare competitors side-by-side via the official MCP server.
        </p>
      </div>

      {/* Product Hunt MCP Connection Status Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              mcp.mcpStatus?.serverReachable
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {mcp.mcpStatus?.serverReachable ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <PlugZap className="w-5 h-5" />
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-[#0F172A]">
              Official Product Hunt MCP:{' '}
              {mcp.mcpStatus?.serverReachable ? 'Connected (Live Data)' : 'Checking Server...'}
            </p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
              {mcp.mcpStatus?.serverReachable
                ? `Connected to ${mcp.mcpStatus.endpointHost} (${mcp.mcpStatus.tools.length} official tools discovered). ${
                    mcp.mcpStatus.accountConnected
                      ? `Signed in as ${mcp.mcpStatus.account?.name || mcp.mcpStatus.account?.username || 'Product Hunt account'}.`
                      : 'Public search, profiles, alternatives, categories, and leaderboards are active.'
                  }`
                : 'Connecting to https://mcp.producthunt.com/mcp via Streamable HTTP...'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={mcp.testing}
            onClick={() => mcp.testConnection()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0F172A] cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${mcp.testing ? 'animate-spin' : ''}`} />
            {mcp.testing ? 'Checking...' : 'Test MCP'}
          </button>
          {!mcp.mcpStatus?.accountConnected && (
            <button
              type="button"
              disabled={mcp.connecting}
              onClick={() => mcp.connectProductHunt()}
              className="px-3.5 py-2 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
            >
              {mcp.connecting ? 'Connecting...' : 'Connect Account'}
            </button>
          )}
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'search' as const, label: 'Search & Positioning', icon: Search },
          { id: 'alternatives' as const, label: 'Alternatives', icon: Layers },
          { id: 'leaderboard' as const, label: 'Leaderboards', icon: Award },
          {
            id: 'compare' as const,
            label: `Compare (${compareInputs.filter((s) => s.trim()).length})`,
            icon: Columns2,
          },
          { id: 'categories' as const, label: 'Categories', icon: FolderTree },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-[#0F172A] text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Product Profile Modal/Drawer Banner */}
      {(profileLoading || activeProfile) && (
        <div className="bg-white border-2 border-[#6D28D9] rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
            <div>
              <p className="text-xs font-semibold text-[#6D28D9]">
                Official Product Hunt Profile (MCP)
              </p>
              <h2 className="text-lg font-bold text-[#0F172A]">
                {profileLoading
                  ? 'Loading product profile...'
                  : String(getProfileField(activeProfile?.data, ['name']) || activeProfile?.name)}
              </h2>
              {!profileLoading && Boolean(getProfileField(activeProfile?.data, ['tagline'])) && (
                <p className="text-sm text-slate-600 mt-1">
                  {String(getProfileField(activeProfile?.data, ['tagline']))}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setActiveProfile(null)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!profileLoading && activeProfile && (
            <div className="space-y-4 text-xs sm:text-sm text-slate-700">
              {Boolean(getProfileField(activeProfile.data, ['description'])) && (
                <p className="leading-relaxed">
                  {String(getProfileField(activeProfile.data, ['description']))}
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-slate-500">Pricing</p>
                  <p className="font-semibold text-[#0F172A] mt-0.5">
                    {String(getProfileField(activeProfile.data, ['pricing']) || 'Unspecified')}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-slate-500">Rating</p>
                  <p className="font-semibold text-[#0F172A] mt-0.5 tabular-nums">
                    {String(getProfileField(activeProfile.data, ['rating']) ?? 'N/A')}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-slate-500">Reviews</p>
                  <p className="font-semibold text-[#0F172A] mt-0.5 tabular-nums">
                    {String(
                      getProfileField(activeProfile.data, ['reviews_count', 'review_count']) ?? 'N/A'
                    )}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-slate-500">Top Launch Points</p>
                  <p className="font-semibold text-[#0F172A] mt-0.5 tabular-nums">
                    {String(
                      getProfileField(activeProfile.data, ['top_launch_points', 'points']) ?? 'N/A'
                    )}
                  </p>
                </div>
              </div>

              {activeProfile.summaryText && (
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                  {activeProfile.summaryText}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleAddToCompare(activeProfile.name)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add to Side-by-Side Compare
                </button>
                {Boolean(getProfileField(activeProfile.data, ['url'])) && (
                  <a
                    href={String(getProfileField(activeProfile.data, ['url']))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#6D28D9] hover:underline"
                  >
                    Open on Product Hunt <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: SEARCH & POSITIONING */}
      {subTab === 'search' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={handleDirectSearch}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-base font-bold text-[#0F172A]">Search Official Product Hunt</h2>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Search Keyword / Product Space
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g., AI changelog, note taking, cursor"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Category Slug (optional)
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={categorySlug}
                    onChange={(e) => setCategorySlug(e.target.value)}
                    placeholder="e.g., developer-tools"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pricing Filter
                  </label>
                  <select
                    value={pricingFilter}
                    onChange={(e) =>
                      setPricingFilter(
                        e.target.value as 'any' | 'free' | 'free_options' | 'payment_required'
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    <option value="any">Any Pricing</option>
                    <option value="free">Free</option>
                    <option value="free_options">Free Options</option>
                    <option value="payment_required">Paid</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-slate-700">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={openSourceOnly}
                    onChange={(e) => setOpenSourceOnly(e.target.checked)}
                  />
                  Open Source only
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ycOnly}
                    onChange={(e) => setYcOnly(e.target.checked)}
                  />
                  YC-backed only
                </label>
              </div>

              <button
                type="submit"
                disabled={searching}
                className="w-full py-2.5 px-4 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                <Search className={`w-4 h-4 ${searching ? 'animate-spin' : ''}`} />
                {searching ? 'Searching Product Hunt...' : 'Search Live Products'}
              </button>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <p className="text-xs font-semibold text-[#6D28D9]">
                  AI Positioning Synthesis (Grounded in Live MCP Results)
                </p>
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Your product description for differentiation angles..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
                <input
                  type="text"
                  maxLength={800}
                  value={usp}
                  onChange={(e) => setUsp(e.target.value)}
                  placeholder="Your key differentiator (USP)..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
                <button
                  type="button"
                  disabled={synthesizing}
                  onClick={handleSynthesizeReport}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
                >
                  {synthesizing
                    ? 'Synthesizing Positioning Brief...'
                    : 'Generate & Save Grounded Positioning Brief'}
                </button>
              </div>
            </form>

            {researchReports.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-semibold text-slate-500 mb-3">
                  Saved Positioning Briefs ({researchReports.length})
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {researchReports.map((rep) => (
                    <div
                      key={rep.id}
                      className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => setCurrentReport(rep)}
                        className="text-left min-w-0 flex-1 cursor-pointer"
                      >
                        <p className="text-xs font-semibold text-[#0F172A] truncate">{rep.query}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {rep.category} · {rep.dataSource === 'mcp' ? 'Live MCP' : 'Framework'} ·{' '}
                          {formatTimestamp(rep.createdAt)}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteResearch(rep.id)}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-7 space-y-5">
            {(liveResults.length > 0 || liveSummaryText) && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#0F172A]">
                    Live Product Hunt Results ({liveResults.length})
                  </h3>
                  <span className="text-[11px] font-medium text-emerald-700">
                    Official Product Hunt MCP
                  </span>
                </div>
                {liveResults.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {liveResults.map(renderProductCard)}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 whitespace-pre-wrap">{liveSummaryText}</p>
                )}
              </div>
            )}

            {currentReport && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <div className="pb-3 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[#6D28D9]">
                      {currentReport.dataSource === 'mcp'
                        ? 'Source: Official Product Hunt MCP + AI Positioning Analysis'
                        : 'Source: Positioning Brief'}
                    </p>
                    <h2 className="text-lg font-bold text-[#0F172A] mt-0.5">
                      Competitive Positioning Brief
                    </h2>
                  </div>
                  {onSendBriefToAnalyzer && (
                    <button
                      type="button"
                      onClick={() =>
                        onSendBriefToAnalyzer({
                          id: 'id' in currentReport ? currentReport.id : undefined,
                          query: 'query' in currentReport ? currentReport.query : query,
                          category:
                            'category' in currentReport
                              ? currentReport.category
                              : categorySlug || activeProject?.category || 'SaaS',
                          summary: currentReport.summary,
                          differentiationAngles: currentReport.differentiationAngles || [],
                          competitors: currentReport.competitors || [],
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Send to Launch Analyzer
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-1.5">Strategic Summary</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{currentReport.summary}</p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-2">
                    Differentiation Angles
                  </h3>
                  <ul className="space-y-2 text-sm text-[#0F172A]">
                    {currentReport.differentiationAngles.map((angle, idx) => (
                      <li key={idx} className="p-3 rounded-lg bg-violet-50/60 border border-violet-100">
                        {angle}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-2">
                    Real Retrieved Competitors ({currentReport.competitors.length})
                  </h3>
                  {currentReport.competitors.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No matching Product Hunt products were returned for that query.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {currentReport.competitors.map((comp, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-[#0F172A]">{comp.name}</h4>
                            <span className="text-[11px] font-medium text-slate-500">
                              {comp.sourceNote}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            <span className="font-semibold text-[#0F172A]">Positioning:</span>{' '}
                            {comp.positioning}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                            <div className="p-2.5 rounded-lg bg-slate-50">
                              <p className="font-semibold text-slate-700 mb-0.5">Strength</p>
                              <p className="text-slate-600">{comp.strength}</p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-orange-50/60">
                              <p className="font-semibold text-[#C2410C] mb-0.5">Gap to Exploit</p>
                              <p className="text-slate-700">{comp.gapToExploit}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ALTERNATIVES LOOKUP */}
      {subTab === 'alternatives' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <form onSubmit={handleLookupAlternatives} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              maxLength={200}
              value={altProduct}
              onChange={(e) => setAltProduct(e.target.value)}
              placeholder="Enter a Product Hunt product name or slug (e.g., cursor, linear, notion)..."
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
            />
            <button
              type="submit"
              disabled={altLoading}
              className="px-5 py-2.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
            >
              {altLoading ? 'Finding Alternatives...' : 'Find Real Alternatives'}
            </button>
          </form>

          {altResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {altResults.map(renderProductCard)}
            </div>
          ) : altSummaryText ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap">
              {altSummaryText}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Search any known product to see real Product Hunt alternatives, ratings, and positioning.
            </p>
          )}
        </div>
      )}

      {/* TAB 3: LEADERBOARDS */}
      {subTab === 'leaderboard' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <form onSubmit={handleLoadLeaderboard} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Period</label>
              <select
                value={leaderboardPeriod}
                onChange={(e) => {
                  const val = e.target.value as 'today' | 'day' | 'week' | 'month' | 'year';
                  setLeaderboardPeriod(val);
                  if (val === 'today') setLeaderboardDateValue('');
                }}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="today">Today (Live)</option>
                <option value="day">Specific Day (YYYY-MM-DD)</option>
                <option value="week">Weekly (YYYY-Www)</option>
                <option value="month">Monthly (YYYY-MM)</option>
                <option value="year">Yearly (YYYY)</option>
              </select>
            </div>

            {leaderboardPeriod !== 'today' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Date Value
                </label>
                <input
                  type="text"
                  value={leaderboardDateValue}
                  onChange={(e) => setLeaderboardDateValue(e.target.value)}
                  placeholder={
                    leaderboardPeriod === 'day'
                      ? '2025-03-10'
                      : leaderboardPeriod === 'week'
                      ? '2025-W10'
                      : leaderboardPeriod === 'month'
                      ? '2025-03'
                      : '2025'
                  }
                  className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={leaderboardLoading}
              className="px-4 py-2 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
            >
              {leaderboardLoading ? 'Loading...' : 'Load Leaderboard'}
            </button>
          </form>

          {leaderboardResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leaderboardResults.map(renderProductCard)}
            </div>
          ) : leaderboardSummaryText ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap">
              {leaderboardSummaryText}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Loading leaderboard...</p>
          )}
        </div>
      )}

      {/* TAB 4: SIDE-BY-SIDE COMPARE (2-3 PRODUCTS) */}
      {subTab === 'compare' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">
              Compare 2–3 Product Hunt Products Side-by-Side
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Enter Product Hunt slugs or names (e.g., cursor, windsurf, replit) or click “Compare” on any search result.
            </p>
          </div>

          <form onSubmit={handleRunCompare} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[0, 1, 2].map((idx) => (
              <input
                key={idx}
                type="text"
                maxLength={120}
                value={compareInputs[idx]}
                onChange={(e) => {
                  const val = e.target.value;
                  setCompareInputs((prev) => prev.map((item, i) => (i === idx ? val : item)));
                }}
                placeholder={`Product ${idx + 1}${idx === 2 ? ' (optional)' : ''}`}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            ))}
            <button
              type="submit"
              disabled={comparing}
              className="px-4 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
            >
              {comparing ? 'Comparing...' : 'Compare Products'}
            </button>
          </form>

          {compareProfiles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {compareProfiles.map((entry, idx) => (
                <div
                  key={`${entry.query}-${idx}`}
                  className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3"
                >
                  {entry.ok ? (
                    <>
                      <div>
                        <h3 className="text-sm font-bold text-[#0F172A]">
                          {String(getProfileField(entry.data, ['name']) || entry.query)}
                        </h3>
                        {Boolean(getProfileField(entry.data, ['tagline'])) && (
                          <p className="text-xs text-slate-600 mt-1">
                            {String(getProfileField(entry.data, ['tagline']))}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5 text-xs border-t border-slate-200 pt-2">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Pricing</span>
                          <span className="font-semibold">
                            {String(getProfileField(entry.data, ['pricing']) || 'Unspecified')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Rating</span>
                          <span className="font-mono font-semibold">
                            {String(getProfileField(entry.data, ['rating']) ?? 'N/A')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Reviews</span>
                          <span className="font-mono font-semibold">
                            {String(
                              getProfileField(entry.data, ['reviews_count', 'review_count']) ?? 'N/A'
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Top Launch Points</span>
                          <span className="font-mono font-semibold">
                            {String(
                              getProfileField(entry.data, ['top_launch_points', 'points']) ?? 'N/A'
                            )}
                          </span>
                        </div>
                      </div>
                      {entry.summaryText && (
                        <p className="text-[11px] text-slate-600 whitespace-pre-wrap line-clamp-6 border-t border-slate-200 pt-2">
                          {entry.summaryText}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-red-700">
                      <p className="font-semibold">{entry.query}</p>
                      <p className="mt-1">{entry.error || 'Profile unavailable.'}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CATEGORIES EXPLORER */}
      {subTab === 'categories' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">
                Official Product Hunt Categories
              </h2>
              <p className="text-xs text-slate-600">
                Click any category to filter Product Hunt search results.
              </p>
            </div>
            <input
              type="text"
              value={categoriesFilter}
              onChange={(e) => setCategoriesFilter(e.target.value)}
              placeholder="Filter categories..."
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
            />
          </div>

          {categoriesLoading ? (
            <p className="text-xs text-slate-500">Loading categories from Product Hunt MCP...</p>
          ) : categoriesData.items.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {categoriesData.items
                .filter((c) =>
                  c.name.toLowerCase().includes(categoriesFilter.trim().toLowerCase())
                )
                .map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => {
                      setCategorySlug(c.slug);
                      setQuery('');
                      setSubTab('search');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-violet-50 hover:border-violet-200 text-xs font-medium text-[#0F172A] cursor-pointer"
                  >
                    {c.name} <span className="text-slate-400 font-mono">({c.slug})</span>
                  </button>
                ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
              {categoriesData.summaryText || 'No categories retrieved.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
