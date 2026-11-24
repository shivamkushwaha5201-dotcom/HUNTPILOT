import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  generateLaunchDraftWithAI,
  analyzeLaunchWithAI,
  askAssistantWithAI,
  explainAcademyLessonWithAI,
  synthesizeCompetitorResearchWithAI,
} from './server/ai.ts';
import type { AnalyzeMcpContext } from './server/ai.ts';
import {
  callMcpToolForUser,
  discoverMcpTools,
  fetchAuthenticatedProductHuntAccount,
  getMcpStatusForUser,
  McpAuthError,
  McpRateLimitError,
  resetUserMcpSession,
  testMcpConnectionForUser,
} from './server/mcp.ts';
import {
  completeProductHuntOAuthCallback,
  DEFAULT_PH_SCOPES,
  disconnectUserOAuth,
  getOAuthPersistenceStatus,
  startProductHuntOAuth,
} from './server/mcpOAuth.ts';
import {
  captureLeaderboardSnapshot,
  getHunterAnalyticsDetail,
  getHistoricalSnapshots,
  getLeaderboardIntelligence,
  getProductPerformanceDetail,
  isValidPeriodParam,
  startIntelligenceScheduler,
} from './server/intelligence.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load projectId from firebase-applet-config.json for verifyIdToken (needs no IAM)
let firebaseProjectId = '';
try {
  const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { projectId?: string };
    if (raw.projectId && raw.projectId !== 'remixed-project-id' && !raw.projectId.startsWith('YOUR_')) {
      firebaseProjectId = raw.projectId;
    }
  }
} catch {
  firebaseProjectId = '';
}

const adminApp = firebaseProjectId
  ? getApps().length
    ? getApp()
    : initializeApp({ projectId: firebaseProjectId })
  : null;

export type VerifyTokenFn = (
  token: string
) => Promise<{ uid: string; email_verified?: boolean }>;

const defaultVerifyToken: VerifyTokenFn | null = adminApp
  ? async (token: string) => {
      const decoded = await getAuth(adminApp).verifyIdToken(token);
      return { uid: decoded.uid, email_verified: decoded.email_verified };
    }
  : null;

export type AuthedRequest = express.Request & { uid?: string };

export function createRateLimiter(opts: {
  windowMs: number;
  max: number;
  keyPrefix: string;
}): express.RequestHandler {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (req: AuthedRequest, res, next) => {
    const now = Date.now();
    if (buckets.size > 5000) {
      for (const [k, entry] of buckets.entries()) {
        if (entry.resetAt <= now) buckets.delete(k);
      }
    }

    const identity = req.uid ? `u:${req.uid}` : `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    const bucketKey = `${opts.keyPrefix}:${identity}`;
    let entry = buckets.get(bucketKey);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(bucketKey, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, opts.max - entry.count);
    const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    res.setHeader('X-RateLimit-Limit', String(opts.max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > opts.max) {
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'Too many requests. Please wait a moment and try again.',
        code: 'RATE_LIMITED',
      });
      return;
    }

    next();
  };
}

function isAllowedCorsOrigin(origin: string, req: express.Request): boolean {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    const envUrl = process.env.APP_URL?.trim();
    if (envUrl && envUrl !== 'MY_APP_URL') {
      try {
        if (new URL(envUrl).origin === parsed.origin) return true;
      } catch {
        // ignore invalid APP_URL
      }
    }

    const reqHost = (req.get('x-forwarded-host') || req.get('host') || '').toLowerCase();
    if (reqHost && parsed.host.toLowerCase() === reqHost) return true;

    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host.endsWith('.run.app') && parsed.protocol === 'https:') return true;
    if (
      (host === 'aistudio.google.com' || host.endsWith('.aistudio.google.com')) &&
      parsed.protocol === 'https:'
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function buildRequireFirebaseAuth(verifyTokenFn: VerifyTokenFn | null): express.RequestHandler {
  return async (req: AuthedRequest, res, next) => {
    if (!verifyTokenFn) {
      res.status(503).json({ error: 'Firebase project is not configured on the server.' });
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      res.status(401).json({ error: 'Missing authentication token.' });
      return;
    }

    try {
      const decoded = await verifyTokenFn(token);
      if (decoded.email_verified !== true) {
        res.status(403).json({
          error: 'Email verification required. Please verify your email address before continuing.',
          code: 'EMAIL_VERIFICATION_REQUIRED',
        });
        return;
      }
      req.uid = decoded.uid;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired session token. Please sign in again.' });
    }
  };
}

function getSafeString(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function getSafeStringArray(val: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

interface ParsedLaunchMeta {
  id: string;
  name: string;
  status: string;
  launchDate: string | null;
  url: string | null;
  revision: string | null;
  tagline: string | null;
  missingItems: string[];
}

function parseLaunchMetadata(raw: unknown): ParsedLaunchMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const inner =
    obj.launch && typeof obj.launch === 'object' ? (obj.launch as Record<string, unknown>) : obj;
  const editable =
    inner.editable && typeof inner.editable === 'object'
      ? (inner.editable as Record<string, unknown>)
      : inner;
  const id = String(inner.id || inner.launch_id || inner.uuid || obj.id || '').trim();
  if (!id) return null;

  const missingRaw = Array.isArray(inner.missing_items)
    ? inner.missing_items
    : Array.isArray(obj.missing_items)
    ? obj.missing_items
    : [];

  return {
    id,
    name: String(editable.name || inner.name || inner.product_name || 'Untitled Launch'),
    status: String(inner.status || obj.status || 'draft'),
    launchDate:
      typeof editable.launchDate === 'string'
        ? editable.launchDate
        : typeof inner.launch_date === 'string'
        ? inner.launch_date
        : null,
    url:
      typeof inner.url === 'string'
        ? inner.url
        : typeof inner.product_hunt_url === 'string'
        ? inner.product_hunt_url
        : typeof editable.url === 'string'
        ? editable.url
        : null,
    revision:
      typeof inner.revision === 'string'
        ? inner.revision
        : typeof obj.revision === 'string'
        ? obj.revision
        : null,
    tagline:
      typeof editable.tagline === 'string'
        ? editable.tagline
        : typeof inner.tagline === 'string'
        ? inner.tagline
        : null,
    missingItems: missingRaw.map((m) => String(m)).filter(Boolean),
  };
}

function resolveAppBaseUrl(req: express.Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    return envUrl.replace(/\/+$/, '');
  }
  const origin = req.headers.origin;
  if (
    typeof origin === 'string' &&
    (origin.endsWith('.run.app') || origin.startsWith('http://localhost'))
  ) {
    return origin.replace(/\/+$/, '');
  }
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  if (host) {
    return `${proto}://${host}`.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

function handleApiError(res: express.Response, err: unknown) {
  if (err instanceof McpAuthError) {
    res.status(401).json({
      error: err.message,
      code: 'PRODUCT_HUNT_AUTH_REQUIRED',
    });
    return;
  }
  if (err instanceof McpRateLimitError) {
    res.status(429).json({
      error: err.message,
      code: 'RATE_LIMITED',
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unexpected server error.';
  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
    res.status(429).json({
      error: 'AI quota or rate limit reached. Please try again shortly or check your API key settings.',
    });
    return;
  }
  if (
    message.includes('PERMISSION_DENIED') ||
    message.includes('API_KEY_INVALID') ||
    message.includes('GEMINI_API_KEY')
  ) {
    res.status(503).json({
      error: 'Gemini API key is missing or invalid. Please check Settings > Secrets.',
    });
    return;
  }
  res.status(500).json({ error: message });
}

export interface CreateAppOptions {
  enableVite?: boolean;
  verifyTokenFn?: VerifyTokenFn | null;
}

export async function createApp(options: CreateAppOptions = {}): Promise<express.Express> {
  const enableVite = options.enableVite ?? process.env.NODE_ENV !== 'production';
  const verifyTokenFn =
    'verifyTokenFn' in options ? (options.verifyTokenFn ?? null) : defaultVerifyToken;

  const requireFirebaseAuth = buildRequireFirebaseAuth(verifyTokenFn);
  const publicLimiter = createRateLimiter({ windowMs: 60_000, max: 60, keyPrefix: 'pub' });
  const standardApiLimiter = createRateLimiter({ windowMs: 60_000, max: 120, keyPrefix: 'api' });
  const heavyLimiter = createRateLimiter({ windowMs: 60_000, max: 30, keyPrefix: 'heavy' });

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin.length > 0) {
      if (!isAllowedCorsOrigin(origin, req)) {
        res.status(403).json({ error: 'Cross-origin request blocked by CORS policy.' });
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', publicLimiter, (_req, res) => {
    res.json({
      ok: true,
      service: 'HuntPilot AI',
      firebaseConfigured: Boolean(verifyTokenFn),
      oauthPersistence: getOAuthPersistenceStatus().mode,
    });
  });

  // --- OAuth Client ID Metadata Document (for MCP CIMD support) ---
  app.get('/api/mcp/oauth/client-metadata.json', publicLimiter, (req, res) => {
    const base = resolveAppBaseUrl(req);
    res.json({
      client_id: `${base}/api/mcp/oauth/client-metadata.json`,
      client_name: 'HuntPilot AI',
      client_uri: base,
      redirect_uris: [`${base}/api/mcp/oauth/callback`],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: DEFAULT_PH_SCOPES.join(' '),
    });
  });

  // --- Product Hunt MCP Connection & OAuth Endpoints ---
  app.get('/api/mcp/status', requireFirebaseAuth, standardApiLimiter, async (req: AuthedRequest, res) => {
    const uid = req.uid!;
    const current = getMcpStatusForUser(uid);
    if (!current.serverReachable && current.tools.length === 0) {
      const discovered = await discoverMcpTools(uid);
      res.json(discovered);
      return;
    }
    res.json(current);
  });

  app.post('/api/mcp/test', requireFirebaseAuth, standardApiLimiter, async (req: AuthedRequest, res) => {
    try {
      const status = await testMcpConnectionForUser(req.uid!);
      res.json(status);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/mcp/discover', requireFirebaseAuth, standardApiLimiter, async (req: AuthedRequest, res) => {
    try {
      const status = await discoverMcpTools(req.uid!);
      res.json(status);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/mcp/oauth/start', requireFirebaseAuth, heavyLimiter, async (req: AuthedRequest, res) => {
    try {
      const base = resolveAppBaseUrl(req);
      const data = await startProductHuntOAuth(req.uid!, base);
      res.json(data);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  const handleOAuthCallback = async (req: express.Request, res: express.Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const error = typeof req.query.error === 'string' ? req.query.error : undefined;
    const errorDescription =
      typeof req.query.error_description === 'string'
        ? req.query.error_description
        : undefined;

    const result = await completeProductHuntOAuthCallback({
      code,
      state,
      error,
      errorDescription,
    });

    let account = null;
    if (result.ok && result.uid) {
      try {
        account = await fetchAuthenticatedProductHuntAccount(result.uid);
        await discoverMcpTools(result.uid);
      } catch {
        // Account fetch is also surfaced on status/test check
      }
    }

    const postPayload = result.ok
      ? { type: 'PRODUCT_HUNT_OAUTH_SUCCESS', account }
      : { type: 'PRODUCT_HUNT_OAUTH_ERROR', error: result.error || 'Authorization failed.' };

    const safeScriptPayload = JSON.stringify(postPayload).replace(/</g, '\\u003c');
    const safeStatusTitle = result.ok
      ? 'Product Hunt Connected'
      : 'Product Hunt Connection Error';
    const safeStatusBody = result.ok
      ? 'Authorization completed. Returning to HuntPilot AI...'
      : String(result.error || 'Could not complete authorization.').replace(/[<>&"]/g, '');

    const baseUrl = resolveAppBaseUrl(req);
    let targetOrigin = '*';
    try {
      targetOrigin = new URL(baseUrl).origin;
    } catch {
      targetOrigin = '*';
    }
    const safeTargetOrigin = JSON.stringify(targetOrigin).replace(/</g, '\\u003c');
    const redirectFallback = result.ok ? '/app/profile?ph_oauth=success' : '/app/profile?ph_oauth=error';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${safeStatusTitle}</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; padding: 32px; color: #0F172A; background: #F8FAFC; }
      .card { max-width: 440px; margin: 40px auto; background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 24px; }
      h1 { font-size: 18px; margin: 0 0 8px; }
      p { font-size: 14px; color: #475569; margin: 0; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${safeStatusTitle}</h1>
      <p>${safeStatusBody}</p>
    </div>
    <script>
      (function () {
        var payload = ${safeScriptPayload};
        var targetOrigin = ${safeTargetOrigin};
        if (window.opener) {
          try {
            window.opener.postMessage(payload, targetOrigin);
          } catch (e) {
            window.opener.postMessage(payload, window.location.origin);
          }
          setTimeout(function () { window.close(); }, 350);
        } else {
          setTimeout(function () { window.location.href = ${JSON.stringify(redirectFallback)}; }, 1200);
        }
      })();
    </script>
  </body>
</html>`);
  };

  app.get(['/api/mcp/oauth/callback', '/api/mcp/oauth/callback/'], publicLimiter, handleOAuthCallback);

  app.post('/api/mcp/oauth/disconnect', requireFirebaseAuth, standardApiLimiter, async (req: AuthedRequest, res) => {
    try {
      const uid = req.uid!;
      await disconnectUserOAuth(uid);
      await resetUserMcpSession(uid);
      res.json(getMcpStatusForUser(uid));
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // --- Official Product Hunt MCP Discovery & Research Routes ---
  app.get('/api/mcp/categories', requireFirebaseAuth, standardApiLimiter, async (req: AuthedRequest, res) => {
    try {
      const result = await callMcpToolForUser(req.uid!, 'get_categories', {});
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/mcp/products/search', requireFirebaseAuth, standardApiLimiter, async (req: AuthedRequest, res) => {
    try {
      const args: Record<string, unknown> = {};
      const query = getSafeString(req.body?.query, 200);
      const category = getSafeString(req.body?.category, 100);
      const pricing = getSafeString(req.body?.pricing, 30);
      const sort = getSafeString(req.body?.sort, 30);
      const cursor = getSafeString(req.body?.cursor, 100);

      if (query) args.query = query;
      if (category) args.category = category;
      if (['any', 'free', 'free_options', 'payment_required'].includes(pricing)) {
        args.pricing = pricing;
      }
      if (req.body?.open_source === true) args.open_source = true;
      if (req.body?.yc === true) args.yc = true;
      if (req.body?.has_mcp_server === true) args.has_mcp_server = true;
      if (
        typeof req.body?.launched_within_days === 'number' &&
        req.body.launched_within_days >= 1 &&
        req.body.launched_within_days <= 3650
      ) {
        args.launched_within_days = Math.floor(req.body.launched_within_days);
      }
      if (
        !query &&
        ['relevance', 'newest', 'most_points', 'highest_rated'].includes(sort)
      ) {
        args.sort = sort;
      }
      if (typeof req.body?.limit === 'number') {
        args.limit = Math.min(25, Math.max(1, Math.floor(req.body.limit)));
      }
      if (cursor) args.cursor = cursor;

      const result = await callMcpToolForUser(req.uid!, 'search_products', args);
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/mcp/products/profile', requireFirebaseAuth, standardApiLimiter, async (req: AuthedRequest, res) => {
    try {
      const productName = getSafeString(req.body?.productName, 200);
      if (!productName) {
        res.status(400).json({ error: 'productName is required.' });
        return;
      }
      const result = await callMcpToolForUser(req.uid!, 'get_product_profile', {
        product_name: productName,
      });
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/mcp/products/alternatives', requireFirebaseAuth, standardApiLimiter, async (req: AuthedRequest, res) => {
    try {
      const product = getSafeString(req.body?.product, 200);
      if (!product) {
        res.status(400).json({ error: 'product name or slug is required.' });
        return;
      }
      const limit =
        typeof req.body?.limit === 'number'
          ? Math.min(25, Math.max(1, Math.floor(req.body.limit)))
          : 10;
      const result = await callMcpToolForUser(req.uid!, 'get_alternatives', {
        product,
        limit,
      });
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/mcp/products/compare', requireFirebaseAuth, standardApiLimiter, async (req: AuthedRequest, res) => {
    try {
      const products = getSafeStringArray(req.body?.products, 3, 200);
      if (products.length < 2) {
        res.status(400).json({ error: 'Select at least 2 products to compare.' });
        return;
      }
      const settled = await Promise.allSettled(
        products.map((name) =>
          callMcpToolForUser(req.uid!, 'get_product_profile', { product_name: name })
        )
      );
      const profiles = settled.map((item, idx) => {
        if (item.status === 'fulfilled') {
          return {
            query: products[idx],
            ok: true,
            data: item.value.data,
            summaryText: item.value.summaryText,
          };
        }
        return {
          query: products[idx],
          ok: false,
          error: item.reason instanceof Error ? item.reason.message : 'Profile unavailable.',
        };
      });
      res.json({ profiles });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/mcp/leaderboard', requireFirebaseAuth, standardApiLimiter, async (req: AuthedRequest, res) => {
    try {
      const args: Record<string, unknown> = {};
      const date = getSafeString(req.body?.date, 20);
      if (date) {
        if (!isValidPeriodParam(date)) {
          res.status(400).json({ error: 'Invalid date format. Use today, yesterday, YYYY-MM-DD, YYYY-Www, or YYYY-MM.' });
          return;
        }
        if (/^\d{4}(-\d{2}(-\d{2})?|-W\d{2})?$/.test(date)) {
          args.date = date;
        }
      }
      if (typeof req.body?.limit === 'number') {
        args.limit = Math.min(25, Math.max(1, Math.floor(req.body.limit)));
      }
      const cursor = getSafeString(req.body?.cursor, 100);
      if (cursor) args.cursor = cursor;

      const result = await callMcpToolForUser(req.uid!, 'get_product_leaderboard', args);
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // --- Official Product Hunt Launch Management Routes (OAuth Required + Safe 2-Step Confirmation) ---
  app.get('/api/mcp/launches', requireFirebaseAuth, standardApiLimiter, async (req: AuthedRequest, res) => {
    try {
      const statusFilter =
        typeof req.query.status === 'string' &&
        ['draft', 'scheduled', 'live', 'unscheduled'].includes(req.query.status)
          ? req.query.status
          : undefined;
      const args: Record<string, unknown> = { limit: 25 };
      if (statusFilter) args.status = statusFilter;
      const result = await callMcpToolForUser(req.uid!, 'list_my_launches', args);
      const rawArr = Array.isArray(result.data?.launches)
        ? result.data!.launches
        : Array.isArray(result.data?.results)
        ? result.data!.results
        : [];
      const parsedLaunches = rawArr
        .map((item) => parseLaunchMetadata(item))
        .filter((item): item is ParsedLaunchMeta => Boolean(item));
      res.json({ ...result, parsedLaunches });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/mcp/launches/context', requireFirebaseAuth, standardApiLimiter, async (req: AuthedRequest, res) => {
    try {
      const args: Record<string, unknown> = {};
      const url = getSafeString(req.body?.url, 2048);
      const launchDate = getSafeString(req.body?.launch_date, 10);
      const topic = getSafeString(req.body?.topic, 120);
      const category = getSafeString(req.body?.category, 120);
      if (url && isValidHttpUrl(url)) args.url = url;
      if (launchDate && /^\d{4}-\d{2}-\d{2}$/.test(launchDate)) args.launch_date = launchDate;
      if (topic) args.topic = topic;
      if (category) args.category = category;

      const result = await callMcpToolForUser(req.uid!, 'get_launch_context', args);
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.get('/api/mcp/launches/:launchId', requireFirebaseAuth, standardApiLimiter, async (req: AuthedRequest, res) => {
    try {
      const launchId = getSafeString(req.params.launchId, 64);
      if (!launchId) {
        res.status(400).json({ error: 'launchId is required.' });
        return;
      }
      const result = await callMcpToolForUser(req.uid!, 'get_launch', {
        launch_id: launchId,
      });
      res.json({
        ...result,
        parsedLaunch: parseLaunchMetadata(result.data),
      });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // --- Live Product Hunt Intelligence & Snapshot Analytics Routes ---
  app.get('/api/intelligence/leaderboards', requireFirebaseAuth, standardApiLimiter, async (req: AuthedRequest, res) => {
    try {
      const date = getSafeString(req.query.date, 20);
      if (date && !isValidPeriodParam(date)) {
        res.status(400).json({
          error: 'Invalid date period format. Use today, yesterday, YYYY-MM-DD, YYYY-Www, or YYYY-MM.',
        });
        return;
      }
      const sort = getSafeString(req.query.sort, 20);
      const category = getSafeString(req.query.category, 80);
      const query = getSafeString(req.query.q, 120);
      const data = await getLeaderboardIntelligence({
        date: date || undefined,
        sort: sort || undefined,
        category: category || undefined,
        query: query || undefined,
      });
      res.json(data);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/intelligence/refresh', requireFirebaseAuth, heavyLimiter, async (req: AuthedRequest, res) => {
    try {
      const date = getSafeString(req.body?.date, 20);
      if (date && !isValidPeriodParam(date)) {
        res.status(400).json({
          error: 'Invalid date period format. Use today, yesterday, YYYY-MM-DD, YYYY-Www, or YYYY-MM.',
        });
        return;
      }
      await captureLeaderboardSnapshot(date || undefined, false);
      const data = await getLeaderboardIntelligence({
        date: date || undefined,
        sort: getSafeString(req.body?.sort, 20) || undefined,
        category: getSafeString(req.body?.category, 80) || undefined,
        query: getSafeString(req.body?.q, 120) || undefined,
      });
      res.json(data);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.get('/api/intelligence/history', requireFirebaseAuth, standardApiLimiter, (req: AuthedRequest, res) => {
    try {
      const date = getSafeString(req.query.date, 20);
      if (date && !isValidPeriodParam(date)) {
        res.status(400).json({
          error: 'Invalid date period format. Use today, yesterday, YYYY-MM-DD, YYYY-Www, or YYYY-MM.',
        });
        return;
      }
      const slug = getSafeString(req.query.slug, 120);
      const history = getHistoricalSnapshots({
        date: date || undefined,
        slug: slug || undefined,
      });
      res.json(history);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.get('/api/intelligence/product/:slugOrName', requireFirebaseAuth, standardApiLimiter, async (req: AuthedRequest, res) => {
    try {
      const slugOrName = getSafeString(req.params.slugOrName, 160);
      if (!slugOrName) {
        res.status(400).json({ error: 'Product slug or name is required.' });
        return;
      }
      const detail = await getProductPerformanceDetail(slugOrName);
      res.json(detail);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.get('/api/intelligence/hunter/:nameOrUsername', requireFirebaseAuth, standardApiLimiter, async (req: AuthedRequest, res) => {
    try {
      const nameOrUsername = getSafeString(req.params.nameOrUsername, 160);
      if (!nameOrUsername) {
        res.status(400).json({ error: 'Hunter or maker name is required.' });
        return;
      }
      const detail = await getHunterAnalyticsDetail(nameOrUsername);
      res.json(detail);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/mcp/launches/:launchId/preview', requireFirebaseAuth, standardApiLimiter, async (req: AuthedRequest, res) => {
    try {
      const launchId = getSafeString(req.params.launchId, 64);
      if (!launchId) {
        res.status(400).json({ error: 'launchId is required.' });
        return;
      }
      const args: Record<string, unknown> = { launch_id: launchId };
      if (req.body?.changes && typeof req.body.changes === 'object' && !Array.isArray(req.body.changes)) {
        args.changes = req.body.changes;
      }
      const result = await callMcpToolForUser(req.uid!, 'get_launch_preview_view', args);
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/mcp/launches/start', requireFirebaseAuth, heavyLimiter, async (req: AuthedRequest, res) => {
    try {
      if (req.body?.explicitUserConfirmed !== true) {
        res.status(400).json({
          error: 'Explicit user confirmation is required before creating a Product Hunt draft.',
        });
        return;
      }

      const url = getSafeString(req.body?.url, 2048);
      if (!url || !isValidHttpUrl(url)) {
        res.status(400).json({ error: 'A valid https:// or http:// product URL is required.' });
        return;
      }

      const idempotencyKey =
        getSafeString(req.body?.idempotency_key, 128) ||
        `hp_start_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const values: Record<string, unknown> = {};
      if (req.body?.values && typeof req.body.values === 'object') {
        const v = req.body.values as Record<string, unknown>;
        if (typeof v.name === 'string' && v.name.trim()) values.name = v.name.trim().slice(0, 200);
        if (typeof v.tagline === 'string' && v.tagline.trim()) values.tagline = v.tagline.trim().slice(0, 500);
        if (typeof v.description === 'string' && v.description.trim()) {
          values.description = v.description.trim().slice(0, 5000);
        }
        if (typeof v.commentBody === 'string' && v.commentBody.trim()) {
          values.commentBody = v.commentBody.trim().slice(0, 20000);
        }
        if (typeof v.launchDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.launchDate)) {
          values.launchDate = v.launchDate;
        }
      }

      const result = await callMcpToolForUser(req.uid!, 'start_launch', {
        url,
        product_choice: req.body?.product_choice === 'existing' ? 'existing' : 'new',
        ...(req.body?.product_choice === 'existing' && typeof req.body?.product_id === 'string'
          ? { product_id: req.body.product_id.trim().slice(0, 20) }
          : {}),
        ...(Object.keys(values).length > 0 ? { values } : {}),
        idempotency_key: idempotencyKey,
      });

      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/mcp/launches/:launchId/update', requireFirebaseAuth, heavyLimiter, async (req: AuthedRequest, res) => {
    try {
      const launchId = getSafeString(req.params.launchId, 64);
      const expectedRevision = getSafeString(req.body?.expected_revision, 64);
      const changes =
        req.body?.changes && typeof req.body.changes === 'object' && !Array.isArray(req.body.changes)
          ? (req.body.changes as Record<string, unknown>)
          : null;

      if (!launchId || !expectedRevision || !changes || Object.keys(changes).length === 0) {
        res.status(400).json({
          error: 'launchId, expected_revision, and non-empty changes are required.',
        });
        return;
      }

      const idempotencyKey =
        getSafeString(req.body?.idempotency_key, 128) ||
        `hp_upd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const confirmationToken = getSafeString(req.body?.confirmation_token, 4096);
      const explicitUserConfirmed = req.body?.explicitUserConfirmed === true;

      // Safety gate: NEVER apply update without explicit user confirmation + confirmation_token
      const args: Record<string, unknown> = {
        launch_id: launchId,
        changes,
        expected_revision: expectedRevision,
        idempotency_key: idempotencyKey,
      };

      if (explicitUserConfirmed && confirmationToken) {
        args.confirmation_token = confirmationToken;
      } else {
        args.preview = true;
      }

      const result = await callMcpToolForUser(req.uid!, 'update_launch', args);
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/mcp/launches/:launchId/submit', requireFirebaseAuth, heavyLimiter, async (req: AuthedRequest, res) => {
    try {
      const launchId = getSafeString(req.params.launchId, 64);
      if (!launchId) {
        res.status(400).json({ error: 'launchId is required.' });
        return;
      }

      const idempotencyKey =
        getSafeString(req.body?.idempotency_key, 128) ||
        `hp_sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const confirmationToken = getSafeString(req.body?.confirmation_token, 4096);
      const explicitUserConfirmed = req.body?.explicitUserConfirmed === true;

      // Safety gate: NEVER submit without explicit user confirmation + confirmation_token
      const args: Record<string, unknown> = {
        launch_id: launchId,
        idempotency_key: idempotencyKey,
      };
      if (explicitUserConfirmed && confirmationToken) {
        args.confirmation_token = confirmationToken;
      } else {
        args.preview = true;
      }

      const result = await callMcpToolForUser(req.uid!, 'submit_launch', args);
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/mcp/launches/:launchId/prepare-asset', requireFirebaseAuth, heavyLimiter, async (req: AuthedRequest, res) => {
    try {
      const launchId = getSafeString(req.params.launchId, 64);
      const kind = req.body?.kind === 'thumbnail' ? 'thumbnail' : 'gallery';
      const sourceUrl = getSafeString(req.body?.source_url, 2048);

      if (!launchId || !sourceUrl || !isValidHttpUrl(sourceUrl)) {
        res.status(400).json({ error: 'launchId and a valid public https:// image source_url are required.' });
        return;
      }

      const idempotencyKey =
        getSafeString(req.body?.idempotency_key, 128) ||
        `hp_asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const result = await callMcpToolForUser(req.uid!, 'prepare_launch_asset', {
        launch_id: launchId,
        kind,
        source_url: sourceUrl,
        idempotency_key: idempotencyKey,
      });
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // --- Launch Academy Plain-English AI Explainer ---
  app.post('/api/ai/academy-explain', requireFirebaseAuth, heavyLimiter, async (req: AuthedRequest, res) => {
    try {
      const lessonTitle = getSafeString(req.body?.lessonTitle, 200);
      const lessonExplanation = getSafeString(req.body?.lessonExplanation, 3000);
      const question = getSafeString(req.body?.question, 1000);
      if (!lessonTitle || !lessonExplanation) {
        res.status(400).json({ error: 'Lesson title and explanation are required.' });
        return;
      }

      const rawCtx = req.body?.projectContext;
      const projectContext =
        rawCtx && typeof rawCtx === 'object' && !Array.isArray(rawCtx)
          ? {
              name: getSafeString((rawCtx as Record<string, unknown>).name, 120),
              category: getSafeString((rawCtx as Record<string, unknown>).category, 80),
              tagline: getSafeString((rawCtx as Record<string, unknown>).tagline, 120),
              targetAudience: getSafeString((rawCtx as Record<string, unknown>).targetAudience, 500),
            }
          : null;

      const explanation = await explainAcademyLessonWithAI({
        lessonTitle,
        lessonExplanation,
        question,
        projectContext,
      });
      res.json({ explanation });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // --- AI Launch Draft Generator ---
  app.post('/api/ai/generate-draft', requireFirebaseAuth, heavyLimiter, async (req: AuthedRequest, res) => {
    try {
      const productName = getSafeString(req.body?.productName, 120);
      const category = getSafeString(req.body?.category, 80);
      const targetAudience = getSafeString(req.body?.targetAudience, 500);
      const mainProblem = getSafeString(req.body?.mainProblem, 1000);
      const usp = getSafeString(req.body?.usp, 800);
      const description = getSafeString(req.body?.description, 2500);

      if (!productName || !category) {
        res.status(400).json({ error: 'Product name and category are required.' });
        return;
      }

      const result = await generateLaunchDraftWithAI({
        productName,
        websiteUrl: getSafeString(req.body?.websiteUrl, 300),
        category,
        targetAudience,
        mainProblem,
        keyFeatures: getSafeStringArray(req.body?.keyFeatures, 10, 200),
        usp,
        description,
        regenerateSection: getSafeString(req.body?.regenerateSection, 40) || undefined,
        existingDraft:
          req.body?.existingDraft && typeof req.body.existingDraft === 'object'
            ? (req.body.existingDraft as Record<string, unknown>)
            : undefined,
      });

      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // --- AI Launch Analyzer (Grounded with Real Product Hunt MCP Data when available) ---
  app.post('/api/ai/analyze-launch', requireFirebaseAuth, heavyLimiter, async (req: AuthedRequest, res) => {
    try {
      const uid = req.uid!;
      const productName = getSafeString(req.body?.productName, 120);
      const tagline = getSafeString(req.body?.tagline, 150);
      const category = getSafeString(req.body?.category, 80);
      const description = getSafeString(req.body?.description, 3000);

      if (!productName || !tagline || !description) {
        res.status(400).json({
          error: 'Product name, tagline, and description are required to run a launch analysis.',
        });
        return;
      }

      const mcpContext: AnalyzeMcpContext = {
        relatedProducts: [],
        matchedCategories: [],
      };
      let mcpErrorNote: string | null = null;

      // Retrieve real Product Hunt category & competitor context via official MCP
      try {
        const searchQuery = category || productName;
        const [searchRes, catRes] = await Promise.allSettled([
          callMcpToolForUser(uid, 'search_products', {
            query: searchQuery,
            limit: 5,
          }),
          callMcpToolForUser(uid, 'get_categories', {}),
        ]);

        if (searchRes.status === 'fulfilled' && searchRes.value.data) {
          const results = Array.isArray(searchRes.value.data.results)
            ? (searchRes.value.data.results as Array<Record<string, unknown>>)
            : [];
          mcpContext.relatedProducts = results.slice(0, 5).map((r) => ({
            name: String(r.name || ''),
            tagline: String(r.tagline || ''),
            pricing: typeof r.pricing === 'string' ? r.pricing : null,
            rating: typeof r.rating === 'number' ? r.rating : null,
            topLaunchPoints:
              typeof r.top_launch_points === 'number' ? r.top_launch_points : null,
            url: typeof r.url === 'string' ? r.url : undefined,
          }));
        }

        if (catRes.status === 'fulfilled' && catRes.value.summaryText) {
          const term = (category || '').toLowerCase();
          if (term) {
            const matches = catRes.value.summaryText
              .split(/[\n,]/)
              .map((line) => line.trim())
              .filter((line) => line.toLowerCase().includes(term))
              .slice(0, 5);
            mcpContext.matchedCategories = matches;
          }
        }
      } catch (err) {
        mcpErrorNote =
          err instanceof Error ? err.message : 'Unable to fetch live MCP comparison data.';
      }

      const mcpLaunchId = getSafeString(req.body?.mcpLaunchId, 64);
      if (mcpLaunchId) {
        try {
          const launchRes = await callMcpToolForUser(uid, 'get_launch', {
            launch_id: mcpLaunchId,
          });
          if (launchRes.data) {
            mcpContext.mcpLaunchAssessment = launchRes.data.assessment || launchRes.data;
          }
        } catch {
          // Optional if user imported an MCP launch
        }
      }

      const result = await analyzeLaunchWithAI({
        productName,
        tagline,
        category,
        description,
        makerComment: getSafeString(req.body?.makerComment, 4000),
        topics: getSafeStringArray(req.body?.topics, 10, 80),
        websiteUrl: getSafeString(req.body?.websiteUrl, 300),
        targetAudience: getSafeString(req.body?.targetAudience, 500),
        usp: getSafeString(req.body?.usp, 800),
        visualAssetsNotes: getSafeString(req.body?.visualAssetsNotes, 1500),
        competitorNotes: getSafeString(req.body?.competitorNotes, 1500),
        launchChecklistNotes: getSafeString(req.body?.launchChecklistNotes, 1500),
        mcpContext,
      });

      res.json({
        ...result,
        mcpResearchData: mcpContext,
        mcpErrorNote,
      });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // --- HuntPilot AI Assistant (with Live MCP Tool Execution) ---
  app.post('/api/ai/assistant', requireFirebaseAuth, heavyLimiter, async (req: AuthedRequest, res) => {
    try {
      const message = getSafeString(req.body?.message, 2000);
      if (!message) {
        res.status(400).json({ error: 'Message cannot be empty.' });
        return;
      }

      const rawHistory: unknown[] = Array.isArray(req.body?.history) ? req.body.history : [];
      const history = rawHistory
        .filter(
          (item: unknown): item is { role: 'user' | 'assistant'; content: string } =>
            Boolean(
              item &&
                typeof item === 'object' &&
                ((item as Record<string, unknown>).role === 'user' ||
                  (item as Record<string, unknown>).role === 'assistant') &&
                typeof (item as Record<string, unknown>).content === 'string'
            )
        )
        .slice(-10)
        .map((item) => ({
          role: item.role,
          content: item.content.slice(0, 4000),
        }));

      const rawCtx = req.body?.projectContext;
      const projectContext =
        rawCtx && typeof rawCtx === 'object' && !Array.isArray(rawCtx)
          ? {
              name: getSafeString((rawCtx as Record<string, unknown>).name, 120),
              category: getSafeString((rawCtx as Record<string, unknown>).category, 80),
              tagline: getSafeString((rawCtx as Record<string, unknown>).tagline, 120),
              targetAudience: getSafeString((rawCtx as Record<string, unknown>).targetAudience, 500),
              usp: getSafeString((rawCtx as Record<string, unknown>).usp, 800),
              description: getSafeString((rawCtx as Record<string, unknown>).description, 2500),
              stage: getSafeString((rawCtx as Record<string, unknown>).stage, 40),
              latestScore:
                typeof (rawCtx as Record<string, unknown>).latestScore === 'number'
                  ? ((rawCtx as Record<string, unknown>).latestScore as number)
                  : undefined,
            }
          : null;

      const result = await askAssistantWithAI({
        uid: req.uid!,
        message,
        history,
        projectContext,
        academySummary: getSafeString(req.body?.academySummary, 2000) || undefined,
        draftsSummary: getSafeString(req.body?.draftsSummary, 3500) || undefined,
        researchSummary: getSafeString(req.body?.researchSummary, 3500) || undefined,
        latestAnalysisSummary: getSafeString(req.body?.latestAnalysisSummary, 3500) || undefined,
      });
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // --- Competitor Research (Real Official Product Hunt MCP + Grounded AI Synthesis) ---
  app.post('/api/ai/competitor-research', requireFirebaseAuth, heavyLimiter, async (req: AuthedRequest, res) => {
    try {
      const uid = req.uid!;
      const query = getSafeString(req.body?.query, 200);
      const category = getSafeString(req.body?.category, 80);

      if (!query || !category) {
        res.status(400).json({ error: 'Search query and category are required.' });
        return;
      }

      const mode = getSafeString(req.body?.mode, 40) || 'search_products';
      const args: Record<string, unknown> = { limit: 10 };
      let toolName = 'search_products';

      if (mode === 'get_alternatives') {
        toolName = 'get_alternatives';
        args.product = query;
      } else if (mode === 'get_product_leaderboard') {
        toolName = 'get_product_leaderboard';
        if (/^\d{4}(-\d{2}(-\d{2})?|-W\d{2})?$/.test(query)) {
          args.date = query;
        }
      } else {
        toolName = 'search_products';
        args.query = query;
        if (category && category !== 'All') {
          // Only pass category if it looks like a slug, otherwise include in query context
          if (/^[a-z0-9-]+$/.test(category)) {
            args.category = category;
          }
        }
      }

      const mcpResult = await callMcpToolForUser(uid, toolName, args);

      const synthesis = await synthesizeCompetitorResearchWithAI({
        query,
        category,
        productDescription: getSafeString(req.body?.productDescription, 2000),
        usp: getSafeString(req.body?.usp, 800),
        mcpData: mcpResult.data ?? mcpResult.summaryText,
      });

      res.json({
        ...synthesis,
        rawMcpData: mcpResult.data,
        mcpError: null,
        mcpStatus: getMcpStatusForUser(uid),
      });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // --- JSON 404 Catch-all for unknown /api/* routes ---
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // --- Vite / Static Serving ---
  if (enableVite) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

async function startServer() {
  const app = await createApp();
  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    const oauthPersistence = getOAuthPersistenceStatus();
    console.log(
      `HuntPilot AI server listening on http://0.0.0.0:${PORT} | Firebase: ${
        firebaseProjectId || 'NOT_CONFIGURED'
      } | GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'configured' : 'unset'} | OAuth storage: ${
        oauthPersistence.mode
      }`
    );
    startIntelligenceScheduler();
  });
}

const isMainModule = Boolean(
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)
);
if (isMainModule) {
  void startServer();
}
