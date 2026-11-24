import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  ExternalLink,
  Gauge,
  Info,
  Lightbulb,
  ListChecks,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AnalysisReport,
  CategoryScores,
  CompetitorResearch,
  LaunchDraft,
  Project,
} from '../types';
import { authorizedFetch, formatTimestamp, isValidHttpUrl } from '../utils/validation';
import { UseProductHuntMcpResult } from '../hooks/useProductHuntMcp';

export interface PendingResearchImport {
  id?: string;
  query: string;
  category: string;
  summary: string;
  differentiationAngles: string[];
  competitors: Array<{ name: string; gapToExploit: string }>;
}

interface McpResearchData {
  relatedProducts: Array<{
    name: string;
    tagline: string;
    pricing?: string | null;
    rating?: number | null;
    topLaunchPoints?: number | null;
    url?: string;
  }>;
  matchedCategories: string[];
  mcpLaunchAssessment?: unknown;
}

interface LaunchAnalyzerViewProps {
  projects: Project[];
  drafts: LaunchDraft[];
  reports: AnalysisReport[];
  activeProjectId: string;
  selectedReportId?: string | null;
  onSaveReport: (input: {
    projectId: string;
    draftTitle: string;
    overallScore: number;
    categoryScores: CategoryScores;
    strengths: string[];
    weaknesses: string[];
    missingInfo: string[];
    suggestions: string[];
    nextSteps: string[];
    summary: string;
    disclaimer: string;
  }) => Promise<string>;
  onDeleteReport: (reportId: string) => Promise<void>;
  onCreateProjectQuick: (input: {
    name: string;
    category: string;
    websiteUrl?: string;
    targetAudience?: string;
    usp?: string;
    description?: string;
  }) => Promise<Project>;
  researchReports?: CompetitorResearch[];
  pendingResearchImport?: PendingResearchImport | null;
  onClearPendingResearchImport?: () => void;
  mcp: UseProductHuntMcpResult;
}

interface AnalyzerApiResponse {
  overallScore: number;
  categoryScores: CategoryScores;
  strengths: string[];
  weaknesses: string[];
  missingInfo: string[];
  suggestions: string[];
  nextSteps: string[];
  summary: string;
  disclaimer: string;
  mcpResearchData?: McpResearchData;
  mcpErrorNote?: string | null;
}

interface McpLaunchSummary {
  id: string;
  name: string;
  status?: string;
  tagline?: string;
}

const DEFAULT_DISCLAIMER =
  'Estimated Launch Readiness Score only. This score does NOT represent the probability of getting featured on Product Hunt. Featuring depends on Product Hunt’s internal systems, editorial decisions, daily competition, and community response.';

const CATEGORY_SUGGESTIONS = [
  'SaaS',
  'Artificial Intelligence',
  'Developer Tools',
  'Productivity',
  'Design Tools',
  'Marketing',
  'No-Code',
  'Fintech',
  'Analytics',
  'Mobile App',
  'Open Source',
];

export function LaunchAnalyzerView({
  projects,
  drafts,
  reports,
  activeProjectId,
  selectedReportId,
  onSaveReport,
  onDeleteReport,
  onCreateProjectQuick,
  researchReports = [],
  pendingResearchImport,
  onClearPendingResearchImport,
  mcp,
}: LaunchAnalyzerViewProps) {
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0] || null;

  const [selectedProjId, setSelectedProjId] = useState(activeProject?.id || '');
  const [productName, setProductName] = useState(activeProject?.name || '');
  const [tagline, setTagline] = useState(activeProject?.tagline || '');
  const [websiteUrl, setWebsiteUrl] = useState(activeProject?.websiteUrl || '');
  const [category, setCategory] = useState(activeProject?.category || 'SaaS');
  const [topicsText, setTopicsText] = useState(activeProject?.category || 'SaaS');
  const [targetAudience, setTargetAudience] = useState(activeProject?.targetAudience || '');
  const [usp, setUsp] = useState(activeProject?.usp || '');
  const [description, setDescription] = useState(activeProject?.description || '');
  const [makerComment, setMakerComment] = useState('');
  const [visualAssetsNotes, setVisualAssetsNotes] = useState('');
  const [competitorNotes, setCompetitorNotes] = useState('');
  const [launchChecklistNotes, setLaunchChecklistNotes] = useState('');

  // Official Product Hunt MCP Draft Import state
  const [phLaunches, setPhLaunches] = useState<McpLaunchSummary[]>([]);
  const [loadingPhLaunches, setLoadingPhLaunches] = useState(false);
  const [importedMcpLaunchId, setImportedMcpLaunchId] = useState<string>('');
  const [latestMcpResearchData, setLatestMcpResearchData] = useState<McpResearchData | null>(null);
  const [latestMcpErrorNote, setLatestMcpErrorNote] = useState<string | null>(null);
  const [importedResearchLabel, setImportedResearchLabel] = useState<string>('');

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<AnalysisReport | AnalyzerApiResponse | null>(
    () =>
      (selectedReportId ? reports.find((r) => r.id === selectedReportId) : null) ||
      reports[0] ||
      null
  );

  useEffect(() => {
    if (activeProject) {
      setSelectedProjId(activeProject.id);
      setProductName(activeProject.name || '');
      setTagline(activeProject.tagline || '');
      setWebsiteUrl(activeProject.websiteUrl || '');
      setCategory(activeProject.category || 'SaaS');
      setTopicsText(activeProject.category || 'SaaS');
      setTargetAudience(activeProject.targetAudience || '');
      setUsp(activeProject.usp || '');
      setDescription(activeProject.description || '');
    }
  }, [activeProject?.id]);

  useEffect(() => {
    if (selectedReportId) {
      const match = reports.find((r) => r.id === selectedReportId);
      if (match) {
        setCurrentResult(match);
        setLatestMcpResearchData(null);
        return;
      }
    }
    if (!currentResult && reports.length > 0) {
      setCurrentResult(reports[0]);
    }
  }, [selectedReportId, reports, currentResult]);

  useEffect(() => {
    if (!mcp.mcpStatus?.accountConnected) {
      setPhLaunches([]);
      return;
    }
    let cancelled = false;
    setLoadingPhLaunches(true);
    authorizedFetch<{ data?: Record<string, unknown> | null }>('/api/mcp/launches')
      .then((res) => {
        if (cancelled) return;
        const arr = Array.isArray(res.data?.launches)
          ? res.data!.launches
          : Array.isArray(res.data?.results)
          ? res.data!.results
          : [];
        const mapped: McpLaunchSummary[] = arr
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
          .map((item) => ({
            id: String(item.id || item.launch_id || item.uuid || ''),
            name: String(item.name || item.product_name || 'Product Hunt Launch'),
            status: typeof item.status === 'string' ? item.status : undefined,
            tagline: typeof item.tagline === 'string' ? item.tagline : undefined,
          }))
          .filter((l) => Boolean(l.id));
        setPhLaunches(mapped);
      })
      .catch(() => {
        // optional
      })
      .finally(() => {
        if (!cancelled) setLoadingPhLaunches(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mcp.mcpStatus?.accountConnected]);

  const applyResearchBrief = (brief: PendingResearchImport) => {
    const gaps = brief.competitors
      .slice(0, 4)
      .map((c) => `${c.name}: ${c.gapToExploit}`)
      .join('; ');
    const angles = brief.differentiationAngles.slice(0, 3).join(' | ');
    const combined = [
      `Competitor brief (${brief.query}): ${brief.summary}`,
      angles ? `Differentiation angles: ${angles}` : '',
      gaps ? `Competitor gaps: ${gaps}` : '',
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 1480);

    setCompetitorNotes(combined);
    if (brief.category && (!category.trim() || category === 'SaaS')) {
      setCategory(brief.category);
    }
    setImportedResearchLabel(brief.query);
  };

  useEffect(() => {
    if (pendingResearchImport) {
      applyResearchBrief(pendingResearchImport);
      onClearPendingResearchImport?.();
    }
  }, [pendingResearchImport]);

  const importDraft = (draftId: string) => {
    const d = drafts.find((item) => item.id === draftId);
    if (!d) return;
    setImportedMcpLaunchId('');
    setSelectedProjId(d.projectId);
    setProductName(d.productName);
    setTagline(d.selectedTagline);
    setDescription(d.description);
    setMakerComment(d.makerComment);
    setCategory(d.topics[0] || activeProject?.category || 'SaaS');
    setTopicsText(d.topics.join(', '));
    setVisualAssetsNotes(
      `Gallery slides planned (${d.galleryIdeas.length}): ${d.galleryIdeas.join('; ')}. ${
        d.demoVideoScript ? '60s demo video script prepared.' : ''
      }`
    );
  };

  const handleImportPhLaunch = async (launchId: string) => {
    if (!launchId) return;
    setError(null);
    try {
      const res = await authorizedFetch<{ data?: Record<string, unknown> | null }>(
        `/api/mcp/launches/${encodeURIComponent(launchId)}`
      );
      const launchObj =
        res.data?.launch && typeof res.data.launch === 'object'
          ? (res.data.launch as Record<string, unknown>)
          : res.data || {};
      const editable =
        launchObj.editable && typeof launchObj.editable === 'object'
          ? (launchObj.editable as Record<string, unknown>)
          : launchObj;

      setImportedMcpLaunchId(launchId);
      if (typeof editable.name === 'string') setProductName(editable.name);
      if (typeof editable.tagline === 'string') setTagline(editable.tagline);
      if (typeof editable.description === 'string') setDescription(editable.description);
      if (typeof editable.url === 'string') setWebsiteUrl(editable.url);
      if (typeof editable.commentBody === 'string') setMakerComment(editable.commentBody);
      if (Array.isArray(editable.topics)) {
        const t = editable.topics.filter((x): x is string => typeof x === 'string');
        if (t.length > 0) {
          setTopicsText(t.join(', '));
          setCategory(t[0]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import Product Hunt draft.');
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!productName.trim() || !tagline.trim() || !description.trim() || !category.trim()) {
      setError('Product name, category, tagline, and description are required to run an analysis.');
      return;
    }
    if (websiteUrl.trim() && !isValidHttpUrl(websiteUrl)) {
      setError('Website URL must start with https:// or http://.');
      return;
    }

    setAnalyzing(true);
    try {
      const topics = topicsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await authorizedFetch<AnalyzerApiResponse>('/api/ai/analyze-launch', {
        method: 'POST',
        body: JSON.stringify({
          productName: productName.trim(),
          tagline: tagline.trim(),
          category: category.trim(),
          websiteUrl: websiteUrl.trim(),
          topics,
          targetAudience: targetAudience.trim(),
          usp: usp.trim(),
          description: description.trim(),
          makerComment: makerComment.trim(),
          visualAssetsNotes: visualAssetsNotes.trim(),
          competitorNotes: competitorNotes.trim(),
          launchChecklistNotes: launchChecklistNotes.trim(),
          mcpLaunchId: importedMcpLaunchId || undefined,
        }),
      });

      setCurrentResult(res);
      setLatestMcpResearchData(res.mcpResearchData || null);
      setLatestMcpErrorNote(res.mcpErrorNote || null);

      let targetProjId = selectedProjId;
      if (!targetProjId) {
        const created = await onCreateProjectQuick({
          name: productName.trim(),
          category: category.trim() || topics[0] || 'SaaS',
          websiteUrl: websiteUrl.trim(),
          targetAudience: targetAudience.trim(),
          usp: usp.trim(),
          description: description.trim(),
        });
        targetProjId = created.id;
        setSelectedProjId(targetProjId);
      }

      await onSaveReport({
        projectId: targetProjId,
        draftTitle: productName.trim(),
        overallScore: res.overallScore,
        categoryScores: res.categoryScores,
        strengths: res.strengths || [],
        weaknesses: res.weaknesses || [],
        missingInfo: res.missingInfo || [],
        suggestions: res.suggestions || [],
        nextSteps: res.nextSteps || [],
        summary: res.summary || '',
        disclaimer: res.disclaimer || DEFAULT_DISCLAIMER,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      await onDeleteReport(reportId);
      if (currentResult && 'id' in currentResult && currentResult.id === reportId) {
        const remaining = reports.filter((r) => r.id !== reportId);
        setCurrentResult(remaining[0] || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete analysis report.');
    }
  };

  const categoryChartData = currentResult
    ? [
        { name: 'Tagline Clarity', score: currentResult.categoryScores.taglineClarity },
        { name: 'Description Quality', score: currentResult.categoryScores.descriptionQuality },
        { name: 'Positioning', score: currentResult.categoryScores.positioning },
        { name: 'USP Strength', score: currentResult.categoryScores.uspStrength },
        { name: 'Audience Clarity', score: currentResult.categoryScores.audienceClarity },
        { name: 'Visual Assets', score: currentResult.categoryScores.visualAssets },
        { name: 'Competitor Diff.', score: currentResult.categoryScores.competitorDiff },
        { name: 'Launch Prep', score: currentResult.categoryScores.launchPrep },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">AI Launch Analyzer</h1>
        <p className="text-sm text-slate-600 mt-1">
          Submit your full launch draft or import an eligible Product Hunt draft via MCP to receive an Estimated Launch Readiness Score grounded in real Product Hunt category and competitor data.
        </p>
      </div>

      {/* Mandatory Disclaimer Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm text-amber-950 leading-relaxed">
          <span className="font-semibold">About the Estimated Launch Readiness Score:</span>{' '}
          This score evaluates copy clarity, positioning, and preparation completeness. It is{' '}
          <span className="font-semibold">not</span> the actual probability of getting featured on Product Hunt—featuring depends on Product Hunt’s internal systems, editorial decisions, daily competition, and community response.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Submission Form */}
        <form
          onSubmit={handleAnalyze}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#0F172A]">Launch Draft Submission</h2>
            <div className="flex flex-wrap items-center gap-2">
              {drafts.length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) importDraft(e.target.value);
                  }}
                  className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 text-[#0F172A] max-w-[160px]"
                >
                  <option value="" disabled>
                    Import saved draft...
                  </option>
                  {drafts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.productName} ({d.versionName})
                    </option>
                  ))}
                </select>
              )}

              {mcp.mcpStatus?.accountConnected && phLaunches.length > 0 && (
                <select
                  value={importedMcpLaunchId}
                  onChange={(e) => handleImportPhLaunch(e.target.value)}
                  disabled={loadingPhLaunches}
                  className="text-xs border border-orange-300 rounded-lg px-2.5 py-1.5 bg-orange-50 text-[#C2410C] max-w-[175px]"
                >
                  <option value="">Import PH draft (MCP)...</option>
                  {phLaunches.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.status || 'draft'})
                    </option>
                  ))}
                </select>
              )}

              {researchReports.length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const brief = researchReports.find((r) => r.id === e.target.value);
                    if (brief) applyResearchBrief(brief);
                  }}
                  className="text-xs border border-violet-300 rounded-lg px-2.5 py-1.5 bg-violet-50 text-[#6D28D9] max-w-[175px]"
                >
                  <option value="" disabled>
                    Import competitor brief...
                  </option>
                  {researchReports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.query} ({r.category})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {importedResearchLabel && (
            <div className="p-2.5 rounded-lg bg-violet-50 border border-violet-200 text-xs text-[#6D28D9] flex items-center justify-between gap-2">
              <span>Competitor brief linked: {importedResearchLabel}</span>
              <button
                type="button"
                onClick={() => setImportedResearchLabel('')}
                className="underline font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {importedMcpLaunchId && (
            <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-200 text-xs text-[#C2410C] flex items-center justify-between gap-2">
              <span>Imported from Product Hunt MCP ({importedMcpLaunchId})</span>
              <button
                type="button"
                onClick={() => setImportedMcpLaunchId('')}
                className="underline font-semibold cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Product Category *
              </label>
              <input
                type="text"
                required
                list="analyzer-category-options"
                maxLength={80}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., SaaS, Artificial Intelligence"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
              <datalist id="analyzer-category-options">
                {CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Website URL
            </label>
            <input
              type="url"
              maxLength={300}
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Tagline * <span className="text-slate-400 tabular-nums">({tagline.length}/60 rec.)</span>
            </label>
            <input
              type="text"
              required
              maxLength={150}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Clear 1-line summary of what your product does"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Product Description *
            </label>
            <textarea
              required
              rows={3}
              maxLength={3000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste your Product Hunt description..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              First Maker Comment
            </label>
            <textarea
              rows={3}
              maxLength={4000}
              value={makerComment}
              onChange={(e) => setMakerComment(e.target.value)}
              placeholder="Paste your draft first maker comment..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Target Audience
              </label>
              <input
                type="text"
                maxLength={500}
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Topics (comma-separated)
              </label>
              <input
                type="text"
                maxLength={200}
                value={topicsText}
                onChange={(e) => setTopicsText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Unique Selling Proposition
            </label>
            <input
              type="text"
              maxLength={800}
              value={usp}
              onChange={(e) => setUsp(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Visual Assets (Thumbnail, Gallery &amp; Video Plan)
            </label>
            <textarea
              rows={2}
              maxLength={1500}
              value={visualAssetsNotes}
              onChange={(e) => setVisualAssetsNotes(e.target.value)}
              placeholder="e.g., 240x240 logo, 5 slides showing dashboard & workflow, 60s Loom video"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Competitor Differentiation &amp; Prep Notes
            </label>
            <textarea
              rows={2}
              maxLength={1500}
              value={competitorNotes}
              onChange={(e) => setCompetitorNotes(e.target.value)}
              placeholder="How do you stand out vs alternatives? Is your teaser page & community ready?"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={analyzing}
            className="w-full py-2.5 px-4 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
          >
            <Gauge className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? 'Evaluating Launch Draft...' : 'Run Launch Readiness Analysis'}
          </button>

          {reports.length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-500 mb-2">
                Past Analysis Reports ({reports.length})
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {reports.map((rep) => {
                  const isActive =
                    currentResult !== null && 'id' in currentResult && currentResult.id === rep.id;
                  return (
                    <div
                      key={rep.id}
                      className={`px-3 py-2 rounded-lg border flex items-center justify-between gap-2 text-xs transition-colors ${
                        isActive
                          ? 'border-[#6D28D9] bg-violet-50'
                          : 'border-slate-200 bg-slate-50 hover:bg-violet-50/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentResult(rep);
                          setLatestMcpResearchData(null);
                        }}
                        className="flex-1 text-left flex items-center justify-between gap-2 min-w-0 cursor-pointer"
                      >
                        <span className="font-medium text-[#0F172A] truncate">
                          {rep.draftTitle} · {formatTimestamp(rep.createdAt)}
                        </span>
                        <span className="font-mono font-bold text-[#6D28D9] tabular-nums shrink-0">
                          {rep.overallScore}/100
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteReport(rep.id)}
                        title="Delete analysis report"
                        className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </form>

        {/* Right: Report Output */}
        <div className="lg:col-span-7 space-y-5">
          {!currentResult ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <Sparkles className="w-9 h-9 text-[#EA580C] mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#0F172A] mb-1">
                Submit a draft to see your readiness diagnostic
              </h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                You will receive an Estimated Launch Readiness Score (0–100), 8 category scores, real Product Hunt category/competitor context via MCP, and concrete copy recommendations.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Score Header & Category Chart */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <p className="text-xs font-semibold text-[#6D28D9]">
                      Estimated Launch Readiness Score (AI Evaluation — Not Featuring Probability)
                    </p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-5xl font-bold text-[#0F172A] font-mono tabular-nums">
                        {currentResult.overallScore}
                      </span>
                      <span className="text-base text-slate-400 font-mono tabular-nums">/ 100</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 max-w-md leading-relaxed">
                    {currentResult.summary}
                  </p>
                </div>

                <div className="pt-5">
                  <p className="text-xs font-semibold text-slate-500 mb-3">
                    Category Breakdown (0–100)
                  </p>
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={categoryChartData}
                        layout="vertical"
                        margin={{ top: 0, right: 20, left: 20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={125}
                          tick={{ fontSize: 11, fill: '#0F172A' }}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #E2E8F0',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="score" name="Category Score" fill="#6D28D9" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Real Retrieved Data from Product Hunt MCP (Strictly Separated from AI Estimates) */}
              {(latestMcpResearchData || latestMcpErrorNote) && (
                <div className="bg-white border border-emerald-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                      <Database className="w-4 h-4" />
                      <span>Real Data Retrieved from Product Hunt MCP</span>
                    </div>
                    <span className="text-[11px] text-emerald-700 font-medium">
                      Live Official Server
                    </span>
                  </div>

                  {latestMcpErrorNote && (
                    <p className="text-xs text-amber-700">{latestMcpErrorNote}</p>
                  )}

                  {latestMcpResearchData && latestMcpResearchData.matchedCategories.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1.5">
                        Matching Official Product Hunt Categories
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {latestMcpResearchData.matchedCategories.map((cat) => (
                          <span
                            key={cat}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-medium text-[#0F172A]"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {latestMcpResearchData && latestMcpResearchData.relatedProducts.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2">
                        Similar / Nearby Products on Product Hunt
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {latestMcpResearchData.relatedProducts.map((prod, idx) => (
                          <div
                            key={`${prod.name}-${idx}`}
                            className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-[#0F172A] truncate">
                                {prod.name}
                              </span>
                              {prod.url && (
                                <a
                                  href={prod.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#6D28D9] shrink-0"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                            <p className="text-slate-600 line-clamp-2">{prod.tagline}</p>
                            <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 pt-0.5">
                              {prod.pricing && <span>Pricing: {prod.pricing}</span>}
                              {prod.topLaunchPoints !== null &&
                                prod.topLaunchPoints !== undefined && (
                                  <span className="font-mono text-[#C2410C]">
                                    {prod.topLaunchPoints} pts
                                  </span>
                                )}
                              {prod.rating !== null && prod.rating !== undefined && (
                                <span className="font-mono">★ {prod.rating.toFixed(1)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm mb-3">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Strengths</span>
                  </div>
                  <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                    {currentResult.strengths.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">• {item}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 text-[#EA580C] font-semibold text-sm mb-3">
                    <AlertCircle className="w-4 h-4" />
                    <span>Weaknesses</span>
                  </div>
                  <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                    {currentResult.weaknesses.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Missing Info & Suggestions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 text-[#0F172A] font-semibold text-sm mb-3">
                    <Info className="w-4 h-4 text-amber-600" />
                    <span>Missing Information</span>
                  </div>
                  <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                    {currentResult.missingInfo.length === 0 ? (
                      <li className="text-slate-500">No critical fields missing.</li>
                    ) : (
                      currentResult.missingInfo.map((item, idx) => (
                        <li key={idx} className="leading-relaxed">• {item}</li>
                      ))
                    )}
                  </ul>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 text-[#6D28D9] font-semibold text-sm mb-3">
                    <Lightbulb className="w-4 h-4" />
                    <span>Specific Improvement Suggestions</span>
                  </div>
                  <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                    {currentResult.suggestions.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommended Next Steps */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-2 text-[#0F172A] font-semibold text-sm mb-3">
                  <ListChecks className="w-4 h-4 text-[#6D28D9]" />
                  <span>Recommended Next Steps</span>
                </div>
                <ol className="space-y-2 text-xs sm:text-sm text-slate-700 list-decimal list-inside">
                  {currentResult.nextSteps.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
