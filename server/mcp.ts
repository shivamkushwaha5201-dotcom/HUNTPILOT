import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  getOAuthPersistenceStatus,
  getOfficialMcpEndpoint,
  getUserOAuthError,
  getUserOAuthSession,
  getValidUserAccessToken,
  markUserOAuthSuccess,
  refreshUserOAuthToken,
  setUserOAuthAccount,
  setUserOAuthError,
} from './mcpOAuth.ts';
import type { OAuthPersistenceStatus, ProductHuntAccountInfo } from './mcpOAuth.ts';

export interface McpToolDefinition {
  name: string;
  title?: string;
  description?: string;
  requiresAuth: boolean;
  scopes: string[];
  inputSchema?: Record<string, unknown>;
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
  sessionPersistence: OAuthPersistenceStatus;
}

export class McpRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpRateLimitError';
  }
}

export class McpAuthError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'McpAuthError';
    this.code = code;
  }
}

export interface ParsedMcpResult {
  summaryText: string;
  data: Record<string, unknown> | null;
  rawContent: unknown[];
}

interface ActiveClientSession {
  client: Client;
  transport: StreamableHTTPClientTransport;
  tokenUsed: string | null;
  endpointUrl: string;
}

let publicSession: ActiveClientSession | null = null;
const userMcpSessions = new Map<string, ActiveClientSession>();

let cachedTools: McpToolDefinition[] = [];
let cachedServerInfo: { name: string; version: string } | null = null;
let lastCheckedAt: string | null = null;
let lastServerReachable = false;
let lastServerError: string | null = null;

function createTimeoutRateLimitedFetch(accessToken: string | null) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers || {});
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const upstreamSignal = init?.signal;
    const onUpstreamAbort = () => controller.abort();
    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        controller.abort();
      } else {
        upstreamSignal.addEventListener('abort', onUpstreamAbort, { once: true });
      }
    }

    try {
      const res = await fetch(input, {
        ...init,
        headers,
        signal: controller.signal,
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        throw new McpRateLimitError(
          `Product Hunt MCP rate limit reached (HTTP 429)${
            retryAfter ? `. Retry after ${retryAfter} seconds.` : '.'
          }`
        );
      }

      if (res.status === 401) {
        throw new McpAuthError(
          'unauthorized',
          'Product Hunt authorization expired or was revoked. Please reconnect your Product Hunt account.'
        );
      }

      return res;
    } finally {
      clearTimeout(timer);
      if (upstreamSignal) {
        upstreamSignal.removeEventListener('abort', onUpstreamAbort);
      }
    }
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s.`));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function connectMcpSession(accessToken: string | null): Promise<ActiveClientSession> {
  const endpointUrl = getOfficialMcpEndpoint();
  const transport = new StreamableHTTPClientTransport(new URL(endpointUrl), {
    fetch: createTimeoutRateLimitedFetch(accessToken),
  });

  const client = new Client(
    { name: 'HuntPilot-AI', version: '1.0.0' },
    { capabilities: {} }
  );

  await withTimeout(client.connect(transport), 18_000, 'Product Hunt MCP connection');
  const version = client.getServerVersion();
  if (version?.name) {
    cachedServerInfo = { name: version.name, version: version.version || '1.0.0' };
  }

  return {
    client,
    transport,
    tokenUsed: accessToken,
    endpointUrl,
  };
}

async function closeSessionSafely(session: ActiveClientSession | null | undefined) {
  if (!session) return;
  try {
    await session.transport.close();
  } catch {
    // ignore transport close errors
  }
}

export async function resetUserMcpSession(uid: string): Promise<void> {
  const existing = userMcpSessions.get(uid);
  userMcpSessions.delete(uid);
  await closeSessionSafely(existing);
}

async function getOrCreatePublicClient(): Promise<Client> {
  const endpointUrl = getOfficialMcpEndpoint();
  if (publicSession && publicSession.endpointUrl === endpointUrl) {
    return publicSession.client;
  }
  await closeSessionSafely(publicSession);
  publicSession = await connectMcpSession(null);
  return publicSession.client;
}

async function getOrCreateUserClient(uid: string, forceRefresh = false): Promise<{
  client: Client;
  authenticated: boolean;
}> {
  let token = forceRefresh
    ? await refreshUserOAuthToken(uid)
    : await getValidUserAccessToken(uid);

  if (!token) {
    await resetUserMcpSession(uid);
    const pub = await getOrCreatePublicClient();
    return { client: pub, authenticated: false };
  }

  const existing = userMcpSessions.get(uid);
  const endpointUrl = getOfficialMcpEndpoint();
  if (
    !forceRefresh &&
    existing &&
    existing.tokenUsed === token &&
    existing.endpointUrl === endpointUrl
  ) {
    return { client: existing.client, authenticated: true };
  }

  await closeSessionSafely(existing);
  const nextSession = await connectMcpSession(token);
  userMcpSessions.set(uid, nextSession);
  return { client: nextSession.client, authenticated: true };
}

function normalizeTools(rawTools: Array<Record<string, unknown>>): McpToolDefinition[] {
  return rawTools
    .filter((t) => typeof t.name === 'string')
    .map((t) => {
      const meta =
        t._meta && typeof t._meta === 'object' ? (t._meta as Record<string, unknown>) : {};
      const schemes = Array.isArray(t.securitySchemes)
        ? t.securitySchemes
        : Array.isArray(meta.securitySchemes)
        ? meta.securitySchemes
        : [];

      const oauthScopes: string[] = [];
      let requiresAuth = false;
      for (const scheme of schemes) {
        if (scheme && typeof scheme === 'object') {
          const s = scheme as Record<string, unknown>;
          if (s.type === 'oauth2') {
            requiresAuth = true;
            if (Array.isArray(s.scopes)) {
              for (const sc of s.scopes) {
                if (typeof sc === 'string' && !oauthScopes.includes(sc)) {
                  oauthScopes.push(sc);
                }
              }
            }
          }
        }
      }

      return {
        name: String(t.name),
        title: typeof t.title === 'string' ? t.title : undefined,
        description: typeof t.description === 'string' ? t.description : undefined,
        requiresAuth,
        scopes: oauthScopes,
        inputSchema:
          t.inputSchema && typeof t.inputSchema === 'object'
            ? (t.inputSchema as Record<string, unknown>)
            : undefined,
      };
    });
}

export function parseMcpToolResponse(rawResult: unknown): ParsedMcpResult {
  const resultObj =
    rawResult && typeof rawResult === 'object' ? (rawResult as Record<string, unknown>) : {};
  const content = Array.isArray(resultObj.content) ? resultObj.content : [];

  const textParts: string[] = [];
  let structured: Record<string, unknown> | null =
    resultObj.structuredContent && typeof resultObj.structuredContent === 'object'
      ? (resultObj.structuredContent as Record<string, unknown>)
      : null;

  for (const item of content) {
    if (item && typeof item === 'object' && (item as Record<string, unknown>).type === 'text') {
      const text = String((item as Record<string, unknown>).text || '').trim();
      if (!text) continue;
      if (text.startsWith('{') || text.startsWith('[')) {
        try {
          const parsed = JSON.parse(text) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            structured = parsed as Record<string, unknown>;
            continue;
          }
        } catch {
          // keep as human-readable text
        }
      }
      textParts.push(text);
    }
  }

  if (structured && structured.status === 'error') {
    const errObj =
      structured.error && typeof structured.error === 'object'
        ? (structured.error as Record<string, unknown>)
        : {};
    const code = typeof errObj.code === 'string' ? errObj.code : 'mcp_error';
    const message =
      typeof errObj.message === 'string'
        ? errObj.message
        : 'Product Hunt MCP tool returned an error.';

    if (code === 'unauthorized' || code === 'insufficient_scope') {
      throw new McpAuthError(code, message);
    }
    throw new Error(message);
  }

  if (resultObj.isError === true) {
    throw new Error(textParts[0] || 'Product Hunt MCP tool execution failed.');
  }

  const data =
    structured && structured.status === 'ok' && structured.data && typeof structured.data === 'object'
      ? (structured.data as Record<string, unknown>)
      : structured;

  return {
    summaryText: textParts.join('\n\n'),
    data,
    rawContent: content,
  };
}

export async function discoverMcpTools(uid?: string): Promise<McpStatus> {
  lastCheckedAt = new Date().toISOString();
  try {
    const client = uid
      ? (await getOrCreateUserClient(uid)).client
      : await getOrCreatePublicClient();

    const listResult = await withTimeout(client.listTools(), 18_000, 'MCP listTools');
    cachedTools = normalizeTools(
      (listResult.tools || []) as unknown as Array<Record<string, unknown>>
    );
    lastServerReachable = true;
    lastServerError = null;
  } catch (err) {
    if (uid && err instanceof McpAuthError) {
      // User's OAuth token failed, but verify public MCP reachability independently
      setUserOAuthError(uid, err.message);
      try {
        const pubClient = await getOrCreatePublicClient();
        const listResult = await withTimeout(pubClient.listTools(), 18_000, 'MCP public listTools');
        cachedTools = normalizeTools(
          (listResult.tools || []) as unknown as Array<Record<string, unknown>>
        );
        lastServerReachable = true;
        lastServerError = null;
      } catch (pubErr) {
        lastServerReachable = false;
        lastServerError =
          pubErr instanceof Error ? pubErr.message : 'Failed to connect to Product Hunt MCP server.';
      }
    } else {
      lastServerReachable = false;
      lastServerError =
        err instanceof Error ? err.message : 'Failed to connect to Product Hunt MCP server.';
    }
  }

  return getMcpStatusForUser(uid);
}

export async function callMcpToolForUser(
  uid: string | undefined,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<ParsedMcpResult> {
  if (cachedTools.length === 0) {
    await discoverMcpTools(uid);
  }

  const matchedTool = cachedTools.find((t) => t.name === toolName);
  if (!matchedTool) {
    throw new Error(`Tool "${toolName}" was not discovered on the official Product Hunt MCP server.`);
  }

  if (matchedTool.requiresAuth) {
    if (!uid || !getUserOAuthSession(uid)) {
      throw new McpAuthError(
        'unauthorized',
        `Connecting your Product Hunt account is required to run "${toolName}".`
      );
    }
  }

  const executeOnce = async (forceRefresh: boolean) => {
    const { client, authenticated } = uid
      ? await getOrCreateUserClient(uid, forceRefresh)
      : { client: await getOrCreatePublicClient(), authenticated: false };

    if (matchedTool.requiresAuth && !authenticated) {
      throw new McpAuthError(
        'unauthorized',
        `Your Product Hunt session is disconnected or expired. Please reconnect your account.`
      );
    }

    const raw = await withTimeout(
      client.callTool({
        name: matchedTool.name,
        arguments: args,
      }),
      20_000,
      `MCP tool "${matchedTool.name}"`
    );
    const parsed = parseMcpToolResponse(raw);
    if (uid && authenticated) {
      markUserOAuthSuccess(uid);
      setUserOAuthError(uid, null);
    }
    lastServerReachable = true;
    lastServerError = null;
    return parsed;
  };

  try {
    return await executeOnce(false);
  } catch (err) {
    if (err instanceof McpAuthError && uid && getUserOAuthSession(uid)?.refreshToken) {
      try {
        return await executeOnce(true);
      } catch (retryErr) {
        if (retryErr instanceof McpAuthError) {
          setUserOAuthError(uid, retryErr.message);
        }
        throw retryErr;
      }
    }
    if (err instanceof McpAuthError && uid) {
      setUserOAuthError(uid, err.message);
    }
    throw err;
  }
}

export async function fetchAuthenticatedProductHuntAccount(
  uid: string
): Promise<ProductHuntAccountInfo | null> {
  const parsed = await callMcpToolForUser(uid, 'get_my_account', {});
  const data = parsed.data || {};
  const userObj =
    data.user && typeof data.user === 'object'
      ? (data.user as Record<string, unknown>)
      : data;

  const account: ProductHuntAccountInfo = {
    id:
      userObj.id !== undefined && userObj.id !== null
        ? String(userObj.id)
        : undefined,
    username:
      typeof userObj.username === 'string'
        ? userObj.username
        : typeof userObj.handle === 'string'
        ? userObj.handle
        : undefined,
    name:
      typeof userObj.name === 'string'
        ? userObj.name
        : typeof userObj.displayName === 'string'
        ? userObj.displayName
        : undefined,
    headline: typeof userObj.headline === 'string' ? userObj.headline : undefined,
    url: typeof userObj.url === 'string' ? userObj.url : undefined,
    avatarUrl:
      typeof userObj.profileImage === 'string'
        ? userObj.profileImage
        : typeof userObj.avatarUrl === 'string'
        ? userObj.avatarUrl
        : undefined,
    raw: userObj,
  };

  setUserOAuthAccount(uid, account);
  return account;
}

export async function testMcpConnectionForUser(uid: string): Promise<McpStatus> {
  await discoverMcpTools(uid);
  const session = getUserOAuthSession(uid);
  if (session) {
    try {
      await fetchAuthenticatedProductHuntAccount(uid);
      setUserOAuthError(uid, null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Account verification failed.';
      setUserOAuthError(uid, msg);
    }
  }
  return getMcpStatusForUser(uid);
}

export function getMcpStatusForUser(uid?: string): McpStatus {
  const endpointUrl = getOfficialMcpEndpoint();
  let endpointHost: string | null = null;
  try {
    endpointHost = new URL(endpointUrl).host;
  } catch {
    endpointHost = null;
  }

  const session = uid ? getUserOAuthSession(uid) : null;
  const oauthErr = uid ? getUserOAuthError(uid) : null;

  return {
    configured: true,
    connected: lastServerReachable,
    serverReachable: lastServerReachable,
    accountConnected: Boolean(session),
    endpointHost,
    endpointUrl,
    transport: 'Streamable HTTP',
    serverInfo: cachedServerInfo,
    account: session?.account || null,
    scopes: session ? session.scope.split(/\s+/).filter(Boolean) : [],
    registrationMethod: session?.registrationMethod || null,
    tools: cachedTools,
    lastCheckedAt,
    lastConnectedAt: session?.lastSuccessAt || null,
    error: oauthErr || lastServerError,
    sessionPersistence: getOAuthPersistenceStatus(),
  };
}
