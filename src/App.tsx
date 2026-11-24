import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
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
import { WorkspaceTab } from './types';

function HuntPilotApp() {
  const { user, profile, authReady, signOutUser } = useAuth();
  const isVerifiedAuthenticated = Boolean(user && user.emailVerified);
  const mcp = useProductHuntMcp(isVerifiedAuthenticated);

  const [viewMode, setViewMode] = useState<'landing' | 'auth' | 'workspace'>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [pendingTab, setPendingTab] = useState<WorkspaceTab | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [pendingResearchImport, setPendingResearchImport] =
    useState<PendingResearchImport | null>(null);

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

  // Auto-route verified users into workspace when coming from AuthPage
  useEffect(() => {
    if (!authReady) return;
    if (isVerifiedAuthenticated && viewMode === 'auth') {
      if (pendingTab) {
        setActiveTab(pendingTab);
        setPendingTab(null);
      } else {
        setActiveTab('dashboard');
      }
      setViewMode('workspace');
    } else if (!user && viewMode === 'workspace') {
      // Protect dashboard routes if user signed out
      setViewMode('landing');
    }
  }, [authReady, isVerifiedAuthenticated, user, viewMode, pendingTab]);

  // Keep activeProjectId synced with available projects
  useEffect(() => {
    if (projects.length > 0 && !projects.some((p) => p.id === activeProjectId)) {
      setActiveProjectId(projects[0].id);
    } else if (projects.length === 0 && activeProjectId) {
      setActiveProjectId('');
    }
  }, [projects, activeProjectId]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-sm font-medium text-slate-500">Loading HuntPilot AI...</div>
      </div>
    );
  }

  // Protected route guard: if user signed in via email/password and hasn't verified yet, show verification screen
  if (user && !user.emailVerified && (viewMode === 'auth' || viewMode === 'workspace')) {
    return <AuthPage initialMode="login" onBack={() => setViewMode('landing')} />;
  }

  if (viewMode === 'auth' && !isVerifiedAuthenticated) {
    return <AuthPage initialMode={authMode} onBack={() => setViewMode('landing')} />;
  }

  if (viewMode === 'workspace' && isVerifiedAuthenticated) {
    return (
      <AppShell
        profile={profile}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onBackToLanding={() => setViewMode('landing')}
        onSignOut={async () => {
          await signOutUser();
          setViewMode('landing');
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
            onNavigateTab={setActiveTab}
            onCreateProject={createProject}
            onUpdateProject={updateProject}
            onDeleteProject={deleteProject}
            onDeleteReport={deleteAnalysisReport}
            onOpenReport={(report) => {
              setActiveProjectId(report.projectId);
              setSelectedReportId(report.id);
              setActiveTab('analyzer');
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
              setActiveTab('analyzer');
            }}
            mcp={mcp}
          />
        )}

        {activeTab === 'intelligence' && (
          <IntelligenceView
            savedIntelligence={savedIntelligence}
            onSaveIntelligence={saveIntelligenceItem}
            onDeleteIntelligence={deleteIntelligenceItem}
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
        setAuthMode(mode);
        setPendingTab(targetTab);
        setViewMode('auth');
      }}
      onNavigateWorkspace={(tab) => {
        if (!isVerifiedAuthenticated) {
          setAuthMode('login');
          setPendingTab(tab);
          setViewMode('auth');
          return;
        }
        setActiveTab(tab);
        setViewMode('workspace');
      }}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <HuntPilotApp />
      </AuthProvider>
    </ErrorBoundary>
  );
}
