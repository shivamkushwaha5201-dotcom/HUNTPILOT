import React, { useCallback, useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HuntPilotLogo } from './components/ui/PhPrimitives';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { AppShell } from './components/AppShell';
import { DashboardView } from './components/DashboardView';
import { AcademyView } from './components/AcademyView';
import { DraftGeneratorView } from './components/DraftGeneratorView';
import {
  LaunchAnalyzerView,
  PendingResearchImport,
} from './components/LaunchAnalyzerView';
import { AssistantView } from './components/AssistantView';
import { ResearchView } from './components/ResearchView';
import { IntelligenceView } from './components/IntelligenceView';
import { ProfileView } from './components/ProfileView';
import { useWorkspaceData } from './hooks/useWorkspaceData';
import { useProductHuntMcp } from './hooks/useProductHuntMcp';
import { resolvedFirebaseStatus } from './firebase';
import { WorkspaceTab } from './types';

type ViewMode = 'landing' | 'auth' | 'workspace';
type AuthMode = 'login' | 'signup' | 'forgot';

const VALID_TABS: readonly WorkspaceTab[] = [
  'dashboard',
  'academy',
  'generator',
  'analyzer',
  'assistant',
  'research',
  'intelligence',
  'profile',
];

function parsePathRoute(pathname: string): {
  viewMode: ViewMode;
  authMode: AuthMode;
  activeTab: WorkspaceTab;
} {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/auth/signup') {
    return { viewMode: 'auth', authMode: 'signup', activeTab: 'dashboard' };
  }
  if (clean === '/auth/forgot') {
    return { viewMode: 'auth', authMode: 'forgot', activeTab: 'dashboard' };
  }
  if (clean === '/auth') {
    return { viewMode: 'auth', authMode: 'login', activeTab: 'dashboard' };
  }
  if (clean === '/app' || clean.startsWith('/app/')) {
    const seg = clean.slice('/app/'.length).split('/')[0] as WorkspaceTab;
    const tab = VALID_TABS.includes(seg) ? seg : 'dashboard';
    return { viewMode: 'workspace', authMode: 'login', activeTab: tab };
  }
  return { viewMode: 'landing', authMode: 'login', activeTab: 'dashboard' };
}

function buildRoutePath(viewMode: ViewMode, authMode: AuthMode, activeTab: WorkspaceTab): string {
  if (viewMode === 'auth') {
    if (authMode === 'signup') return '/auth/signup';
    if (authMode === 'forgot') return '/auth/forgot';
    return '/auth';
  }
  if (viewMode === 'workspace') {
    return `/app/${activeTab}`;
  }
  return '/';
}

function HuntPilotApp() {
  const { user, profile, authReady, signOutUser } = useAuth();
  const isVerifiedAuthenticated = Boolean(user && user.emailVerified);
  const mcp = useProductHuntMcp(isVerifiedAuthenticated);

  const [initialRoute] = useState(() =>
    typeof window !== 'undefined'
      ? parsePathRoute(window.location.pathname)
      : { viewMode: 'landing' as ViewMode, authMode: 'login' as AuthMode, activeTab: 'dashboard' as WorkspaceTab }
  );

  const [viewMode, setViewMode] = useState<ViewMode>(initialRoute.viewMode);
  const [authMode, setAuthMode] = useState<AuthMode>(initialRoute.authMode);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialRoute.activeTab);
  const [pendingTab, setPendingTab] = useState<WorkspaceTab | null>(
    initialRoute.viewMode === 'workspace' ? initialRoute.activeTab : null
  );
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [pendingResearchImport, setPendingResearchImport] =
    useState<PendingResearchImport | null>(null);
  const [globalIntelSearch, setGlobalIntelSearch] = useState<string | undefined>(undefined);

  const syncUrl = useCallback(
    (nextView: ViewMode, nextAuth: AuthMode, nextTab: WorkspaceTab, replace = false) => {
      if (typeof window === 'undefined') return;
      const targetPath = buildRoutePath(nextView, nextAuth, nextTab);
      if (window.location.pathname !== targetPath) {
        if (replace) {
          window.history.replaceState(null, '', targetPath);
        } else {
          window.history.pushState(null, '', targetPath);
        }
      }
    },
    []
  );

  const navigateToLanding = useCallback(
    (replace = false) => {
      setViewMode('landing');
      syncUrl('landing', authMode, activeTab, replace);
    },
    [authMode, activeTab, syncUrl]
  );

  const navigateToAuth = useCallback(
    (mode: AuthMode = 'login', targetTab: WorkspaceTab = 'dashboard', replace = false) => {
      setAuthMode(mode);
      setPendingTab(targetTab);
      setViewMode('auth');
      syncUrl('auth', mode, targetTab, replace);
    },
    [syncUrl]
  );

  const navigateToWorkspaceTab = useCallback(
    (tab: WorkspaceTab, replace = false) => {
      setActiveTab(tab);
      setViewMode('workspace');
      syncUrl('workspace', authMode, tab, replace);
    },
    [authMode, syncUrl]
  );

  // Sync browser Back / Forward buttons
  useEffect(() => {
    const onPopState = () => {
      const parsed = parsePathRoute(window.location.pathname);
      setViewMode(parsed.viewMode);
      setAuthMode(parsed.authMode);
      setActiveTab(parsed.activeTab);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const {
    projects,
    drafts,
    reports,
    academyProgress,
    chatMessages,
    researchReports,
    activities,
    phConnection,
    launchSchedules,
    savedIntelligence,
    dataLoading,
    createProject,
    updateProject,
    deleteProject,
    saveLaunchDraft,
    updateLaunchDraft,
    deleteLaunchDraft,
    saveAnalysisReport,
    deleteAnalysisReport,
    toggleAcademyLesson,
    toggleAcademyChecklist,
    appendChatTurn,
    clearChatHistoryForProject,
    saveCompetitorResearch,
    deleteCompetitorResearch,
    syncPhConnectionStatus,
    createLaunchSchedule,
    updateLaunchSchedule,
    deleteLaunchSchedule,
    saveIntelligenceItem,
    deleteIntelligenceItem,
  } = useWorkspaceData(user?.uid, user?.emailVerified);

  // Auto-route verified users into workspace when coming from AuthPage & guard /app/* when logged out
  useEffect(() => {
    if (!authReady) return;
    if (isVerifiedAuthenticated && viewMode === 'auth') {
      const target = pendingTab || 'dashboard';
      setPendingTab(null);
      navigateToWorkspaceTab(target, true);
    } else if (!user && viewMode === 'workspace') {
      navigateToAuth('login', activeTab, true);
    }
  }, [
    authReady,
    isVerifiedAuthenticated,
    user,
    viewMode,
    pendingTab,
    activeTab,
    navigateToWorkspaceTab,
    navigateToAuth,
  ]);

  // Keep activeProjectId synced with available projects
  useEffect(() => {
    if (projects.length > 0 && !projects.some((p) => p.id === activeProjectId)) {
      setActiveProjectId(projects[0].id);
    } else if (projects.length === 0 && activeProjectId) {
      setActiveProjectId('');
    }
  }, [projects, activeProjectId]);

  if (!resolvedFirebaseStatus.configured) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center justify-center p-6">
        <div className="mb-6">
          <HuntPilotLogo />
        </div>
        <div className="max-w-lg w-full bg-white border border-[#FECACA] rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2.5 text-[#DC2626] font-bold text-base">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            Firebase Configuration Required
          </div>
          <p className="text-sm text-[#555555] leading-relaxed">
            {resolvedFirebaseStatus.error ||
              'HuntPilot AI cannot initialize authentication or workspace storage because Firebase configuration is missing.'}
          </p>
          <p className="text-xs text-[#777777]">
            Update{' '}
            <code className="font-mono bg-[#F3F3F3] px-1.5 py-0.5 rounded text-[#202020]">
              firebase-applet-config.json
            </code>{' '}
            with a valid Firebase Web App config and reload the application.
          </p>
        </div>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center justify-center gap-3 p-6">
        <HuntPilotLogo />
        <p className="text-xs font-medium text-[#777777]">Loading your launch workspace...</p>
      </div>
    );
  }

  // Protected route guard: if user signed in via email/password and hasn't verified yet, show verification screen
  if (user && !user.emailVerified && (viewMode === 'auth' || viewMode === 'workspace')) {
    return <AuthPage initialMode="login" onBack={() => navigateToLanding()} />;
  }

  if (viewMode === 'auth' && !isVerifiedAuthenticated) {
    return <AuthPage initialMode={authMode} onBack={() => navigateToLanding()} />;
  }

  if (viewMode === 'workspace' && isVerifiedAuthenticated) {
    return (
      <AppShell
        profile={profile}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
        activeTab={activeTab}
        onSelectTab={(tab) => navigateToWorkspaceTab(tab)}
        onBackToLanding={() => navigateToLanding()}
        onGlobalSearch={(q) => {
          setGlobalIntelSearch(q);
          navigateToWorkspaceTab('intelligence');
        }}
        onSignOut={async () => {
          navigateToLanding(true);
          await signOutUser();
        }}
      >
        {activeTab === 'dashboard' && (
          <DashboardView
            profile={profile}
            projects={projects}
            drafts={drafts}
            reports={reports}
            activities={activities}
            activeProjectId={activeProjectId}
            onSelectProject={setActiveProjectId}
            onNavigateTab={(tab) => navigateToWorkspaceTab(tab)}
            onCreateProject={createProject}
            onUpdateProject={updateProject}
            onDeleteProject={deleteProject}
            onDeleteReport={deleteAnalysisReport}
            onOpenReport={(report) => {
              setActiveProjectId(report.projectId);
              setSelectedReportId(report.id);
              navigateToWorkspaceTab('analyzer');
            }}
            academyProgress={academyProgress}
            mcp={mcp}
            phConnection={phConnection}
            launchSchedules={launchSchedules}
            dataLoading={dataLoading}
          />
        )}

        {activeTab === 'academy' && (
          <AcademyView
            progress={academyProgress}
            activeProject={projects.find((p) => p.id === activeProjectId) || projects[0] || null}
            onToggleLesson={toggleAcademyLesson}
            onToggleChecklist={toggleAcademyChecklist}
          />
        )}

        {activeTab === 'generator' && (
          <DraftGeneratorView
            projects={projects}
            activeProjectId={activeProjectId}
            drafts={drafts}
            onSaveDraft={saveLaunchDraft}
            onUpdateDraft={updateLaunchDraft}
            onDeleteDraft={deleteLaunchDraft}
            onCreateProjectQuick={createProject}
            launchSchedules={launchSchedules}
            onCreateLaunchSchedule={createLaunchSchedule}
            onUpdateLaunchSchedule={updateLaunchSchedule}
            onDeleteLaunchSchedule={deleteLaunchSchedule}
            mcp={mcp}
          />
        )}

        {activeTab === 'analyzer' && (
          <LaunchAnalyzerView
            projects={projects}
            drafts={drafts}
            reports={reports}
            activeProjectId={activeProjectId}
            selectedReportId={selectedReportId}
            onSaveReport={saveAnalysisReport}
            onDeleteReport={deleteAnalysisReport}
            onCreateProjectQuick={createProject}
            researchReports={researchReports}
            pendingResearchImport={pendingResearchImport}
            onClearPendingResearchImport={() => setPendingResearchImport(null)}
            mcp={mcp}
          />
        )}

        {activeTab === 'assistant' && (
          <AssistantView
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={setActiveProjectId}
            messages={chatMessages}
            onAppendTurn={appendChatTurn}
            onClearHistory={clearChatHistoryForProject}
            drafts={drafts}
            reports={reports}
            researchReports={researchReports}
            academyProgress={academyProgress}
            mcp={mcp}
          />
        )}

        {activeTab === 'research' && (
          <ResearchView
            projects={projects}
            activeProjectId={activeProjectId}
            researchReports={researchReports}
            onSaveResearch={saveCompetitorResearch}
            onDeleteResearch={deleteCompetitorResearch}
            onSendBriefToAnalyzer={(brief) => {
              setPendingResearchImport(brief);
              navigateToWorkspaceTab('analyzer');
            }}
            mcp={mcp}
          />
        )}

        {activeTab === 'intelligence' && (
          <IntelligenceView
            savedIntelligence={savedIntelligence}
            onSaveIntelligence={saveIntelligenceItem}
            onDeleteIntelligence={deleteIntelligenceItem}
            externalSearchQuery={globalIntelSearch}
            onConsumeExternalSearch={() => setGlobalIntelSearch(undefined)}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView mcp={mcp} onSyncPhConnection={syncPhConnectionStatus} />
        )}
      </AppShell>
    );
  }

  return (
    <LandingPage
      isAuthenticated={isVerifiedAuthenticated}
      onNavigateAuth={(mode = 'login', targetTab = 'dashboard') => {
        navigateToAuth(mode, targetTab);
      }}
      onNavigateWorkspace={(tab) => {
        if (!isVerifiedAuthenticated) {
          navigateToAuth('login', tab);
          return;
        }
        navigateToWorkspaceTab(tab);
      }}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <HuntPilotApp />
        </AuthProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
