import { useCallback, useEffect, useRef, useState } from 'react';
import { authorizedFetch } from '../utils/validation';

export interface McpToolDefinition {
  name: string;
  title?: string;
  description?: string;
  requiresAuth: boolean;
  scopes: string[];
  inputSchema?: Record<string, unknown>;
}

export interface ProductHuntAccountInfo {
  id?: string;
  username?: string;
  name?: string;
  headline?: string;
  url?: string;
  avatarUrl?: string;
  raw?: Record<string, unknown>;
}

export interface McpStatus {
  configured: boolean;
  connected: boolean;
  serverReachable: boolean;
  accountConnected: boolean;
  endpointHost: string | null;
  endpointUrl: string;
  transport: 'Streamable HTTP';
  serverInfo: { name: string; version: string } | null;
  account: ProductHuntAccountInfo | null;
  scopes: string[];
  registrationMethod?: 'env' | 'dcr' | 'cimd' | null;
  tools: McpToolDefinition[];
  lastCheckedAt: string | null;
  lastConnectedAt: string | null;
  error: string | null;
  sessionPersistence?: {
    persistent: boolean;
    mode: 'firestore_encrypted' | 'encrypted_file' | 'memory_only';
    notice: string;
  };
}

export interface UseProductHuntMcpResult {
  mcpStatus: McpStatus | null;
  loadingStatus: boolean;
  connecting: boolean;
  testing: boolean;
  disconnecting: boolean;
  mcpActionError: string | null;
  mcpActionNotice: string | null;
  clearNotices: () => void;
  refreshStatus: () => Promise<McpStatus | null>;
  testConnection: () => Promise<McpStatus | null>;
  connectProductHunt: () => Promise<void>;
  disconnectProductHunt: () => Promise<void>;
}

function isTrustedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (typeof window !== 'undefined' && origin === window.location.origin) {
    return true;
  }
  return origin.endsWith('.run.app') || origin.startsWith('http://localhost');
}

export function useProductHuntMcp(enabled: boolean): UseProductHuntMcpResult {
  const [mcpStatus, setMcpStatus] = useState<McpStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [mcpActionError, setMcpActionError] = useState<string | null>(null);
  const [mcpActionNotice, setMcpActionNotice] = useState<string | null>(null);
  const popupCheckIntervalRef = useRef<number | null>(null);

  const clearNotices = useCallback(() => {
    setMcpActionError(null);
    setMcpActionNotice(null);
  }, []);

  const refreshStatus = useCallback(async (): Promise<McpStatus | null> => {
    if (!enabled) return null;
    setLoadingStatus(true);
    try {
      const status = await authorizedFetch<McpStatus>('/api/mcp/status');
      setMcpStatus(status);
      return status;
    } catch (err) {
      setMcpActionError(
        err instanceof Error ? err.message : 'Unable to fetch Product Hunt MCP status.'
      );
      return null;
    } finally {
      setLoadingStatus(false);
    }
  }, [enabled]);

  const testConnection = useCallback(async (): Promise<McpStatus | null> => {
    if (!enabled) return null;
    setTesting(true);
    setMcpActionError(null);
    setMcpActionNotice(null);
    try {
      // Verify discovery metadata at official Product Hunt OAuth authorization server endpoints
      try {
        const metaRes = await fetch('https://mcp.producthunt.com/.well-known/oauth-authorization-server', {
          headers: { Accept: 'application/json' },
        });
        if (!metaRes.ok) {
          await fetch('https://www.producthunt.com/.well-known/oauth-authorization-server/mcp/oauth', {
            headers: { Accept: 'application/json' },
          });
        }
      } catch {
        // Non-blocking verification log
      }

      const status = await authorizedFetch<McpStatus>('/api/mcp/test', {
        method: 'POST',
      });
      setMcpStatus(status);
      if (status.serverReachable && status.accountConnected) {
        setMcpActionNotice(
          `Connected to ${status.endpointHost} as ${
            status.account?.name || status.account?.username || 'Product Hunt user'
          }.`
        );
      } else if (status.serverReachable) {
        setMcpActionNotice(
          `MCP server reachable (${status.tools.length} tools discovered). Connect your Product Hunt account for personal draft & launch access.`
        );
      } else if (status.error) {
        setMcpActionError(status.error);
      }
      return status;
    } catch (err) {
      setMcpActionError(err instanceof Error ? err.message : 'Connection test failed.');
      return null;
    } finally {
      setTesting(false);
    }
  }, [enabled]);

  const disconnectProductHunt = useCallback(async () => {
    if (!enabled) return;
    setDisconnecting(true);
    setMcpActionError(null);
    setMcpActionNotice(null);
    try {
      const status = await authorizedFetch<McpStatus>('/api/mcp/oauth/disconnect', {
        method: 'POST',
      });
      setMcpStatus(status);
      setMcpActionNotice('Disconnected your Product Hunt account.');
    } catch (err) {
      setMcpActionError(
        err instanceof Error ? err.message : 'Failed to disconnect Product Hunt account.'
      );
    } finally {
      setDisconnecting(false);
    }
  }, [enabled]);

  const connectProductHunt = useCallback(async () => {
    if (!enabled) return;
    setConnecting(true);
    setMcpActionError(null);
    setMcpActionNotice(null);
    try {
      const data = await authorizedFetch<{ authUrl: string; redirectUri?: string }>(
        '/api/mcp/oauth/start',
        { method: 'POST' }
      );

      if (!data.authUrl || !data.authUrl.startsWith('https://')) {
        throw new Error('Invalid Product Hunt authorization URL returned by server.');
      }

      const popup = window.open(
        data.authUrl,
        'ph_oauth_popup',
        'width=620,height=740,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        setConnecting(false);
        setMcpActionError(
          'Popup was blocked by your browser. Please allow popups for this site and click Connect Product Hunt again.'
        );
        return;
      }

      if (popupCheckIntervalRef.current) {
        window.clearInterval(popupCheckIntervalRef.current);
      }

      popupCheckIntervalRef.current = window.setInterval(() => {
        if (popup.closed) {
          if (popupCheckIntervalRef.current) {
            window.clearInterval(popupCheckIntervalRef.current);
            popupCheckIntervalRef.current = null;
          }
          setConnecting(false);
        }
      }, 600);
    } catch (err) {
      setConnecting(false);
      setMcpActionError(
        err instanceof Error ? err.message : 'Failed to start Product Hunt authorization.'
      );
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setMcpStatus(null);
      return;
    }
    refreshStatus();
  }, [enabled, refreshStatus]);

  useEffect(() => {
    if (!enabled) return;

    const handleMessage = async (event: MessageEvent) => {
      if (!isTrustedOrigin(event.origin)) return;
      const payload = event.data as
        | { type?: string; error?: string; account?: ProductHuntAccountInfo | null }
        | undefined;
      if (!payload || typeof payload !== 'object') return;

      if (payload.type === 'PRODUCT_HUNT_OAUTH_SUCCESS') {
        if (popupCheckIntervalRef.current) {
          window.clearInterval(popupCheckIntervalRef.current);
          popupCheckIntervalRef.current = null;
        }
        setConnecting(false);
        setMcpActionError(null);
        await testConnection();
      } else if (payload.type === 'PRODUCT_HUNT_OAUTH_ERROR') {
        if (popupCheckIntervalRef.current) {
          window.clearInterval(popupCheckIntervalRef.current);
          popupCheckIntervalRef.current = null;
        }
        setConnecting(false);
        setMcpActionError(
          payload.error || 'Product Hunt OAuth authorization was cancelled or failed.'
        );
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (popupCheckIntervalRef.current) {
        window.clearInterval(popupCheckIntervalRef.current);
        popupCheckIntervalRef.current = null;
      }
    };
  }, [enabled, testConnection]);

  return {
    mcpStatus,
    loadingStatus,
    connecting,
    testing,
    disconnecting,
    mcpActionError,
    mcpActionNotice,
    clearNotices,
    refreshStatus,
    testConnection,
    connectProductHunt,
    disconnectProductHunt,
  };
}
