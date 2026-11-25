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
import { PhBanner, PhCard, PhEmptyState, PhModal } from './ui/PhPrimitives';

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
    <div className="space-y-7">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#202020] tracking-tight">
            Welcome back, {profile?.displayName?.split(' ')[0] || 'Founder'}
          </h1>
          <p className="text-sm text-[#777777] mt-1">
            {profile?.experienceLevel === 'beginner'
              ? 'First-time launch workspace · Follow Launch Academy chapters and build your first draft step by step.'
              : 'Founder launch workspace · Iterate drafts, compare versions, and sharpen launch readiness.'}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FF6154] hover:bg-[#E54B3E] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Launch Project
        </button>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PhCard padding="p-5" hoverable>
          <p className="text-xs font-medium text-[#777777]">Total Projects</p>
          <p className="text-3xl font-bold text-[#202020] tabular-nums font-mono mt-2">
            {dataLoading ? '—' : projects.length}
          </p>
          <p className="text-xs text-[#777777] mt-1">Active product workspaces</p>
        </PhCard>

        <PhCard padding="p-5" hoverable>
          <p className="text-xs font-medium text-[#777777]">Drafts Created</p>
          <p className="text-3xl font-bold text-[#202020] tabular-nums font-mono mt-2">
            {dataLoading ? '—' : drafts.length}
          </p>
          <p className="text-xs text-[#777777] mt-1">Saved launch versions</p>
        </PhCard>

        <PhCard padding="p-5" hoverable>
          <p className="text-xs font-medium text-[#777777]">Launches Analyzed</p>
          <p className="text-3xl font-bold text-[#202020] tabular-nums font-mono mt-2">
            {dataLoading ? '—' : reports.length}
          </p>
          <p className="text-xs text-[#777777] mt-1">Readiness diagnostics run</p>
        </PhCard>

        <PhCard padding="p-5" hoverable>
          <p className="text-xs font-medium text-[#777777]">Average Readiness Score</p>
          <div className="flex items-baseline gap-1.5 mt-2">
            <p className="text-3xl font-bold text-[#FF6154] tabular-nums font-mono">
              {dataLoading ? '—' : avgScore !== null ? avgScore : '—'}
            </p>
            {avgScore !== null && (
              <span className="text-xs text-[#777777] tabular-nums">/ 100 est.</span>
            )}
          </div>
          <p className="text-xs text-[#777777] mt-1">Estimated preparation quality</p>
        </PhCard>
      </div>

      {/* 5 Quick Action Buttons */}
      <PhCard padding="p-5">
        <p className="text-xs font-semibold text-[#777777] mb-3">Quick Actions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { tab: 'generator' as const, label: 'Create Launch Draft', icon: Sparkles },
            { tab: 'analyzer' as const, label: 'Analyze My Launch', icon: Gauge },
            { tab: 'academy' as const, label: 'Learn Product Hunt', icon: BookOpen },
            { tab: 'research' as const, label: 'Research Competitors', icon: Search },
            { tab: 'assistant' as const, label: 'Ask AI Assistant', icon: MessageSquare },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.tab}
                type="button"
                onClick={() => onNavigateTab(action.tab)}
                className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-[#EAEAEA] bg-[#F7F7F7] hover:bg-[#FFF1F0] hover:border-[#FFD6D2] text-left text-sm font-medium text-[#202020] transition-colors cursor-pointer group"
              >
                <Icon className="w-4 h-4 text-[#FF6154] shrink-0" />
                <span className="truncate group-hover:text-[#202020]">{action.label}</span>
              </button>
            );
          })}
        </div>
      </PhCard>

      {/* Connected Workspace & Live Intelligence Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PhCard padding="p-4" hoverable className="flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#777777]">Product Hunt MCP</p>
              <PlugZap
                className={`w-4 h-4 ${isPhConnected ? 'text-[#16A34A]' : 'text-[#FF6154]'}`}
              />
            </div>
            <p className="text-sm font-bold text-[#202020] mt-1.5 truncate">
              {isPhConnected
                ? connectedUsername
                  ? `@${connectedUsername}`
                  : connectedDisplayName || 'Account Connected'
                : mcp.mcpStatus?.serverReachable
                ? 'Public Tools Active'
                : 'Ready to Connect'}
            </p>
            <p className="text-[11px] text-[#777777] mt-0.5">
              {isPhConnected
                ? 'Draft sync, updates & submissions unlocked'
                : 'Public research live · Connect PH for drafts'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('profile')}
            className="text-xs font-semibold text-[#FF6154] hover:underline text-left cursor-pointer"
          >
            {isPhConnected ? 'Manage MCP Connection →' : 'Connect Product Hunt →'}
          </button>
        </PhCard>

        <PhCard padding="p-4" hoverable className="flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#777777]">Launch Academy</p>
              <BookOpen className="w-4 h-4 text-[#FF6154]" />
            </div>
            <p className="text-sm font-bold text-[#202020] mt-1.5 tabular-nums">
              {academyPercent}% Complete
            </p>
            <p className="text-[11px] text-[#777777] mt-0.5 tabular-nums">
              {completedLessonsCount}/{totalLessons} lessons · {completedChecklistCount}/
              {totalChecklist} checklist items
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('academy')}
            className="text-xs font-semibold text-[#FF6154] hover:underline text-left cursor-pointer"
          >
            Continue Academy →
          </button>
        </PhCard>

        <PhCard padding="p-4" hoverable className="flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#777777]">Tracked Launches</p>
              <Calendar className="w-4 h-4 text-[#FF6154]" />
            </div>
            <p className="text-sm font-bold text-[#202020] mt-1.5 tabular-nums">
              {launchSchedules.length} {launchSchedules.length === 1 ? 'Launch' : 'Launches'}
            </p>
            <p className="text-[11px] text-[#777777] mt-0.5 truncate">
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
            className="text-xs font-semibold text-[#FF6154] hover:underline text-left cursor-pointer"
          >
            Manage Launch Schedule →
          </button>
        </PhCard>

        <PhCard padding="p-4" hoverable className="flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#777777]">Live PH Intelligence</p>
              <TrendingUp className="w-4 h-4 text-[#FF6154]" />
            </div>
            <p className="text-sm font-bold text-[#202020] mt-1.5">Leaderboards &amp; Pulse</p>
            <p className="text-[11px] text-[#777777] mt-0.5">
              Points, speed velocity, hunters &amp; 15m snapshots
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('intelligence')}
            className="text-xs font-semibold text-[#FF6154] hover:underline text-left cursor-pointer"
          >
            Open Live Intelligence →
          </button>
        </PhCard>
      </div>

      {/* Main Content Split: Projects & Readiness Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Projects List */}
        <PhCard className="lg:col-span-7">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-base font-bold text-[#202020]">Your Launch Projects</h2>
              <p className="text-xs text-[#777777] mt-0.5">
                Select an active project to share context across Draft Generator, Analyzer, and Assistant.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="text-xs font-semibold text-[#FF6154] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              + Add Project
            </button>
          </div>

          {projects.length === 0 ? (
            <PhEmptyState
              icon={<FolderPlus className="w-5 h-5" />}
              title="No launch projects yet"
              description="Create your first project to organize taglines, launch drafts, readiness scores, and AI strategy conversations."
              action={
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="px-4 py-2 rounded-lg bg-[#FF6154] hover:bg-[#E54B3E] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Create First Project
                </button>
              }
            />
          ) : (
            <div className="divide-y divide-[#F0F0F0]">
              {projects.map((proj) => {
                const isSelected = proj.id === activeProjectId;
                return (
                  <div
                    key={proj.id}
                    className={`py-3.5 px-3 -mx-3 rounded-xl flex items-center justify-between gap-4 transition-colors ${
                      isSelected ? 'bg-[#FFF1F0]' : 'hover:bg-[#F7F7F7]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectProject(proj.id)}
                      className="flex-1 text-left min-w-0 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#202020] truncate">
                          {proj.name}
                        </span>
                        {isSelected && (
                          <span className="text-[11px] font-semibold text-[#FF6154]">
                            · Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#777777] mt-0.5 truncate">
                        {proj.category} · Stage: {proj.stage}
                        {proj.tagline ? ` · ${proj.tagline}` : ''}
                      </p>
                    </button>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <div className="text-right mr-1">
                        <p className="text-xs font-mono font-bold text-[#202020] tabular-nums">
                          {proj.latestScore !== undefined ? `${proj.latestScore}/100` : '—'}
                        </p>
                        <p className="text-[11px] text-[#777777]">Est. Score</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEditModal(proj)}
                        title="Edit project"
                        className="p-1.5 text-[#777777] hover:text-[#FF6154] rounded-md hover:bg-white transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProject(proj.id)}
                        title="Delete project"
                        className="p-1.5 text-[#777777] hover:text-[#DC2626] rounded-md hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PhCard>

        {/* Readiness Score History Chart */}
        <PhCard className="lg:col-span-5 flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-bold text-[#202020]">Readiness Score Trend</h2>
            <p className="text-xs text-[#777777] mt-0.5">
              Estimated Launch Readiness Scores across your recent analyses
            </p>
          </div>

          {chartData.length === 0 ? (
            <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center text-center border border-dashed border-[#DCDCDC] rounded-xl bg-[#FAFAFA] p-6">
              <Gauge className="w-7 h-7 text-[#777777] mb-2" />
              <p className="text-sm font-semibold text-[#202020]">No analysis scores yet</p>
              <p className="text-xs text-[#777777] mt-1 mb-3">
                Run your launch draft through the Launch Analyzer to see category diagnostics.
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('analyzer')}
                className="px-3.5 py-1.5 rounded-lg bg-[#FF6154] hover:bg-[#E54B3E] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Analyze a Draft
              </button>
            </div>
          ) : (
            <div className="flex-1 min-h-[240px]">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#777777' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#777777' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #EAEAEA',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="score" name="Est. Readiness" fill="#FF6154" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </PhCard>
      </div>

      {/* Bottom Split: Saved Launch Drafts & Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Saved Launch Drafts */}
        <PhCard className="lg:col-span-7">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-base font-bold text-[#202020]">Saved Launch Drafts</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('generator')}
              className="text-xs font-semibold text-[#FF6154] hover:underline cursor-pointer"
            >
              Open Draft Generator
            </button>
          </div>

          {drafts.length === 0 ? (
            <PhEmptyState
              icon={<FileText className="w-5 h-5" />}
              title="No saved drafts yet"
              description="Generate taglines, maker comments, and demo scripts in the Draft Generator."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EAEAEA] text-xs text-[#777777]">
                    <th className="py-2.5 pr-4 font-medium">Product</th>
                    <th className="py-2.5 pr-4 font-medium">Version</th>
                    <th className="py-2.5 pr-4 font-medium">Selected Tagline</th>
                    <th className="py-2.5 text-right font-medium">Saved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F3F3] text-sm">
                  {drafts.slice(0, 6).map((d) => (
                    <tr key={d.id} className="hover:bg-[#FAFAFA]">
                      <td className="py-3 pr-4 font-semibold text-[#202020] whitespace-nowrap">
                        {d.productName}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs font-semibold text-[#FF6154] whitespace-nowrap">
                        {d.versionName}
                      </td>
                      <td className="py-3 pr-4 text-[#555555] max-w-xs truncate">
                        {d.selectedTagline}
                      </td>
                      <td className="py-3 text-right text-xs text-[#777777] whitespace-nowrap tabular-nums">
                        {formatTimestamp(d.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PhCard>

        {/* Recent Activities */}
        <PhCard className="lg:col-span-5">
          <h2 className="text-base font-bold text-[#202020] mb-4">Recent Activities</h2>
          {activities.length === 0 ? (
            <PhEmptyState
              icon={<Sparkles className="w-5 h-5" />}
              title="No recent activity"
              description="Your project updates, draft saves, and Academy milestones appear here."
            />
          ) : (
            <div className="space-y-3.5">
              {activities.slice(0, 6).map((act) => (
                <div
                  key={act.id}
                  className="pb-3 border-b border-[#F3F3F3] last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[#202020] truncate">{act.title}</p>
                    <span className="text-[11px] text-[#777777] whitespace-nowrap tabular-nums">
                      {formatTimestamp(act.createdAt)}
                    </span>
                  </div>
                  {act.detail && (
                    <p className="text-xs text-[#777777] mt-0.5 truncate">{act.detail}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </PhCard>
      </div>

      {/* Tracked Launch Schedules */}
      {launchSchedules.length > 0 && (
        <PhCard>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-bold text-[#202020]">
                Tracked Launch Schedule &amp; Live Status
              </h2>
              <p className="text-xs text-[#777777] mt-0.5">
                Monitor your upcoming, scheduled, and live Product Hunt launches.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('generator')}
              className="text-xs font-semibold text-[#FF6154] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Manage in Draft Generator
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EAEAEA] text-xs text-[#777777]">
                  <th className="py-2.5 pr-4 font-medium">Product</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                  <th className="py-2.5 pr-4 font-medium">Target Date (PT)</th>
                  <th className="py-2.5 text-right font-medium">Live PH Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F3F3] text-sm">
                {launchSchedules.slice(0, 6).map((sched) => (
                  <tr key={sched.id} className="hover:bg-[#FAFAFA]">
                    <td className="py-3 pr-4 font-semibold text-[#202020] whitespace-nowrap">
                      {sched.productName}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-xs">
                      <span
                        className={`font-semibold uppercase tracking-wide ${
                          sched.status === 'live'
                            ? 'text-[#16A34A]'
                            : sched.status === 'scheduled'
                            ? 'text-[#FF6154]'
                            : 'text-[#777777]'
                        }`}
                      >
                        {sched.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-[#555555] whitespace-nowrap">
                      {sched.launchDate || 'Unscheduled'}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap text-xs">
                      {sched.liveUrl ? (
                        <a
                          href={sched.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-[#FF6154] hover:underline"
                        >
                          Open Launch <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[#999999]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PhCard>
      )}

      {/* Saved Analysis Reports */}
      <PhCard>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-[#202020]">Saved Analysis Reports</h2>
            <p className="text-xs text-[#777777] mt-0.5">
              Estimated Launch Readiness diagnostics saved to your workspace (scores are estimates, not featuring probability).
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('analyzer')}
            className="text-xs font-semibold text-[#FF6154] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Open Launch Analyzer
          </button>
        </div>

        {reports.length === 0 ? (
          <PhEmptyState
            icon={<Gauge className="w-5 h-5" />}
            title="No analysis reports saved yet"
            description="Submit your launch copy in the AI Launch Analyzer to store readiness scores and recommendations."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EAEAEA] text-xs text-[#777777]">
                  <th className="py-2.5 pr-4 font-medium">Product / Draft</th>
                  <th className="py-2.5 pr-4 font-medium">Est. Readiness</th>
                  <th className="py-2.5 pr-4 font-medium">Diagnostic Summary</th>
                  <th className="py-2.5 pr-4 font-medium">Analyzed</th>
                  <th className="py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F3F3] text-sm">
                {reports.slice(0, 6).map((rep) => (
                  <tr key={rep.id} className="hover:bg-[#FAFAFA]">
                    <td className="py-3 pr-4 font-semibold text-[#202020] whitespace-nowrap">
                      {rep.draftTitle}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs font-bold text-[#FF6154] whitespace-nowrap tabular-nums">
                      {rep.overallScore}/100 est.
                    </td>
                    <td className="py-3 pr-4 text-[#555555] max-w-md truncate">{rep.summary}</td>
                    <td className="py-3 pr-4 text-xs text-[#777777] whitespace-nowrap tabular-nums">
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
                          className="text-xs font-semibold text-[#FF6154] hover:underline cursor-pointer"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteReport(rep.id)}
                          title="Delete analysis report"
                          className="p-1 text-[#777777] hover:text-[#DC2626] rounded hover:bg-[#FEF2F2] cursor-pointer"
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
      </PhCard>

      {/* Create / Edit Project Modal */}
      {showProjectModal && (
        <PhModal
          title={editingProject ? 'Edit Launch Project' : 'Create Launch Project'}
          onClose={() => {
            setShowProjectModal(false);
            setEditingProject(null);
          }}
        >
          <form onSubmit={handleProjectSubmit} className="space-y-4">
            {formError && <PhBanner tone="error">{formError}</PhBanner>}

            <div>
              <label className="block text-xs font-medium text-[#202020] mb-1">
                Product Name *
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., PulseBoard"
                className="w-full px-3.5 py-2 rounded-lg border border-[#EAEAEA] text-sm focus:outline-none focus:border-[#FF6154]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#202020] mb-1">
                  Category *
                </label>
                <select
                  value={CATEGORIES.includes(category) ? category : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value !== '__custom__') {
                      setCategory(e.target.value);
                    }
                  }}
                  className="w-full px-3.5 py-2 rounded-lg border border-[#EAEAEA] text-sm bg-white focus:outline-none focus:border-[#FF6154]"
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
                <label className="block text-xs font-medium text-[#202020] mb-1">
                  Website URL
                </label>
                <input
                  type="url"
                  maxLength={300}
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourproduct.com"
                  className="w-full px-3.5 py-2 rounded-lg border border-[#EAEAEA] text-sm focus:outline-none focus:border-[#FF6154]"
                />
              </div>
            </div>

            {editingProject && (
              <div>
                <label className="block text-xs font-medium text-[#202020] mb-1">
                  Launch Stage
                </label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as ProjectStage)}
                  className="w-full px-3.5 py-2 rounded-lg border border-[#EAEAEA] text-sm bg-white focus:outline-none focus:border-[#FF6154]"
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
              <label className="block text-xs font-medium text-[#202020] mb-1">
                Working Tagline (optional)
              </label>
              <input
                type="text"
                maxLength={120}
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Short 1-line summary under 60 characters"
                className="w-full px-3.5 py-2 rounded-lg border border-[#EAEAEA] text-sm focus:outline-none focus:border-[#FF6154]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#202020] mb-1">
                Target Audience
              </label>
              <input
                type="text"
                maxLength={500}
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g., B2B SaaS product managers and indie founders"
                className="w-full px-3.5 py-2 rounded-lg border border-[#EAEAEA] text-sm focus:outline-none focus:border-[#FF6154]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#202020] mb-1">
                Unique Selling Proposition (USP)
              </label>
              <input
                type="text"
                maxLength={800}
                value={usp}
                onChange={(e) => setUsp(e.target.value)}
                placeholder="What makes this measurably faster, simpler, or different?"
                className="w-full px-3.5 py-2 rounded-lg border border-[#EAEAEA] text-sm focus:outline-none focus:border-[#FF6154]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#202020] mb-1">
                Brief Description
              </label>
              <textarea
                rows={3}
                maxLength={2500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What problem does your product solve and how does it work?"
                className="w-full px-3.5 py-2 rounded-lg border border-[#EAEAEA] text-sm focus:outline-none focus:border-[#FF6154]"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowProjectModal(false);
                  setEditingProject(null);
                }}
                className="px-4 py-2 rounded-lg border border-[#EAEAEA] text-sm font-medium text-[#555555] hover:bg-[#F7F7F7] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-[#FF6154] hover:bg-[#E54B3E] text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
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
        </PhModal>
      )}
    </div>
  );
}
