import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  completeProductHuntOAuthCallback,
  disconnectUserOAuth,
  getOfficialMcpEndpoint,
  getOAuthPersistenceStatus,
  getUserOAuthSession,
  isPrivateOrMetadataHost,
  OFFICIAL_PRODUCT_HUNT_MCP_URL,
  reloadOAuthStoreForTest,
  startProductHuntOAuth,
  validateExternalHttpsUrl,
} from '../server/mcpOAuth.ts';
import {
  callMcpToolForUser,
  discoverMcpTools,
  McpAuthError,
  parseMcpToolResponse,
} from '../server/mcp.ts';

test('SSRF guards block private hosts and enforce https', () => {
  assert.equal(isPrivateOrMetadataHost('localhost'), true);
  assert.equal(isPrivateOrMetadataHost('127.0.0.1'), true);
  assert.equal(isPrivateOrMetadataHost('169.254.169.254'), true);
  assert.equal(isPrivateOrMetadataHost('10.0.0.5'), true);
  assert.equal(isPrivateOrMetadataHost('192.168.1.1'), true);
  assert.equal(isPrivateOrMetadataHost('mcp.producthunt.com'), false);

  assert.throws(() => validateExternalHttpsUrl('http://mcp.producthunt.com/mcp', 'URL'));
  assert.throws(() => validateExternalHttpsUrl('https://127.0.0.1/mcp', 'URL'));
  assert.equal(
    validateExternalHttpsUrl('https://mcp.producthunt.com/mcp', 'URL'),
    OFFICIAL_PRODUCT_HUNT_MCP_URL
  );
  assert.equal(getOfficialMcpEndpoint(), OFFICIAL_PRODUCT_HUNT_MCP_URL);
});

test('OAuth persistence reports memory_only without secret and encrypts at rest with secret', async () => {
  const prevSecret = process.env.OAUTH_STORAGE_SECRET;
  const encPath = path.resolve(process.cwd(), '.data', 'ph-oauth-sessions.enc.json');
  const hadExisting = fs.existsSync(encPath);
  const backup = hadExisting ? fs.readFileSync(encPath, 'utf-8') : null;

  try {
    delete process.env.OAUTH_STORAGE_SECRET;
    reloadOAuthStoreForTest();
    assert.equal(getOAuthPersistenceStatus().mode, 'memory_only');

    process.env.OAUTH_STORAGE_SECRET = 'test_secret_key_for_huntpilot_aes_gcm';
    reloadOAuthStoreForTest();
    const status = getOAuthPersistenceStatus();
    assert.equal(status.mode, 'encrypted_file');
    assert.equal(status.persistent, true);

    const started = await startProductHuntOAuth('test_uid_1', 'https://huntpilot.example.com');
    assert.ok(started.authUrl.includes('code_challenge_method=S256'));
    assert.ok(started.authUrl.includes('state='));
    assert.equal(started.redirectUri, 'https://huntpilot.example.com/api/mcp/oauth/callback');
    assert.ok(fs.existsSync(encPath), 'Encrypted OAuth state file should exist on disk');

    const rawDisk = fs.readFileSync(encPath, 'utf-8');
    assert.equal(rawDisk.includes('test_uid_1'), false, 'UID/state must not be plaintext on disk');

    // Reload store from disk and verify missing/invalid state is rejected cleanly
    reloadOAuthStoreForTest();
    const badCb = await completeProductHuntOAuthCallback({
      code: 'abc',
      state: 'nonexistent-state',
    });
    assert.equal(badCb.ok, false);
    assert.match(badCb.error || '', /missing or expired/i);

    await disconnectUserOAuth('test_uid_1');
    assert.equal(getUserOAuthSession('test_uid_1'), null);
  } finally {
    if (prevSecret === undefined) {
      delete process.env.OAUTH_STORAGE_SECRET;
    } else {
      process.env.OAUTH_STORAGE_SECRET = prevSecret;
    }
    if (hadExisting && backup !== null) {
      fs.writeFileSync(encPath, backup, 'utf-8');
    } else if (fs.existsSync(encPath)) {
      fs.unlinkSync(encPath);
    }
    reloadOAuthStoreForTest();
  }
});

test('parseMcpToolResponse translates unauthorized status into McpAuthError', () => {
  assert.throws(
    () =>
      parseMcpToolResponse({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              error: { code: 'unauthorized', message: 'Token expired' },
            }),
          },
        ],
      }),
    (err) => err instanceof McpAuthError && err.code === 'unauthorized'
  );

  const okParsed = parseMcpToolResponse({
    content: [
      { type: 'text', text: 'Summary line' },
      { type: 'text', text: JSON.stringify({ status: 'ok', data: { count: 3 } }) },
    ],
  });
  assert.equal(okParsed.summaryText, 'Summary line');
  assert.deepEqual(okParsed.data, { count: 3 });
});

test('Live public Product Hunt MCP discovery and public tools succeed while OAuth tools require auth', async () => {
  const status = await discoverMcpTools();
  assert.equal(status.endpointUrl, OFFICIAL_PRODUCT_HUNT_MCP_URL);
  assert.equal(status.serverReachable, true, `Expected PH MCP reachable, got error: ${status.error}`);
  assert.ok(status.tools.length > 0, 'Expected discovered PH MCP tools');

  const cats = await callMcpToolForUser(undefined, 'get_categories', {});
  assert.ok(cats.summaryText.length > 0 || cats.data !== null);

  await assert.rejects(
    () => callMcpToolForUser(undefined, 'list_my_launches', {}),
    (err) => err instanceof McpAuthError
  );
});
