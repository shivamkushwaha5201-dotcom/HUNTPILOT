import React, { useState } from 'react';
import {
  BookOpen,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Sparkles,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { Project, UserProfile, WorkspaceTab } from '../types';

interface AppShellProps {
  profile: UserProfile | null;
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onBackToLanding: () => void;
  onSignOut: () => Promise<void>;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'academy', label: 'Launch Academy', icon: BookOpen },
  { id: 'generator', label: 'Draft Generator', icon: Sparkles },
  { id: 'analyzer', label: 'Launch Analyzer', icon: Gauge },
  { id: 'assistant', label: 'HuntPilot Assistant', icon: MessageSquare },
  { id: 'research', label: 'Competitor Research', icon: Search },
  { id: 'intelligence', label: 'Live Intelligence', icon: TrendingUp },
  { id: 'profile', label: 'Profile & Plan', icon: User },
];

export function AppShell({
  profile,
  projects,
  activeProjectId,
  onSelectProject,
  activeTab,
  onSelectTab,
  onBackToLanding,
  onSignOut,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentNav = NAV_ITEMS.find((n) => n.id === activeTab) || NAV_ITEMS[0];

  const handleNavClick = (tab: WorkspaceTab) => {
    onSelectTab(tab);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200">
          <button
            type="button"
            onClick={onBackToLanding}
            className="text-lg font-bold tracking-tight text-[#0F172A] whitespace-nowrap cursor-pointer"
          >
            HuntPilot AI
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full px-3.5 py-2.5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-violet-50 text-[#6D28D9] font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-[#0F172A]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="px-2">
            <p className="text-xs font-semibold text-[#0F172A] truncate">
              {profile?.displayName || 'Founder'}
            </p>
            <p className="text-[11px] text-slate-500 truncate">{profile?.email}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] bg-white h-full flex flex-col border-r border-slate-200 z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
              <span className="text-base font-bold text-[#0F172A]">HuntPilot AI</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 text-slate-500 hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full px-3.5 py-2.5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-violet-50 text-[#6D28D9] font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-[#0F172A]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onSignOut}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-[#0F172A] cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">Workspace</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-semibold text-[#0F172A] truncate">{currentNav.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {projects.length > 0 && (
              <select
                value={activeProjectId}
                onChange={(e) => onSelectProject(e.target.value)}
                aria-label="Active Project"
                className="max-w-[190px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-[#0F172A] truncate"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-[1280px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
