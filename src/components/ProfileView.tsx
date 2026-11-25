import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Link2,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ExperienceLevel } from '../types';
import { UseProductHuntMcpResult } from '../hooks/useProductHuntMcp';
import { PhBanner, PhCard } from './ui/PhPrimitives';

interface ProfileViewProps {
  mcp: UseProductHuntMcpResult;
  onSyncPhConnection?: (info: {
    accountConnected: boolean;
    username?: string | null;
    name?: string | null;
    profileUrl?: string | null;
    lastConnectedAt?: string | null;
  }) => Promise<void>;
}

export function ProfileView({ mcp, onSyncPhConnection }: ProfileViewProps) {
  const { user, profile, updateUserProfile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [role, setRole] = useState(profile?.role || '');
  const [company, setCompany] = useState(profile?.company || '');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    profile?.experienceLevel || 'beginner'
  );
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setRole(profile.role || '');
      setCompany(profile.company || '');
      setExperienceLevel(profile.experienceLevel || 'beginner');
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedNotice(false);
    setSaving(true);
    try {
      await updateUserProfile({
        displayName,
        role,
        company,
        experienceLevel,
      });
      setSavedNotice(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const {
    mcpStatus,
    loadingStatus,
    connecting,
    testing,
    disconnecting,
    mcpActionError,
    mcpActionNotice,
    testConnection,
    connectProductHunt,
    disconnectProductHunt,
  } = mcp;

  const lastSyncedSigRef = useRef<string>('');
  useEffect(() => {
    if (!mcpStatus || !onSyncPhConnection) return;
    const sig = [
      mcpStatus.accountConnected ? '1' : '0',
      mcpStatus.account?.username || '',
      mcpStatus.account?.name || '',
      mcpStatus.account?.url || '',
      mcpStatus.lastConnectedAt || '',
    ].join('|');
    if (sig === lastSyncedSigRef.current) return;
    lastSyncedSigRef.current = sig;
    onSyncPhConnection({
      accountConnected: mcpStatus.accountConnected,
      username: mcpStatus.account?.username || null,
      name: mcpStatus.account?.name || null,
      profileUrl: mcpStatus.account?.url || null,
      lastConnectedAt: mcpStatus.lastConnectedAt || null,
    }).catch(() => {
      // ignore background sync failures
    });
  }, [mcpStatus, onSyncPhConnection]);

  const callbackUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/mcp/oauth/callback` : '';

  const formatDateTime = (iso: string | null | undefined) => {
    if (!iso) return 'Not yet recorded';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const publicToolsCount = mcpStatus?.tools.filter((t) => !t.requiresAuth).length ?? 0;
  const oauthToolsCount = mcpStatus?.tools.filter((t) => t.requiresAuth).length ?? 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-[#202020] tracking-tight">
          Profile, Plan &amp; Integrations
        </h1>
        <p className="text-sm text-[#777777] mt-1">
          Manage your founder profile, experience preference, Product Hunt MCP connection, and subscription tier status.
        </p>
      </div>

      {/* Product Hunt MCP Integration Dashboard */}
      <PhCard className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-[#EAEAEA]">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                mcpStatus?.accountConnected
                  ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A]'
                  : mcpStatus?.serverReachable
                  ? 'bg-[#FFF1F0] border-[#FFD6D2] text-[#FF6154]'
                  : 'bg-[#FFFBEB] border-[#FDE68A] text-[#D97706]'
              }`}
            >
              {mcpStatus?.accountConnected ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <PlugZap className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[#202020]">
                  Product Hunt Integration (Official MCP)
                </h2>
                <span
                  className={`text-xs font-semibold ${
                    mcpStatus?.accountConnected ? 'text-[#16A34A]' : 'text-[#777777]'
                  }`}
                >
                  · {mcpStatus?.accountConnected ? 'Account Connected' : 'Account Disconnected'}
                </span>
              </div>
              <p className="text-xs text-[#555555] mt-1 leading-relaxed">
                Connect your Product Hunt account via OAuth 2.1 (Streamable HTTP) to import drafts, check launch date availability, update drafts, and submit launches safely. Public Product Hunt search and leaderboards work automatically whenever the MCP server is reachable.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={testing || loadingStatus}
              onClick={() => testConnection()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#EAEAEA] bg-white hover:bg-[#F7F7F7] text-xs font-semibold text-[#202020] transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Testing...' : 'Test Connection'}
            </button>

            {mcpStatus?.accountConnected ? (
              <button
                type="button"
                disabled={disconnecting}
                onClick={() => disconnectProductHunt()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] text-xs font-semibold text-[#DC2626] transition-colors cursor-pointer disabled:opacity-60"
              >
                <Unplug className="w-3.5 h-3.5" />
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            ) : (
              <button
                type="button"
                disabled={connecting}
                onClick={() => connectProductHunt()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF6154] hover:bg-[#E54B3E] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
              >
                <Link2 className="w-3.5 h-3.5" />
                {connecting ? 'Authorizing...' : 'Connect Product Hunt'}
              </button>
            )}
          </div>
        </div>

        {(mcpActionError || mcpStatus?.error) && (
          <PhBanner tone="error">{mcpActionError || mcpStatus?.error}</PhBanner>
        )}

        {mcpActionNotice && <PhBanner tone="success">{mcpActionNotice}</PhBanner>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MCP Server Telemetry */}
          <div className="p-4 rounded-xl bg-[#F7F7F7] border border-[#EAEAEA] space-y-2.5 text-xs">
            <p className="font-bold text-[#202020]">MCP Server Status</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#777777]">Endpoint</span>
              <span className="font-mono text-[11px] text-[#202020] truncate">
                {mcpStatus?.endpointUrl || 'https://mcp.producthunt.com/mcp'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#777777]">Transport</span>
              <span className="font-medium text-[#202020]">
                {mcpStatus?.transport || 'Streamable HTTP'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#777777]">Server Reachability</span>
              <span
                className={`font-semibold ${
                  mcpStatus?.serverReachable ? 'text-[#16A34A]' : 'text-[#D97706]'
                }`}
              >
                {loadingStatus
                  ? 'Checking...'
                  : mcpStatus?.serverReachable
                  ? `Online (${mcpStatus.serverInfo?.name || 'Product Hunt MCP'} v${
                      mcpStatus.serverInfo?.version || '1.0'
                    })`
                  : 'Not Verified Yet'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#777777]">Discovered Tools</span>
              <span className="font-mono font-bold text-[#FF6154] tabular-nums">
                {mcpStatus?.tools.length ?? 0} ({publicToolsCount} public · {oauthToolsCount} OAuth)
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#777777]">Last Checked</span>
              <span className="text-[#444444]">{formatDateTime(mcpStatus?.lastCheckedAt)}</span>
            </div>
          </div>

          {/* Connected Account Details */}
          <div className="p-4 rounded-xl bg-[#F7F7F7] border border-[#EAEAEA] space-y-2.5 text-xs">
            <p className="font-bold text-[#202020]">Connected Product Hunt Account</p>
            {mcpStatus?.accountConnected ? (
              <>
                <div className="flex items-center gap-3 pt-1">
                  {mcpStatus.account?.avatarUrl ? (
                    <img
                      src={mcpStatus.account.avatarUrl}
                      alt={mcpStatus.account.name || 'Product Hunt avatar'}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-[#EAEAEA]"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#FFF1F0] border border-[#FFD6D2] text-[#FF6154] font-bold flex items-center justify-center">
                      {(mcpStatus.account?.name || mcpStatus.account?.username || 'PH')[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#202020] truncate">
                      {mcpStatus.account?.name || 'Product Hunt Maker'}
                    </p>
                    <p className="text-xs text-[#777777] truncate">
                      {mcpStatus.account?.username
                        ? `@${mcpStatus.account.username}`
                        : 'OAuth Authorized'}
                    </p>
                  </div>
                  {mcpStatus.account?.url && (
                    <a
                      href={mcpStatus.account.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#FF6154] hover:underline font-semibold shrink-0"
                    >
                      Profile
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                {mcpStatus.account?.headline && (
                  <p className="text-[#555555] leading-relaxed">{mcpStatus.account.headline}</p>
                )}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#EAEAEA]">
                  <span className="text-[#777777]">Last Successful Connection</span>
                  <span className="text-[#444444]">
                    {formatDateTime(mcpStatus.lastConnectedAt)}
                  </span>
                </div>
                {mcpStatus.scopes.length > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#777777]">Authorized Scopes</span>
                    <span className="font-mono text-[11px] text-[#444444] truncate">
                      {mcpStatus.scopes.join(', ')}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2 text-[#555555] leading-relaxed">
                <p>
                  No personal Product Hunt account is connected for this session. Tokens are encrypted server-side and are never exposed to browser storage.
                </p>
                {callbackUrl && (
                  <p className="text-[11px] text-[#777777]">
                    OAuth Callback URL:{' '}
                    <span className="font-mono text-[#444444] break-all">{callbackUrl}</span>
                  </p>
                )}
              </div>
            )}
            {mcpStatus?.sessionPersistence && (
              <div className="pt-2 border-t border-[#EAEAEA] text-[11px] text-[#777777]">
                <span className="font-semibold text-[#202020]">Session Storage: </span>
                {mcpStatus.sessionPersistence.mode === 'firestore_encrypted'
                  ? 'Encrypted Firebase Firestore storage (survives restarts)'
                  : mcpStatus.sessionPersistence.mode === 'encrypted_file'
                  ? 'Encrypted local server storage (survives restarts)'
                  : 'In-memory only (resets on restart)'}
                . {mcpStatus.sessionPersistence.notice}
              </div>
            )}
          </div>
        </div>

        {/* Discovered Tools Accordion */}
        {mcpStatus && mcpStatus.tools.length > 0 && (
          <div className="border border-[#EAEAEA] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTools(!showTools)}
              className="w-full px-4 py-3 bg-[#F7F7F7] hover:bg-[#F3F3F3] flex items-center justify-between text-xs font-bold text-[#202020] transition-colors cursor-pointer"
            >
              <span>Discovered Official MCP Tools ({mcpStatus.tools.length})</span>
              {showTools ? (
                <ChevronUp className="w-4 h-4 text-[#777777]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#777777]" />
              )}
            </button>

            {showTools && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto bg-white">
                {mcpStatus.tools.map((tool) => (
                  <div
                    key={tool.name}
                    className="p-2.5 rounded-lg border border-[#EAEAEA] bg-[#FAFAFA] space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-[#202020] truncate">
                        {tool.name}
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase shrink-0 ${
                          tool.requiresAuth ? 'text-[#FF6154]' : 'text-[#16A34A]'
                        }`}
                      >
                        {tool.requiresAuth ? 'OAuth' : 'Public'}
                      </span>
                    </div>
                    {tool.description && (
                      <p className="text-[11px] text-[#555555] line-clamp-2 leading-snug">
                        {tool.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </PhCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 bg-white border border-[#EAEAEA] rounded-xl p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-[#202020]">Founder Details</h2>

          {error && <PhBanner tone="error">{error}</PhBanner>}
          {savedNotice && <PhBanner tone="success">Profile updated successfully.</PhBanner>}

          <div>
            <label className="block text-xs font-medium text-[#202020] mb-1">Full Name</label>
            <input
              type="text"
              required
              maxLength={120}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-[#EAEAEA] text-sm focus:outline-none focus:border-[#FF6154]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#202020] mb-1">
              Email Address
            </label>
            <div className="flex items-center justify-between px-3.5 py-2 rounded-lg border border-[#EAEAEA] bg-[#F7F7F7] text-sm text-[#555555]">
              <span>{user?.email || profile?.email}</span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A]">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#202020] mb-1">Role</label>
              <input
                type="text"
                maxLength={80}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g., Solo Founder"
                className="w-full px-3.5 py-2 rounded-lg border border-[#EAEAEA] text-sm focus:outline-none focus:border-[#FF6154]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#202020] mb-1">
                Product / Company
              </label>
              <input
                type="text"
                maxLength={120}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g., Acme Labs"
                className="w-full px-3.5 py-2 rounded-lg border border-[#EAEAEA] text-sm focus:outline-none focus:border-[#FF6154]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#202020] mb-1.5">
              Product Hunt Experience Level
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExperienceLevel('beginner')}
                className={`p-3 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                  experienceLevel === 'beginner'
                    ? 'border-[#FF6154] bg-[#FFF1F0] text-[#202020]'
                    : 'border-[#EAEAEA] bg-white text-[#555555] hover:bg-[#F7F7F7]'
                }`}
              >
                <p className="font-bold text-[#202020]">Beginner</p>
                <p className="text-[11px] text-[#777777] mt-0.5">
                  Prioritize Launch Academy &amp; plain-English tips
                </p>
              </button>
              <button
                type="button"
                onClick={() => setExperienceLevel('experienced')}
                className={`p-3 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                  experienceLevel === 'experienced'
                    ? 'border-[#FF6154] bg-[#FFF1F0] text-[#202020]'
                    : 'border-[#EAEAEA] bg-white text-[#555555] hover:bg-[#F7F7F7]'
                }`}
              >
                <p className="font-bold text-[#202020]">Experienced</p>
                <p className="text-[11px] text-[#777777] mt-0.5">
                  Focus on draft optimization &amp; scoring
                </p>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-[#FF6154] hover:bg-[#E54B3E] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        {/* Plan Overview */}
        <PhCard className="lg:col-span-5 space-y-5">
          <div>
            <p className="text-xs font-semibold text-[#FF6154]">Current Plan</p>
            <h2 className="text-xl font-bold text-[#202020] mt-1">Free Plan ($0/mo)</h2>
            <p className="text-xs text-[#777777] mt-1">
              HuntPilot AI is currently in free early access. Paid plans are disabled for now.
            </p>
          </div>

          <ul className="space-y-2.5 text-xs text-[#444444] pt-3 border-t border-[#EAEAEA]">
            {[
              'Full 6-chapter Product Hunt Launch Academy',
              'AI Draft Generator & version comparisons',
              'Estimated Launch Readiness Analyzer',
              'HuntPilot Assistant with live Product Hunt MCP',
              'Official Product Hunt MCP draft & research tools',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#FF6154] shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="pt-4 border-t border-[#EAEAEA] space-y-2">
            <p className="text-xs font-semibold text-[#777777]">Upcoming Tiers (Payments Inactive)</p>
            <div className="p-3 rounded-lg bg-[#F7F7F7] border border-[#EAEAEA] text-xs">
              <p className="font-semibold text-[#202020]">Pro ($29/mo planned)</p>
              <p className="text-[#777777] mt-0.5">
                Expanded AI generations, deep competitor benchmarking, unlimited saved projects.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#F7F7F7] border border-[#EAEAEA] text-xs">
              <p className="font-semibold text-[#202020]">Agency ($99/mo planned)</p>
              <p className="text-[#777777] mt-0.5">
                Multi-client launch workspaces, team collaboration, and exportable client reports.
              </p>
            </div>
          </div>
        </PhCard>
      </div>
    </div>
  );
}
