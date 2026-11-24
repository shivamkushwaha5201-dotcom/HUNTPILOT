import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createApp, createRateLimiter } from '../server.ts';

async function withServer(
  options: Parameters<typeof createApp>[0],
  fn: (baseUrl: string) => Promise<void>
) {
  const app = await createApp(options);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('API health, security headers, 404 JSON catch-all, and CIMD metadata work cleanly', async () => {
  await withServer(
    {
      enableVite: false,
      verifyTokenFn: async (token) => ({
        uid: 'user_1',
        email_verified: token === 'verified',
      }),
    },
    async (baseUrl) => {
      const health = await fetch(`${baseUrl}/api/health`);
      assert.equal(health.status, 200);
      assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(health.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      const healthJson = (await health.json()) as { ok: boolean; firebaseConfigured: boolean };
      assert.equal(healthJson.ok, true);
      assert.equal(healthJson.firebaseConfigured, true);

      const unknown = await fetch(`${baseUrl}/api/non-existent-route`);
      assert.equal(unknown.status, 404);
      const unknownJson = (await unknown.json()) as { error: string };
      assert.match(unknownJson.error, /not found/i);

      const cimd = await fetch(`${baseUrl}/api/mcp/oauth/client-metadata.json`);
      assert.equal(cimd.status, 200);
      const cimdJson = (await cimd.json()) as { client_name: string; redirect_uris: string[] };
      assert.equal(cimdJson.client_name, 'HuntPilot AI');
      assert.ok(cimdJson.redirect_uris[0].endsWith('/api/mcp/oauth/callback'));
    }
  );
});

test('Authentication middleware enforces 401 missing auth, 403 unverified email, and 503 missing Firebase config', async () => {
  await withServer({ enableVite: false, verifyTokenFn: null }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/mcp/status`, {
      headers: { Authorization: 'Bearer any' },
    });
    assert.equal(res.status, 503);
  });

  await withServer(
    {
      enableVite: false,
      verifyTokenFn: async (token) => {
        if (token === 'unverified') return { uid: 'u1', email_verified: false };
        if (token === 'verified') return { uid: 'u1', email_verified: true };
        throw new Error('bad token');
      },
    },
    async (baseUrl) => {
      const noAuth = await fetch(`${baseUrl}/api/intelligence/leaderboards`);
      assert.equal(noAuth.status, 401);

      const badAuth = await fetch(`${baseUrl}/api/intelligence/leaderboards`, {
        headers: { Authorization: 'Bearer garbage' },
      });
      assert.equal(badAuth.status, 401);

      const unverified = await fetch(`${baseUrl}/api/intelligence/leaderboards`, {
        headers: { Authorization: 'Bearer unverified' },
      });
      assert.equal(unverified.status, 403);
      const unvJson = (await unverified.json()) as { code?: string };
      assert.equal(unvJson.code, 'EMAIL_VERIFICATION_REQUIRED');
    }
  );
});

test('Input validation, confirmation gates, SSRF checks, CORS policy, and missing Gemini key error handling', async () => {
  const prevGemini = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    await withServer(
      {
        enableVite: false,
        verifyTokenFn: async () => ({ uid: 'u_verified', email_verified: true }),
      },
      async (baseUrl) => {
        // Invalid date param -> 400
        const badDate = await fetch(`${baseUrl}/api/intelligence/leaderboards?date=invalid_date`, {
          headers: { Authorization: 'Bearer valid' },
        });
        assert.equal(badDate.status, 400);

        const badHistDate = await fetch(`${baseUrl}/api/intelligence/history?date=2026-99-99-extra`, {
          headers: { Authorization: 'Bearer valid' },
        });
        assert.equal(badHistDate.status, 400);

        // Write action without explicit confirmation -> 400
        const unconfirmedStart = await fetch(`${baseUrl}/api/mcp/launches/start`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: 'https://example.com' }),
        });
        assert.equal(unconfirmedStart.status, 400);

        // SSRF check on prepare-asset -> 400
        const ssrfAsset = await fetch(`${baseUrl}/api/mcp/launches/abc/prepare-asset`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            kind: 'thumbnail',
            source_url: 'http://127.0.0.1/secret.png',
          }),
        });
        assert.equal(ssrfAsset.status, 400);

        // Missing GEMINI_API_KEY returns 503 cleanly without fabricating AI output
        const aiRes = await fetch(`${baseUrl}/api/ai/generate-draft`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ productName: 'Test', category: 'DevTools' }),
        });
        assert.equal(aiRes.status, 503);

        // CORS blocks untrusted Origin and allows localhost
        const blockedOrigin = await fetch(`${baseUrl}/api/health`, {
          headers: { Origin: 'https://untrusted-evil.example.com' },
        });
        assert.equal(blockedOrigin.status, 403);

        const allowedOrigin = await fetch(`${baseUrl}/api/health`, {
          headers: { Origin: 'http://localhost:3000' },
        });
        assert.equal(allowedOrigin.status, 200);
        assert.equal(
          allowedOrigin.headers.get('access-control-allow-origin'),
          'http://localhost:3000'
        );
      }
    );
  } finally {
    if (prevGemini !== undefined) process.env.GEMINI_API_KEY = prevGemini;
  }
});

test('createRateLimiter enforces max requests and emits Retry-After + 429', async () => {
  const miniApp = express();
  miniApp.use(createRateLimiter({ windowMs: 60_000, max: 3, keyPrefix: 'test' }));
  miniApp.get('/ping', (_req, res) => res.json({ ok: true }));

  const server = http.createServer(miniApp);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;

  try {
    for (let i = 0; i < 3; i++) {
      const r = await fetch(`http://127.0.0.1:${port}/ping`);
      assert.equal(r.status, 200);
    }
    const blocked = await fetch(`http://127.0.0.1:${port}/ping`);
    assert.equal(blocked.status, 429);
    assert.ok(blocked.headers.get('retry-after'));
    const body = (await blocked.json()) as { code: string };
    assert.equal(body.code, 'RATE_LIMITED');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
