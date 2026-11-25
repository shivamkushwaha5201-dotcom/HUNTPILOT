import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Database, MessageSquare, PlugZap, Send, Trash2 } from 'lucide-react';
import {
  AcademyProgress,
  AnalysisReport,
  ChatMessage,
  CompetitorResearch,
  LaunchDraft,
  Project,
} from '../types';
import { authorizedFetch } from '../utils/validation';
import { UseProductHuntMcpResult } from '../hooks/useProductHuntMcp';
import { ACADEMY_CHAPTERS } from '../data/academyData';
import { PhBanner } from './ui/PhPrimitives';

interface AssistantViewProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  messages: ChatMessage[];
  onAppendTurn: (projectId: string, userMsg: string, assistantReply: string) => Promise<void>;
  onClearHistory: (projectId: string) => Promise<void>;
  drafts: LaunchDraft[];
  reports: AnalysisReport[];
  researchReports: CompetitorResearch[];
  academyProgress: AcademyProgress | null;
  mcp: UseProductHuntMcpResult;
}

const BEGINNER_PROMPTS = [
  'I have never launched on Product Hunt before. Where should I start 2 weeks out?',
  "What is on today's Product Hunt leaderboard, and what makes the top taglines clear?",
  'Find real Product Hunt alternatives in my product space and suggest how to differentiate.',
  'Can you write 3 clearer tagline options under 60 characters for my product?',
  'What should I include in my First Maker Comment so people actually reply?',
];

export function AssistantView({
  projects,
  activeProjectId,
  onSelectProject,
  messages,
  onAppendTurn,
  onClearHistory,
  drafts,
  reports,
  researchReports,
  academyProgress,
  mcp,
}: AssistantViewProps) {
  const contextKey = activeProjectId || 'general';
  const activeProject = projects.find((p) => p.id === activeProjectId) || null;
  const threadMessages = messages.filter((m) => m.projectId === contextKey);

  const projectDrafts = activeProject
    ? drafts.filter((d) => d.projectId === activeProject.id)
    : drafts;
  const projectReports = activeProject
    ? reports.filter((r) => r.projectId === activeProject.id)
    : reports;
  const projectResearch = activeProject
    ? researchReports.filter((r) => r.projectId === activeProject.id)
    : researchReports;

  const totalLessons = ACADEMY_CHAPTERS.reduce((sum, ch) => sum + ch.lessons.length, 0);
  const completedLessonsCount = academyProgress?.completedLessons?.length || 0;
  const totalChecklist = ACADEMY_CHAPTERS.reduce((sum, ch) => sum + ch.checklist.length, 0);
  const completedChecklistCount = academyProgress?.completedChecklistItems?.length || 0;
  const academyPct =
    totalLessons > 0 ? Math.round((completedLessonsCount / totalLessons) * 100) : 0;

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveToolMap, setLiveToolMap] = useState<Record<string, string[]>>({});
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length, sending]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;
    setError(null);
    setInput('');
    setSending(true);

    try {
      const history = threadMessages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const latestDraft = projectDrafts[0] || drafts[0] || null;
      const latestReport = projectReports[0] || reports[0] || null;
      const latestResearch = projectResearch[0] || researchReports[0] || null;

      const incompleteChapters = ACADEMY_CHAPTERS.filter((ch) =>
        ch.lessons.some((l) => !(academyProgress?.completedLessons || []).includes(l.id))
      )
        .slice(0, 3)
        .map((ch) => `Ch.${ch.number}: ${ch.title}`);

      const academySummary = `Completed ${completedLessonsCount}/${totalLessons} lessons (${academyPct}%) and ${completedChecklistCount}/${totalChecklist} checklist items.${
        incompleteChapters.length > 0 ? ` Next chapters: ${incompleteChapters.join(', ')}.` : ''
      }`.slice(0, 750);

      const draftsSummary = latestDraft
        ? `Latest draft (${latestDraft.versionName}) for ${latestDraft.productName}: tagline="${latestDraft.selectedTagline}"; topics=[${latestDraft.topics.join(', ')}]; description="${latestDraft.description.slice(0, 260)}". Total project drafts: ${projectDrafts.length}.`.slice(
            0,
            1150
          )
        : '';

      const latestAnalysisSummary = latestReport
        ? `Latest Readiness Score: ${latestReport.overallScore}/100 (est.) for ${latestReport.draftTitle}. Strengths: ${latestReport.strengths.slice(0, 2).join('; ')}. Weaknesses: ${latestReport.weaknesses.slice(0, 2).join('; ')}. Next steps: ${latestReport.nextSteps.slice(0, 2).join('; ')}.`.slice(
            0,
            1150
          )
        : '';

      const researchSummary = latestResearch
        ? `Latest competitor brief (${latestResearch.query} · ${latestResearch.category}): ${latestResearch.summary.slice(0, 350)}. Differentiation angles: ${latestResearch.differentiationAngles.slice(0, 2).join('; ')}.`.slice(
            0,
            1150
          )
        : '';

      const res = await authorizedFetch<{
        reply: string;
        usedLiveMcpData?: boolean;
        mcpToolsUsed?: string[];
      }>('/api/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({
          message: trimmed,
          history,
          projectContext: activeProject
            ? {
                name: activeProject.name,
                category: activeProject.category,
                tagline: activeProject.tagline,
                targetAudience: activeProject.targetAudience,
                usp: activeProject.usp,
                description: activeProject.description,
                stage: activeProject.stage,
                latestScore: activeProject.latestScore,
              }
            : null,
          academySummary,
          draftsSummary: draftsSummary || undefined,
          latestAnalysisSummary: latestAnalysisSummary || undefined,
          researchSummary: researchSummary || undefined,
        }),
      });

      if (res.usedLiveMcpData && Array.isArray(res.mcpToolsUsed) && res.mcpToolsUsed.length > 0) {
        setLiveToolMap((prev) => ({
          ...prev,
          [res.reply]: res.mcpToolsUsed!,
        }));
      }

      await onAppendTurn(contextKey, trimmed, res.reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant could not respond.');
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#202020] tracking-tight">
            HuntPilot Assistant
          </h1>
          <p className="text-sm text-[#777777] mt-1">
            Your Product Hunt launch strategist—backed by live official Product Hunt MCP search, profiles, alternatives, and leaderboards.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <select
            value={contextKey}
            onChange={(e) => onSelectProject(e.target.value === 'general' ? '' : e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#EAEAEA] bg-white text-xs font-semibold text-[#202020] focus:outline-none focus:border-[#FF6154]"
          >
            <option value="general">General Launch Strategy</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                Context: {p.name}
              </option>
            ))}
          </select>

          {threadMessages.length > 0 && (
            <button
              type="button"
              onClick={() => onClearHistory(contextKey)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#EAEAEA] bg-white hover:bg-[#F7F7F7] text-xs font-medium text-[#555555] hover:text-[#202020] cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Chat
            </button>
          )}
        </div>
      </div>

      {/* Active Project & Live MCP Context Notice */}
      <div className="bg-white border border-[#EAEAEA] rounded-xl px-4 py-3 text-xs text-[#555555] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-[#202020]">Active Context:</span>
          {activeProject ? (
            <>
              <span className="font-medium text-[#202020]">{activeProject.name}</span>
              <span aria-hidden="true">·</span>
              <span>{activeProject.category}</span>
              {activeProject.tagline && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate max-w-md">“{activeProject.tagline}”</span>
                </>
              )}
            </>
          ) : (
            <span>
              General Product Hunt Guidance (select a project above to inject your product details)
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-[#777777]">
            Workspace Context: {projectDrafts.length} drafts · {projectReports.length} reports ·{' '}
            {projectResearch.length} briefs · Academy {academyPct}%
          </span>
          <span aria-hidden="true" className="text-[#EAEAEA]">
            |
          </span>
          {mcp.mcpStatus?.serverReachable ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#16A34A]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Live Product Hunt Data Active
              {mcp.mcpStatus.accountConnected ? ' · Account Connected' : ' · Public Tools'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#777777]">
              <PlugZap className="w-3.5 h-3.5" />
              MCP Tools Ready on Demand
            </span>
          )}
          {!mcp.mcpStatus?.accountConnected && (
            <button
              type="button"
              onClick={() => mcp.connectProductHunt()}
              className="text-[11px] font-semibold text-[#FF6154] hover:underline cursor-pointer"
            >
              Connect Account for Drafts
            </button>
          )}
        </div>
      </div>

      {/* Chat Viewport */}
      <div className="bg-white border border-[#EAEAEA] rounded-2xl flex flex-col h-[580px]">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {threadMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
              <div className="w-11 h-11 rounded-xl bg-[#FFF1F0] border border-[#FFD6D2] text-[#FF6154] flex items-center justify-center mb-4">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-[#202020] mb-1">
                Ask HuntPilot Assistant anything about launching
              </h2>
              <p className="text-xs text-[#777777] mb-6 leading-relaxed">
                Ask about taglines, maker comments, launch timing, or request live Product Hunt leaderboards and competitor lookups.
              </p>

              <div className="w-full space-y-2 text-left">
                {BEGINNER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#EAEAEA] bg-[#F7F7F7] hover:bg-[#FFF1F0] hover:border-[#FFD6D2] text-xs font-medium text-[#202020] transition-colors cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {threadMessages.map((msg) => {
                const usedTools = msg.role === 'assistant' ? liveToolMap[msg.content] : undefined;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-[#FF6154] text-white'
                          : 'bg-[#F7F7F7] border border-[#EAEAEA] text-[#202020]'
                      }`}
                    >
                      {usedTools && usedTools.length > 0 && (
                        <div className="mb-2 pb-1.5 border-b border-[#EAEAEA] flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-[#FF6154]">
                          <Database className="w-3.5 h-3.5" />
                          <span>Live Product Hunt MCP: {usedTools.join(', ')}</span>
                        </div>
                      )}
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-[#F7F7F7] border border-[#EAEAEA] rounded-2xl px-4 py-3 text-xs text-[#777777]">
                    HuntPilot Assistant is checking live Product Hunt data &amp; drafting a response...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {error && (
          <div className="mx-6 mb-3">
            <PhBanner tone="error">{error}</PhBanner>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="p-4 border-t border-[#EAEAEA] flex items-center gap-3"
        >
          <input
            type="text"
            maxLength={2000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about taglines, today's leaderboard, alternatives, or your launch draft..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#EAEAEA] bg-white text-sm text-[#202020] focus:outline-none focus:border-[#FF6154]"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6154] hover:bg-[#E54B3E] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
