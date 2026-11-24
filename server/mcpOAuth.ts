import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', '.data');
const OAUTH_STORE_FILE = path.join(DATA_DIR, 'ph-oauth-sessions.enc.json');

export const OFFICIAL_PRODUCT_HUNT_MCP_URL = 'https://mcp.producthunt.com/mcp';
const DEFAULT_RESOURCE_METADATA_URL =
  'https://mcp.producthunt.com/.well-known/oauth-protected-resource';
const DEFAULT_AUTH_SERVER_METADATA_URL =
  'https://www.producthunt.com/.well-known/oauth-authorization-server/mcp/oauth';

export const DEFAULT_PH_SCOPES = [
  'mcp:account',
  'launches:read',
  'launches:write',
] as const;

export interface OAuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint?: string;
  registration_endpoint?: string;
  client_id_metadata_document_supported?: boolean;
  scopes_supported?: string[];
  code_challenge_methods_supported?: string[];
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

export interface UserOAuthSession {
  uid: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope: string;
  clientId: string;
  clientSecret?: string;
  registrationMethod: 'env' | 'dcr' | 'cimd';
  connectedAt: string;
  lastSuccessAt: string;
  account: ProductHuntAccountInfo | null;
}

interface PendingAuthState {
  uid: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret?: string;
  registrationMethod: 'env' | 'dcr' | 'cimd';
  scope: string;
  createdAt: number;
}

interface CachedRegisteredClient {
  clientId: string;
  clientSecret?: string;
  registrationMethod: 'env' | 'dcr' | 'cimd';
}

export interface OAuthPersistenceStatus {
  persistent: boolean;
  mode: 'encrypted_file' | 'memory_only';
  notice: string;
}

// Strict server-side stores (tokens & client secrets never leave the server)
const userSessions = new Map<string, UserOAuthSession>();
const userAuthErrors = new Map<string, string>();
const pendingStates = new Map<string, PendingAuthState>();
const registeredClientsByRedirect = new Map<string, CachedRegisteredClient>();

let cachedMetadata: { data: OAuthServerMetadata; fetchedAt: number } | null = null;
let storeLoaded = false;

function getEncryptionKey(): Buffer | null {
  const secret = process.env.OAUTH_STORAGE_SECRET?.trim();
  if (!secret || secret.length < 16) {
    return null;
  }
  return crypto.scryptSync(secret, 'huntpilot-ph-oauth-v1', 32);
}

export function getOAuthPersistenceStatus(): OAuthPersistenceStatus {
  const secret = process.env.OAUTH_STORAGE_SECRET?.trim();
  if (secret && secret.length >= 16) {
    return {
      persistent: true,
      mode: 'encrypted_file',
      notice:
        'OAuth tokens are encrypted with AES-256-GCM on local server storage (survive restarts on persistent disk, reset on fresh container deploys).',
    };
  }
  return {
    persistent: false,
    mode: 'memory_only',
    notice:
      'OAuth sessions are held in server memory only and reset on server restart. Set OAUTH_STORAGE_SECRET (16+ chars) to enable encrypted server-side persistence.',
  };
}

function ensureOAuthStoreLoaded(): void {
  if (storeLoaded) return;
  storeLoaded = true;
  const key = getEncryptionKey();
  if (!key || !fs.existsSync(OAUTH_STORE_FILE)) return;

  try {
    const raw = fs.readFileSync(OAUTH_STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as {
      iv?: string;
      tag?: string;
      ciphertext?: string;
    };
    if (!parsed.iv || !parsed.tag || !parsed.ciphertext) return;

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(parsed.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf-8');

    const payload = JSON.parse(decrypted) as {
      sessions?: Array<[string, UserOAuthSession]>;
      pending?: Array<[string, PendingAuthState]>;
      clients?: Array<[string, CachedRegisteredClient]>;
    };

    userSessions.clear();
    pendingStates.clear();
    registeredClientsByRedirect.clear();

    for (const [k, v] of payload.sessions || []) {
      userSessions.set(k, v);
    }
    const now = Date.now();
    for (const [k, v] of payload.pending || []) {
      if (now - v.createdAt <= 10 * 60 * 1000) {
        pendingStates.set(k, v);
      }
    }
    for (const [k, v] of payload.clients || []) {
      registeredClientsByRedirect.set(k, v);
    }
  } catch {
    // Do not crash on unreadable or rotated encrypted OAuth state; start fresh
  }
}

export function reloadOAuthStoreForTest(): void {
  storeLoaded = false;
  userSessions.clear();
  pendingStates.clear();
  registeredClientsByRedirect.clear();
  ensureOAuthStoreLoaded();
}

function persistOAuthStore(): void {
  const key = getEncryptionKey();
  if (!key) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const serialized = JSON.stringify({
      sessions: Array.from(userSessions.entries()),
      pending: Array.from(pendingStates.entries()),
      clients: Array.from(registeredClientsByRedirect.entries()),
    });
    const ciphertext = Buffer.concat([cipher.update(serialized, 'utf-8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const tmpFile = `${OAUTH_STORE_FILE}.tmp`;
    fs.writeFileSync(
      tmpFile,
      JSON.stringify({
        v: 1,
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        ciphertext: ciphertext.toString('base64'),
      }),
      { encoding: 'utf-8', mode: 0o600 }
    );
    fs.renameSync(tmpFile, OAUTH_STORE_FILE);
  } catch {
    // Best-effort encrypted persistence
  }
}

export function isPrivateOrMetadataHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host === '169.254.169.254' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

export function validateExternalHttpsUrl(rawUrl: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${label} is not a valid URL.`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${label} must use https:.`);
  }
  if (isPrivateOrMetadataHost(parsed.hostname)) {
    throw new Error(`${label} cannot point to a private or loopback host.`);
  }
  return parsed.toString();
}

export function getOfficialMcpEndpoint(): string {
  const configured = process.env.PRODUCT_HUNT_MCP_URL?.trim();
  if (!configured) return OFFICIAL_PRODUCT_HUNT_MCP_URL;
  return validateExternalHttpsUrl(configured, 'PRODUCT_HUNT_MCP_URL');
}

export async function getProductHuntOAuthMetadata(): Promise<OAuthServerMetadata> {
  if (cachedMetadata && Date.now() - cachedMetadata.fetchedAt < 30 * 60 * 1000) {
    return cachedMetadata.data;
  }

  let authServerBase = 'https://www.producthunt.com/mcp/oauth';
  try {
    const res = await fetch(DEFAULT_RESOURCE_METADATA_URL, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const resourceJson = (await res.json()) as {
        authorization_servers?: string[];
      };
      if (
        Array.isArray(resourceJson.authorization_servers) &&
        typeof resourceJson.authorization_servers[0] === 'string'
      ) {
        authServerBase = validateExternalHttpsUrl(
          resourceJson.authorization_servers[0],
          'authorization_servers[0]'
        );
      }
    }
  } catch {
    // Use official default auth server base
  }

  const authUrl = new URL(authServerBase);
  const pathSuffix = authUrl.pathname.replace(/\/+$/, '');
  const discoveryCandidates = [
    `${authUrl.origin}/.well-known/oauth-authorization-server${pathSuffix}`,
    DEFAULT_AUTH_SERVER_METADATA_URL,
  ];

  for (const candidate of discoveryCandidates) {
    try {
      const res = await fetch(candidate, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const meta = (await res.json()) as OAuthServerMetadata;
      if (meta.authorization_endpoint && meta.token_endpoint) {
        const validated: OAuthServerMetadata = {
          issuer: meta.issuer || authServerBase,
          authorization_endpoint: validateExternalHttpsUrl(
            meta.authorization_endpoint,
            'authorization_endpoint'
          ),
          token_endpoint: validateExternalHttpsUrl(meta.token_endpoint, 'token_endpoint'),
          revocation_endpoint: meta.revocation_endpoint
            ? validateExternalHttpsUrl(meta.revocation_endpoint, 'revocation_endpoint')
            : undefined,
          registration_endpoint: meta.registration_endpoint
            ? validateExternalHttpsUrl(meta.registration_endpoint, 'registration_endpoint')
            : undefined,
          client_id_metadata_document_supported: Boolean(
            meta.client_id_metadata_document_supported
          ),
          scopes_supported: Array.isArray(meta.scopes_supported)
            ? meta.scopes_supported
            : [...DEFAULT_PH_SCOPES],
          code_challenge_methods_supported: Array.isArray(meta.code_challenge_methods_supported)
            ? meta.code_challenge_methods_supported
            : ['S256'],
        };
        cachedMetadata = { data: validated, fetchedAt: Date.now() };
        return validated;
      }
    } catch {
      // Try next discovery URL
    }
  }

  const fallback: OAuthServerMetadata = {
    issuer: 'https://www.producthunt.com/mcp/oauth',
    authorization_endpoint: 'https://www.producthunt.com/mcp/oauth/authorize',
    token_endpoint: 'https://www.producthunt.com/mcp/oauth/token',
    revocation_endpoint: 'https://www.producthunt.com/mcp/oauth/revoke',
    registration_endpoint: 'https://www.producthunt.com/mcp/oauth/register',
    client_id_metadata_document_supported: true,
    scopes_supported: ['mcp:account', 'launches:read', 'launches:write', 'ads:read', 'ads:write'],
    code_challenge_methods_supported: ['S256'],
  };
  cachedMetadata = { data: fallback, fetchedAt: Date.now() };
  return fallback;
}

async function resolveOAuthClient(
  redirectUri: string,
  appBaseUrl: string,
  meta: OAuthServerMetadata
): Promise<CachedRegisteredClient> {
  const envClientId = process.env.PRODUCT_HUNT_OAUTH_CLIENT_ID?.trim();
  const envClientSecret = process.env.PRODUCT_HUNT_OAUTH_CLIENT_SECRET?.trim();
  if (envClientId) {
    return {
      clientId: envClientId,
      clientSecret: envClientSecret || undefined,
      registrationMethod: 'env',
    };
  }

  ensureOAuthStoreLoaded();
  const cached = registeredClientsByRedirect.get(redirectUri);
  if (cached) {
    return cached;
  }

  // Prefer Dynamic Client Registration (RFC 7591) when supported
  if (meta.registration_endpoint) {
    try {
      const regRes = await fetch(meta.registration_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_name: 'HuntPilot AI',
          client_uri: appBaseUrl,
          redirect_uris: [redirectUri],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none',
          scope: DEFAULT_PH_SCOPES.join(' '),
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (regRes.ok) {
        const regJson = (await regRes.json()) as {
          client_id?: string;
          client_secret?: string;
        };
        if (regJson.client_id) {
          const entry: CachedRegisteredClient = {
            clientId: regJson.client_id,
            clientSecret: regJson.client_secret,
            registrationMethod: 'dcr',
          };
          registeredClientsByRedirect.set(redirectUri, entry);
          persistOAuthStore();
          return entry;
        }
      }
    } catch {
      // Fall back to Client ID Metadata Document if supported
    }
  }

  if (meta.client_id_metadata_document_supported) {
    const cimdUrl = `${appBaseUrl.replace(/\/+$/, '')}/api/mcp/oauth/client-metadata.json`;
    const entry: CachedRegisteredClient = {
      clientId: cimdUrl,
      registrationMethod: 'cimd',
    };
    registeredClientsByRedirect.set(redirectUri, entry);
    persistOAuthStore();
    return entry;
  }

  throw new Error(
    'Unable to register Product Hunt OAuth client automatically. Configure PRODUCT_HUNT_OAUTH_CLIENT_ID in server secrets.'
  );
}

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function cleanupExpiredPendingStates() {
  const now = Date.now();
  for (const [key, item] of pendingStates.entries()) {
    if (now - item.createdAt > 10 * 60 * 1000) {
      pendingStates.delete(key);
    }
  }
}

export async function startProductHuntOAuth(
  uid: string,
  appBaseUrl: string
): Promise<{
  authUrl: string;
  redirectUri: string;
  registrationMethod: 'env' | 'dcr' | 'cimd';
}> {
  ensureOAuthStoreLoaded();
  cleanupExpiredPendingStates();
  const meta = await getProductHuntOAuthMetadata();
  const cleanBase = appBaseUrl.replace(/\/+$/, '');
  const redirectUri = `${cleanBase}/api/mcp/oauth/callback`;
  const parsedRedirect = new URL(redirectUri);
  if (parsedRedirect.protocol !== 'https:' && parsedRedirect.protocol !== 'http:') {
    throw new Error('Invalid application base URL for OAuth redirect.');
  }
  const client = await resolveOAuthClient(redirectUri, cleanBase, meta);

  const codeVerifier = toBase64Url(crypto.randomBytes(48));
  const codeChallenge = toBase64Url(crypto.createHash('sha256').update(codeVerifier).digest());
  const state = toBase64Url(crypto.randomBytes(24));
  const scope = DEFAULT_PH_SCOPES.join(' ');

  pendingStates.set(state, {
    uid,
    codeVerifier,
    redirectUri,
    clientId: client.clientId,
    clientSecret: client.clientSecret,
    registrationMethod: client.registrationMethod,
    scope,
    createdAt: Date.now(),
  });
  persistOAuthStore();

  userAuthErrors.delete(uid);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: client.clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    scope,
    resource: getOfficialMcpEndpoint(),
  });

  return {
    authUrl: `${meta.authorization_endpoint}?${params.toString()}`,
    redirectUri,
    registrationMethod: client.registrationMethod,
  };
}

export async function completeProductHuntOAuthCallback(params: {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}): Promise<{
  ok: boolean;
  uid?: string;
  error?: string;
}> {
  ensureOAuthStoreLoaded();
  const state = params.state?.trim() || '';
  const pending = pendingStates.get(state);
  if (!state || !pending || Date.now() - pending.createdAt > 10 * 60 * 1000) {
    if (state) {
      pendingStates.delete(state);
      persistOAuthStore();
    }
    return {
      ok: false,
      error: 'OAuth state is missing or expired. Please click Connect Product Hunt again.',
    };
  }
  pendingStates.delete(state);
  persistOAuthStore();

  if (params.error) {
    const msg = params.errorDescription || `Product Hunt authorization failed (${params.error}).`;
    userAuthErrors.set(pending.uid, msg);
    return { ok: false, uid: pending.uid, error: msg };
  }

  const code = params.code?.trim();
  if (!code) {
    const msg = 'Product Hunt did not return an authorization code.';
    userAuthErrors.set(pending.uid, msg);
    return { ok: false, uid: pending.uid, error: msg };
  }

  try {
    const meta = await getProductHuntOAuthMetadata();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: pending.redirectUri,
      client_id: pending.clientId,
      code_verifier: pending.codeVerifier,
      resource: getOfficialMcpEndpoint(),
    });
    if (pending.clientSecret) {
      body.set('client_secret', pending.clientSecret);
    }

    const tokenRes = await fetch(meta.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(12000),
    });

    const tokenText = await tokenRes.text();
    let tokenJson: Record<string, unknown> = {};
    try {
      tokenJson = JSON.parse(tokenText) as Record<string, unknown>;
    } catch {
      throw new Error(`Unexpected OAuth token response (HTTP ${tokenRes.status}).`);
    }

    if (!tokenRes.ok || typeof tokenJson.access_token !== 'string') {
      const errDesc =
        (typeof tokenJson.error_description === 'string' && tokenJson.error_description) ||
        (typeof tokenJson.error === 'string' && tokenJson.error) ||
        `Token exchange failed (HTTP ${tokenRes.status}).`;
      throw new Error(errDesc);
    }

    const expiresIn =
      typeof tokenJson.expires_in === 'number' && tokenJson.expires_in > 0
        ? tokenJson.expires_in
        : 3600;
    const nowIso = new Date().toISOString();

    const session: UserOAuthSession = {
      uid: pending.uid,
      accessToken: tokenJson.access_token,
      refreshToken:
        typeof tokenJson.refresh_token === 'string' ? tokenJson.refresh_token : undefined,
      expiresAt: Date.now() + expiresIn * 1000,
      scope: typeof tokenJson.scope === 'string' ? tokenJson.scope : pending.scope,
      clientId: pending.clientId,
      clientSecret: pending.clientSecret,
      registrationMethod: pending.registrationMethod,
      connectedAt: nowIso,
      lastSuccessAt: nowIso,
      account: null,
    };

    userSessions.set(pending.uid, session);
    userAuthErrors.delete(pending.uid);
    persistOAuthStore();

    return { ok: true, uid: pending.uid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OAuth token exchange failed.';
    userAuthErrors.set(pending.uid, msg);
    return { ok: false, uid: pending.uid, error: msg };
  }
}

export async function refreshUserOAuthToken(uid: string): Promise<string | null> {
  ensureOAuthStoreLoaded();
  const session = userSessions.get(uid);
  if (!session) return null;

  if (!session.refreshToken) {
    userSessions.delete(uid);
    persistOAuthStore();
    userAuthErrors.set(uid, 'Product Hunt session expired. Please reconnect your account.');
    return null;
  }

  try {
    const meta = await getProductHuntOAuthMetadata();
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
      client_id: session.clientId,
      resource: getOfficialMcpEndpoint(),
    });
    if (session.clientSecret) {
      body.set('client_secret', session.clientSecret);
    }

    const res = await fetch(meta.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(12000),
    });

    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok || typeof json.access_token !== 'string') {
      throw new Error(
        (typeof json.error_description === 'string' && json.error_description) ||
          'Token refresh rejected.'
      );
    }

    const expiresIn =
      typeof json.expires_in === 'number' && json.expires_in > 0 ? json.expires_in : 3600;
    session.accessToken = json.access_token;
    if (typeof json.refresh_token === 'string') {
      session.refreshToken = json.refresh_token;
    }
    session.expiresAt = Date.now() + expiresIn * 1000;
    session.lastSuccessAt = new Date().toISOString();
    userAuthErrors.delete(uid);
    persistOAuthStore();
    return session.accessToken;
  } catch (err) {
    userSessions.delete(uid);
    persistOAuthStore();
    userAuthErrors.set(
      uid,
      err instanceof Error ? err.message : 'Product Hunt OAuth refresh failed. Please reconnect.'
    );
    return null;
  }
}

export async function getValidUserAccessToken(uid: string): Promise<string | null> {
  ensureOAuthStoreLoaded();
  const session = userSessions.get(uid);
  if (!session) return null;
  if (session.expiresAt && Date.now() > session.expiresAt - 60_000) {
    return refreshUserOAuthToken(uid);
  }
  return session.accessToken;
}

export function getUserOAuthSession(uid: string): UserOAuthSession | null {
  ensureOAuthStoreLoaded();
  return userSessions.get(uid) || null;
}

export function setUserOAuthAccount(uid: string, account: ProductHuntAccountInfo | null): void {
  ensureOAuthStoreLoaded();
  const session = userSessions.get(uid);
  if (session) {
    session.account = account;
    session.lastSuccessAt = new Date().toISOString();
    persistOAuthStore();
  }
}

export function markUserOAuthSuccess(uid: string): void {
  ensureOAuthStoreLoaded();
  const session = userSessions.get(uid);
  if (session) {
    session.lastSuccessAt = new Date().toISOString();
    persistOAuthStore();
  }
}

export function getUserOAuthError(uid: string): string | null {
  return userAuthErrors.get(uid) || null;
}

export function setUserOAuthError(uid: string, message: string | null): void {
  if (message) {
    userAuthErrors.set(uid, message);
  } else {
    userAuthErrors.delete(uid);
  }
}

export async function disconnectUserOAuth(uid: string): Promise<void> {
  ensureOAuthStoreLoaded();
  const session = userSessions.get(uid);
  userSessions.delete(uid);
  userAuthErrors.delete(uid);
  persistOAuthStore();

  if (!session) return;

  try {
    const meta = await getProductHuntOAuthMetadata();
    if (meta.revocation_endpoint) {
      const body = new URLSearchParams({
        token: session.accessToken,
        client_id: session.clientId,
      });
      await fetch(meta.revocation_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(5000),
      });
    }
  } catch {
    // Best-effort revocation; local session is already cleared
  }
}
