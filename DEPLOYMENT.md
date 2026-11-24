# HuntPilot AI — Deployment & Environment Guide

## 1. Prerequisites
- **Node.js**: 20+ (tested on Node 22)
- **Firebase Project** (Web App + Authentication + Firestore)
- **Official Product Hunt MCP Endpoint**: `https://mcp.producthunt.com/mcp` (default, no API key required for public tools)

---

## 2. Environment Variables

Copy `.env.example` to `.env` (for local or server deployments) and configure as needed:

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_URL` | Recommended in prod | Public HTTPS origin of the deployed app (used for CORS origin checks and Product Hunt OAuth redirect URI `${APP_URL}/api/mcp/oauth/callback`). |
| `OAUTH_STORAGE_SECRET` | Recommended (16+ chars) | Enables AES-256-GCM encrypted server-side storage of Product Hunt OAuth tokens in `.data/ph-oauth-sessions.enc.json` so sessions survive process restarts. Without it, OAuth sessions stay in memory only. |
| `PRODUCT_HUNT_MCP_URL` | Optional | Defaults to `https://mcp.producthunt.com/mcp`. Any custom value must use `https://` and non-private hosts. |
| `PRODUCT_HUNT_OAUTH_CLIENT_ID` | Optional | Optional static OAuth client ID. If unset, the server attempts Dynamic Client Registration (DCR) or Client ID Metadata Document (`CIMD`) with Product Hunt. |
| `PRODUCT_HUNT_OAUTH_CLIENT_SECRET` | Optional | Optional static OAuth client secret matching `PRODUCT_HUNT_OAUTH_CLIENT_ID`. |
| `GEMINI_API_KEY` | Required for AI routes only | Server-side key for `@google/genai` routes (`/api/ai/*`). Public MCP tools, Live Intelligence, Auth, and Firestore workspaces run without it; `/api/ai/*` returns HTTP `503` until configured. |

---

## 3. Firebase Setup

1. Ensure `firebase-applet-config.json` contains a valid Web App configuration (`apiKey`, `authDomain`, `projectId`, `appId`, and optional `firestoreDatabaseId`).
2. In **Firebase Console → Authentication → Sign-in method**, enable:
   - **Email/Password** (required for email signup, login, password reset, and verification emails)
   - **Google** (required for Continue with Google)
3. Under **Authentication → Settings → Authorized domains**, add your production domain (or `.run.app` preview domain).
4. Deploy Firestore security rules so strict per-user isolation and verified-email checks remain enforced:
   ```bash
   npx eslint firestore.rules
   firebase deploy --only firestore:rules
   ```

---

## 4. Product Hunt MCP & OAuth Notes

- **Public MCP Tools** (`search_products`, `get_categories`, `get_product_profile`, `get_alternatives`, `get_product_leaderboard`) work over Streamable HTTP against `https://mcp.producthunt.com/mcp` without personal OAuth.
- **Personal OAuth 2.1 + PKCE** is required for account-scoped tools (`get_my_account`, `list_my_launches`, `get_launch`, `start_launch`, `update_launch`, `submit_launch`).
- **Ephemeral vs Persistent Storage**:
  - User profiles, projects, drafts, analysis reports, chat history, research, launch schedules, and saved intelligence watchlists are stored permanently in **Cloud Firestore** under the authenticated user's `ownerId`.
  - Server-side 15-minute Product Hunt leaderboard snapshots (`.data/ph-snapshots.json`) and encrypted OAuth sessions (`.data/ph-oauth-sessions.enc.json`) survive process restarts on writable local disk, but reset across fresh ephemeral container deployments unless mounted on a persistent volume.

---

## 5. Build, Verification & Start Commands

```bash
# Install dependencies
npm install

# Type-check and run automated test suite
npm run lint
npm test

# Lint Firestore security rules
npx eslint firestore.rules

# Production frontend build + server start (listens on port 3000)
npm run build
NODE_ENV=production npm start
```
