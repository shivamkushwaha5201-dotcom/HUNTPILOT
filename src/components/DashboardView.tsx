import React, { useState } from 'react';
import {
  BookOpen,
  Calendar,
  ExternalLink,
  FileText,
  FolderPlus,
  Gauge,
  MessageSquare,
  Pencil,
  PlugZap,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
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
  AcademyProgress,
  Activity,
  AnalysisReport,
  LaunchDraft,
  LaunchScheduleRecord,
  PhConnectionRecord,
  Project,
  ProjectStage,
  UserProfile,
  WorkspaceTab,
} from '../types';
import { formatTimestamp, isValidHttpUrl } from '../utils/validation';
import { UseProductHuntMcpResult } from '../hooks/useProductHuntMcp';
import { ACADEMY_CHAPTERS } from '../data/academyData';

interface DashboardViewProps {
  profile: UserProfile | null;
  projects: Project[];
  drafts: LaunchDraft[];
  reports: AnalysisReport[];
  activities: Activity[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onNavigateTab: (tab: WorkspaceTab) => void;
  onCreateProject: (input: {
    name: string;
    tagline?: string;
    websiteUrl?: string;
    category: string;
    targetAudience?: string;
    mainProblem?: string;
    keyFeatures?: string[];
    usp?: string;
    description?: string;
    stage?: ProjectStage;
  }) => Promise<Project>;
  onUpdateProject: (
    projectId: string,
    updates: Partial<{
      name: string;
      tagline: string;
      websiteUrl: string;
      category: string;
      targetAudience: string;
      mainProblem: string;
      keyFeatures: string[];
      usp: string;
      description: string;
      stage: ProjectStage;
    }>
  ) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onDeleteReport: (reportId: string) => Promise<void>;
  onOpenReport?: (report: AnalysisReport) => void;
  academyProgress: AcademyProgress | null;
  mcp: UseProductHuntMcpResult;
  phConnection: PhConnectionRecord | null;
  launchSchedules: LaunchScheduleRecord[];
  dataLoading: boolean;
}

const CATEGORIES = [
  'SaaS',
  'Artificial Intelligence',
  'Developer Tools',
  'Productivity',
  'Design Tools',
  'Marketing',
  'No-Code',
  'Fintech',
  'Analytics',
];

const STAGES: { value: ProjectStage; label: string }[] = [
  { value: 'idea', label: 'Idea' },
  { value: 'drafting', label: 'Drafting' },
  { value: 'ready', label: 'Ready to Launch' },
  { value: 'launched', label: 'Launched' },
];

export function DashboardView({
  profile,
  projects,
  drafts,
  reports,
  activities,
  activeProjectId,
  onSelectProject,
  onNavigateTab,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onDeleteReport,
  onOpenReport,
  academyProgress,
  mcp,
  phConnection,
  launchSchedules,
  dataLoading,
}: DashboardViewProps) {
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [category, setCategory] = useState('SaaS');
  const [stage, setStage] = useState<ProjectStage>('idea');
  const [targetAudience, setTargetAudience] = useState('');
  const [usp, setUsp] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const avgScore =
    reports.length > 0
      ? Math.round(reports.reduce((sum, r) => sum + r.overallScore, 0) / reports.length)
      : null;

  const chartData = reports
    .slice(0, 8)
    .reverse()
    .map((r) => ({
      name: r.draftTitle.length > 14 ? `${r.draftTitle.slice(0, 14)}…` : r.draftTitle,
      score: r.overallScore,
    }));

  const totalLessons = ACADEMY_CHAPTERS.reduce((sum, ch) => sum + ch.lessons.length, 0);
  const completedLessonsCount = academyProgress?.completedLessons?.length || 0;
  const academyPercent =
    totalLessons > 0 ? Math.round((completedLessonsCount / totalLessons) * 100) : 0;
  const totalChecklist = ACADEMY_CHAPTERS.reduce((sum, ch) => sum + ch.checklist.length, 0);
  const completedChecklistCount = academyProgress?.completedChecklistItems?.length || 0;

  const isPhConnected = Boolean(
    mcp.mcpStatus?.accountConnected ?? phConnection?.accountConnected
  );
  const connectedUsername =
    mcp.mcpStatus?.account?.username || phConnection?.username || null;
  const connectedDisplayName =
    mcp.mcpStatus?.account?.name || phConnection?.name || null;

  const openCreateModal = () => {
    setEditingProject(null);
    setName('');
    setTagline('');
    setWebsiteUrl('');
    setCategory('SaaS');
    setStage('idea');
    setTargetAudience('');
    setUsp('');
    setDescription('');
    setFormError(null);
    setShowProjectModal(true);
  };

  const openEditModal = (proj: Project) => {
    setEditingProject(proj);
    setName(proj.name || '');
    setTagline(proj.tagline || '');
    setWebsiteUrl(proj.websiteUrl || '');
    setCategory(proj.category || 'SaaS');
    setStage(proj.stage || 'idea');
    setTargetAudience(proj.targetAudience || '');
    setUsp(proj.usp || '');
    setDescription(proj.description || '');
    setFormError(null);
    setShowProjectModal(true);
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('Please enter a product name.');
      return;
    }
    if (websiteUrl.trim() && !isValidHttpUrl(websiteUrl)) {
      setFormError('Website URL must start with https:// or http://.');
      return;
    }

    setSaving(true);
    try {
      if (editingProject) {
        await onUpdateProject(editingProject.id, {
          name,
          tagline,
          websiteUrl,
          category,
          targetAudience,
          usp,
          description,
          stage,
        });
      } else {
        const created = await onCreateProject({
          name,
          tagline,
          websiteUrl,
          category,
          targetAudience,
          usp,
          description,
          stage: 'idea',
        });
        onSelectProject(created.id);
      }
      setShowProjectModal(false);
      setEditingProject(null);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : editingProject
          ? 'Could not update project.'
          : 'Could not create project.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Welcome back, {profile?.displayName?.split(' ')[0] || 'Founder'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {profile?.experienceLevel === 'beginner'
              ? 'First-time launch workspace · Follow Launch Academy chapters and build your first draft step by step.'
              : 'Founder launch workspace · Iterate drafts, compare versions, and sharpen launch readiness.'}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Launch Project
        </button>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Total Projects</p>
          <p className="text-3xl font-bold text-[#0F172A] tabular-nums font-mono mt-2">
            {dataLoading ? '—' : projects.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Active product workspaces</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Drafts Created</p>
          <p className="text-3xl font-bold text-[#0F172A] tabular-nums font-mono mt-2">
            {dataLoading ? '—' : drafts.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Saved launch versions</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Launches Analyzed</p>
          <p className="text-3xl font-bold text-[#0F172A] tabular-nums font-mono mt-2">
            {dataLoading ? '—' : reports.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Readiness diagnostics run</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Average Readiness Score</p>
          <div className="flex items-baseline gap-1.5 mt-2">
            <p className="text-3xl font-bold text-[#0F172A] tabular-nums font-mono">
              {dataLoading ? '—' : avgScore !== null ? avgScore : '—'}
            </p>
            {avgScore !== null && (
              <span className="text-xs text-slate-500 tabular-nums">/ 100 est.</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">Estimated preparation quality</p>
        </div>
      </div>

      {/* 5 Quick Action Buttons */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-xs font-semibold text-slate-500 mb-3">Quick Actions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => onNavigateTab('generator')}
            className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-violet-50 hover:border-violet-200 text-left text-sm font-medium text-[#0F172A] transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#6D28D9] shrink-0" />
            <span className="truncate">Create Launch Draft</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('analyzer')}
            className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-200 text-left text-sm font-medium text-[#0F172A] transition-colors cursor-pointer"
          >
            <Gauge className="w-4 h-4 text-[#EA580C] shrink-0" />
            <span className="truncate">Analyze My Launch</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('academy')}
            className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-violet-50 hover:border-violet-200 text-left text-sm font-medium text-[#0F172A] transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-[#6D28D9] shrink-0" />
            <span className="truncate">Learn Product Hunt</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('research')}
            className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-200 text-left text-sm font-medium text-[#0F172A] transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4 text-[#EA580C] shrink-0" />
            <span className="truncate">Research Competitors</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('assistant')}
            className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-violet-50 hover:border-violet-200 text-left text-sm font-medium text-[#0F172A] transition-colors cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 text-[#6D28D9] shrink-0" />
            <span className="truncate">Ask AI Assistant</span>
          </button>
        </div>
      </div>

      {/* Connected Workspace & Live Intelligence Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">Product Hunt MCP</p>
              <PlugZap
                className={`w-4 h-4 ${
                  isPhConnected ? 'text-emerald-600' : 'text-[#6D28D9]'
                }`}
              />
            </div>
            <p className="text-sm font-bold text-[#0F172A] mt-1.5 truncate">
              {isPhConnected
                ? connectedUsername
                  ? `@${connectedUsername}`
                  : connectedDisplayName || 'Account Connected'
                : mcp.mcpStatus?.serverReachable
                ? 'Public Tools Active'
                : 'Ready to Connect'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isPhConnected
                ? 'Draft sync, updates & submissions unlocked'
                : 'Public research live · Connect PH for drafts'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('profile')}
            className="text-xs font-semibold text-[#6D28D9] hover:underline text-left cursor-pointer"
          >
            {isPhConnected ? 'Manage MCP Connection →' : 'Connect Product Hunt →'}
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">Launch Academy</p>
              <BookOpen className="w-4 h-4 text-[#6D28D9]" />
            </div>
            <p className="text-sm font-bold text-[#0F172A] mt-1.5 tabular-nums">
              {academyPercent}% Complete
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
              {completedLessonsCount}/{totalLessons} lessons · {completedChecklistCount}/
              {totalChecklist} checklist items
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('academy')}
            className="text-xs font-semibold text-[#6D28D9] hover:underline text-left cursor-pointer"
          >
            Continue Academy →
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">Tracked Launches</p>
              <Calendar className="w-4 h-4 text-[#EA580C]" />
            </div>
            <p className="text-sm font-bold text-[#0F172A] mt-1.5 tabular-nums">
              {launchSchedules.length} {launchSchedules.length === 1 ? 'Launch' : 'Launches'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              {launchSchedules[0]
                ? `${launchSchedules[0].productName} (${launchSchedules[0].status}${
                    launchSchedules[0].launchDate ? ` · ${launchSchedules[0].launchDate}` : ''
                  })`
                : 'Track target launch dates & live PH URLs'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('generator')}
            className="text-xs font-semibold text-[#EA580C] hover:underline text-left cursor-pointer"
          >
            Manage Launch Schedule →
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">Live PH Intelligence</p>
              <TrendingUp className="w-4 h-4 text-[#EA580C]" />
            </div>
            <p className="text-sm font-bold text-[#0F172A] mt-1.5">
              Leaderboards &amp; Pulse
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Points, speed velocity, hunters &amp; 15m snapshots
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('intelligence')}
            className="text-xs font-semibold text-[#EA580C] hover:underline text-left cursor-pointer"
          >
            Open Live Intelligence →
          </button>
        </div>
      </div>

      {/* Main Content Split: Projects & Readiness Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Projects List */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-base font-semibold text-[#0F172A]">Your Launch Projects</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select an active project to share context across Draft Generator, Analyzer, and Assistant.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="text-xs font-semibold text-[#6D28D9] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              + Add Project
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="py-10 px-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50">
              <FolderPlus className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#0F172A] mb-1">No launch projects yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                Create your first project to organize taglines, launch drafts, readiness scores, and AI strategy conversations.
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="px-4 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Create First Project
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {projects.map((proj) => {
                const isSelected = proj.id === activeProjectId;
                return (
                  <div
                    key={proj.id}
                    className={`py-3.5 px-3 -mx-3 rounded-lg flex items-center justify-between gap-4 transition-colors ${
                      isSelected ? 'bg-violet-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectProject(proj.id)}
                      className="flex-1 text-left min-w-0 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#0F172A] truncate">
                          {proj.name}
                        </span>
                        {isSelected && (
                          <span className="text-[11px] font-semibold text-[#6D28D9]">
                            · Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {proj.category} · Stage: {proj.stage}
                        {proj.tagline ? ` · ${proj.tagline}` : ''}
                      </p>
                    </button>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <div className="text-right mr-1">
                        <p className="text-xs font-mono font-semibold text-[#0F172A] tabular-nums">
                          {proj.latestScore !== undefined ? `${proj.latestScore}/100` : '—'}
                        </p>
                        <p className="text-[11px] text-slate-400">Est. Score</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEditModal(proj)}
                        title="Edit project"
                        className="p-1.5 text-slate-400 hover:text-[#6D28D9] rounded-md hover:bg-violet-50 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProject(proj.id)}
                        title="Delete project"
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Readiness Score History Chart */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[#0F172A]">Readiness Score Trend</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Estimated Launch Readiness Scores across your recent analyses
            </p>
          </div>

          {chartData.length === 0 ? (
            <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-xl bg-slate-50 p-6">
              <Gauge className="w-7 h-7 text-slate-400 mb-2" />
              <p className="text-sm font-medium text-[#0F172A]">No analysis scores yet</p>
              <p className="text-xs text-slate-500 mt-1 mb-3">
                Run your launch draft through the Launch Analyzer to see category diagnostics.
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('analyzer')}
                className="px-3.5 py-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Analyze a Draft
              </button>
            </div>
          ) : (
            <div className="flex-1 min-h-[240px]">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="score" name="Est. Readiness" fill="#6D28D9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Split: Saved Launch Drafts & Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Saved Launch Drafts */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-base font-semibold text-[#0F172A]">Saved Launch Drafts</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('generator')}
              className="text-xs font-semibold text-[#6D28D9] hover:underline cursor-pointer"
            >
              Open Draft Generator
            </button>
          </div>

          {drafts.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50">
              <FileText className="w-7 h-7 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-[#0F172A]">No saved drafts yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Generate taglines, maker comments, and demo scripts in the Draft Generator.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2.5 pr-4 font-medium">Product</th>
                    <th className="py-2.5 pr-4 font-medium">Version</th>
                    <th className="py-2.5 pr-4 font-medium">Selected Tagline</th>
                    <th className="py-2.5 text-right font-medium">Saved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {drafts.slice(0, 6).map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-4 font-medium text-[#0F172A] whitespace-nowrap">
                        {d.productName}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-[#6D28D9] whitespace-nowrap">
                        {d.versionName}
                      </td>
                      <td className="py-3 pr-4 text-slate-600 max-w-xs truncate">
                        {d.selectedTagline}
                      </td>
                      <td className="py-3 text-right text-xs text-slate-500 whitespace-nowrap tabular-nums">
                        {formatTimestamp(d.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-[#0F172A] mb-4">Recent Activities</h2>
          {activities.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50">
              <p className="text-sm font-medium text-[#0F172A]">No recent activity</p>
              <p className="text-xs text-slate-500 mt-1">
                Your project updates, draft saves, and Academy milestones appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.slice(0, 6).map((act) => (
                <div key={act.id} className="pb-3 border-b border-slate-100 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{act.title}</p>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap tabular-nums">
                      {formatTimestamp(act.createdAt)}
                    </span>
                  </div>
                  {act.detail && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{act.detail}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tracked Launch Schedules */}
      {launchSchedules.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#0F172A]">
                Tracked Launch Schedule &amp; Live Status
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitor your upcoming, scheduled, and live Product Hunt launches.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('generator')}
              className="text-xs font-semibold text-[#6D28D9] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Manage in Draft Generator
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2.5 pr-4 font-medium">Product</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                  <th className="py-2.5 pr-4 font-medium">Target Date (PT)</th>
                  <th className="py-2.5 text-right font-medium">Live PH Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {launchSchedules.slice(0, 6).map((sched) => (
                  <tr key={sched.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-4 font-medium text-[#0F172A] whitespace-nowrap">
                      {sched.productName}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                          sched.status === 'live'
                            ? 'bg-emerald-50 text-emerald-700'
                            : sched.status === 'scheduled'
                            ? 'bg-violet-50 text-[#6D28D9]'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {sched.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {sched.launchDate || 'Unscheduled'}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap text-xs">
                      {sched.liveUrl ? (
                        <a
                          href={sched.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-[#6D28D9] hover:underline"
                        >
                          Open Launch <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Saved Analysis Reports */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">Saved Analysis Reports</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Estimated Launch Readiness diagnostics saved to your workspace (scores are estimates, not featuring probability).
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('analyzer')}
            className="text-xs font-semibold text-[#EA580C] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Open Launch Analyzer
          </button>
        </div>

        {reports.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50">
            <Gauge className="w-7 h-7 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-[#0F172A]">No analysis reports saved yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Submit your launch copy in the AI Launch Analyzer to store readiness scores and recommendations.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2.5 pr-4 font-medium">Product / Draft</th>
                  <th className="py-2.5 pr-4 font-medium">Est. Readiness</th>
                  <th className="py-2.5 pr-4 font-medium">Diagnostic Summary</th>
                  <th className="py-2.5 pr-4 font-medium">Analyzed</th>
                  <th className="py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {reports.slice(0, 6).map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-4 font-medium text-[#0F172A] whitespace-nowrap">
                      {rep.draftTitle}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs font-bold text-[#6D28D9] whitespace-nowrap tabular-nums">
                      {rep.overallScore}/100 est.
                    </td>
                    <td className="py-3 pr-4 text-slate-600 max-w-md truncate">
                      {rep.summary}
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                      {formatTimestamp(rep.createdAt)}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenReport) {
                              onOpenReport(rep);
                            } else {
                              onSelectProject(rep.projectId);
                              onNavigateTab('analyzer');
                            }
                          }}
                          className="text-xs font-semibold text-[#6D28D9] hover:underline cursor-pointer"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteReport(rep.id)}
                          title="Delete analysis report"
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-[#0F172A]">
                {editingProject ? 'Edit Launch Project' : 'Create Launch Project'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowProjectModal(false);
                  setEditingProject(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProjectSubmit} className="mt-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., PulseBoard"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={CATEGORIES.includes(category) ? category : '__custom__'}
                    onChange={(e) => {
                      if (e.target.value !== '__custom__') {
                        setCategory(e.target.value);
                      }
                    }}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    {!CATEGORIES.includes(category) && (
                      <option value="__custom__">{category}</option>
                    )}
                  </select>
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
                    placeholder="https://yourproduct.com"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
                  />
                </div>
              </div>

              {editingProject && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Launch Stage
                  </label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value as ProjectStage)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
                  >
                    {STAGES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Working Tagline (optional)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Short 1-line summary under 60 characters"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Target Audience
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g., B2B SaaS product managers and indie founders"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Unique Selling Proposition (USP)
                </label>
                <input
                  type="text"
                  maxLength={800}
                  value={usp}
                  onChange={(e) => setUsp(e.target.value)}
                  placeholder="What makes this measurably faster, simpler, or different?"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Brief Description
                </label>
                <textarea
                  rows={3}
                  maxLength={2500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What problem does your product solve and how does it work?"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowProjectModal(false);
                    setEditingProject(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
                >
                  {saving
                    ? editingProject
                      ? 'Saving...'
                      : 'Creating...'
                    : editingProject
                    ? 'Save Changes'
                    : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
