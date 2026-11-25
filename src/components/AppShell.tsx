import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BookOpen,
  ChevronRight,
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
import { HuntPilotLogo } from './ui/PhPrimitives';

interface AppShellProps {
  profile: UserProfile | null;
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onBackToLanding: () => void;
  onGlobalSearch?: (query: string) => void;
  onSignOut: () => Promise<void>;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
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
  onGlobalSearch,
  onSignOut,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [topSearch, setTopSearch] = useState('');

  const currentNav = NAV_ITEMS.find((n) => n.id === activeTab) || NAV_ITEMS[0];
  const userInitial = (profile?.displayName?.trim()[0] || profile?.email?.trim()[0] || 'F').toUpperCase();

  const handleNavClick = (tab: WorkspaceTab) => {
    onSelectTab(tab);
    setMobileOpen(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = topSearch.trim();
    if (!cleaned) {
      onSelectTab('intelligence');
      return;
    }
    if (onGlobalSearch) {
      onGlobalSearch(cleaned);
    } else {
      onSelectTab('intelligence');
    }
  };

  const renderNavList = (isMobile = false) => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleNavClick(item.id)}
            className={`relative w-full px-3.5 py-2.5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
              isMobile ? 'min-h-[44px]' : ''
            } ${
              active
                ? 'text-[#FF6154] font-semibold'
                : 'text-[#555555] hover:bg-[#F7F7F7] hover:text-[#202020]'
            }`}
          >
            {active && (
              <motion.span
                layoutId={isMobile ? 'mobile-nav-pill' : 'desktop-nav-pill'}
                transition={{ type: 'spring', stiffness: 460, damping: 35 }}
                className="absolute inset-0 rounded-lg bg-[#FFF1F0] border border-[#FFD6D2]"
              />
            )}
            <Icon
              className={`relative z-10 w-4 h-4 shrink-0 ${
                active ? 'text-[#FF6154]' : 'text-[#777777]'
              }`}
            />
            <span className="relative z-10 truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex text-[#202020]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-[#EAEAEA] z-30">
        <div className="h-16 px-5 flex items-center justify-between border-b border-[#EAEAEA]">
          <button
            type="button"
            onClick={onBackToLanding}
            className="cursor-pointer text-left"
            title="Return to HuntPilot AI overview"
          >
            <HuntPilotLogo size="md" showSubtitle />
          </button>
        </div>

        {renderNavList(false)}

        <div className="p-4 border-t border-[#EAEAEA] space-y-3">
          <button
            type="button"
            onClick={() => handleNavClick('profile')}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#F7F7F7] transition-colors text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-[#FFF1F0] border border-[#FFD6D2] text-[#FF6154] text-xs font-bold flex items-center justify-center shrink-0">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#202020] truncate">
                {profile?.displayName || 'Founder'}
              </p>
              <p className="text-[11px] text-[#777777] truncate">{profile?.email}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] bg-white hover:bg-[#F7F7F7] text-xs font-medium text-[#555555] hover:text-[#202020] flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-64 max-w-[82vw] bg-white h-full flex flex-col border-r border-[#EAEAEA] z-10"
            >
              <div className="h-16 px-5 flex items-center justify-between border-b border-[#EAEAEA]">
                <HuntPilotLogo size="sm" />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#777777] hover:text-[#202020] hover:bg-[#F3F3F3] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {renderNavList(true)}
              <div className="p-4 border-t border-[#EAEAEA]">
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full px-3 py-2.5 min-h-[44px] rounded-lg border border-[#EAEAEA] text-xs font-medium text-[#555555] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Product Hunt-Style Clean Top Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-[#EAEAEA] px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-[#EAEAEA] text-[#555555] hover:text-[#202020] hover:bg-[#F7F7F7] cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-sm min-w-0">
              <span className="text-[#777777] hidden sm:inline">Workspace</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#CCCCCC] hidden sm:inline shrink-0" />
              <span className="font-semibold text-[#202020] truncate">{currentNav.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Functional PH-style Search Box */}
            <form onSubmit={handleSearchSubmit} className="hidden md:block relative">
              <Search className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
                placeholder="Search live launches..."
                aria-label="Search live Product Hunt launches"
                className="w-52 lg:w-64 pl-8 pr-3 py-1.5 rounded-full bg-[#F3F3F3] border border-transparent focus:bg-white focus:border-[#FF6154] text-xs text-[#202020] placeholder:text-[#777777] transition-all focus:outline-none"
              />
            </form>

            {projects.length > 0 && (
              <select
                value={activeProjectId}
                onChange={(e) => onSelectProject(e.target.value)}
                aria-label="Active Project"
                className="max-w-[180px] px-3 py-1.5 rounded-lg border border-[#EAEAEA] bg-white hover:border-[#D4D4D4] text-xs font-semibold text-[#202020] truncate cursor-pointer"
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
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
