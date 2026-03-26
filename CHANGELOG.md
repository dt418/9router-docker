# 9Router Changelog

## v0.0.1 (2026-03-26)
## Features
- update mermaid validation with @probelabs/maid

## v0.0.1 (2026-03-26)
## Fixes
- mermaid parse error - replace pipe with 'or' in diagram

## v0.0.1 (2026-03-26)
## Features
- integrate validation utilities into API routes

## v0.0.1 (2026-03-26)
## Fixes
- remove Express patterns, use env var for memory threshold

## v0.0.1 (2026-03-26)
## Features
- implement core utilities from docs/fixes

## v0.0.1 (2026-03-26)
## Fixes
- resolve all ESLint warnings and apply React best practices

## v0.0.2 (2026-03-26)

#### Code Quality
- Fixed all ESLint warnings/errors across the codebase:
  - Fixed anonymous default exports (cursorChecksum, cursorProtobuf, postcss.config)
  - Removed unused eslint-disable directives
  - Replaced `<img>` with `<Image>` from next/image (BasicChatPageClient, ProviderTopology, ProviderIcon)
  - Fixed missing useEffect dependencies (providers/[id]/page.js)
  - Fixed impure function calls in useMemo (Date.now - page.new.js)
  - Fixed setState in effect patterns (UsageTable, UsageStats, callback/page.js)
  - Fixed memoization preserve errors (ProviderTopology)
- Applied React best practices across 10+ dashboard components:
  - Wrapped async functions in `useCallback` to prevent stale closures
  - Added proper dependency arrays to useEffects
  - Added `useRef` guards for one-time initialization

## v0.0.1 (2026-03-24)
## Features
- add secret rotation and password reset scripts

## Fork Changes (dt418/9router-docker)

### v0.3.61-dt418 (2026-03-25)

#### Performance
- Optimized Dockerfile: simplified to 2-stage build, consolidated entrypoint script
- Optimized docker-compose.yml: improved restart policy, added resource limits (CPU+memory)

#### Features
- Added `docker-smoke-test` skill and script for automated Docker testing

#### Security
- Added JWT authentication to all protected API endpoints:
  - Created `serverAuth.js` helper for JWT token verification
  - Protected management APIs: providers, combos, proxy-pools, provider-nodes, keys, settings, pricing
  - Protected operational APIs: tunnel enable/disable, shutdown, CLI tools, translator
- Rotated all secrets in `.env` (JWT_SECRET, API_KEY_SECRET, MACHINE_ID_SALT)
- Removed unused `SUDO_PASSWORD` from `.env` (not referenced in codebase)
- Added `scripts/rotate-secrets.sh` - rotate security keys using openssl
- Added `scripts/reset-password.sh` - reset INITIAL_PASSWORD with backup
- Left public by design: `/api/v1/*` (AI proxy), `/api/auth/*`, `/api/models/*`, `/api/usage/*`

### v0.3.60-dt418 (2026-03-23)

#### Features
- Merged upstream v0.3.60 from decolua/9router
- Fixed tunnel feature: Updated to use Cloudflare Quick Tunnel (`trycloudflare.com`) instead of deprecated Cloudflare Tunnel token API
- Updated tunnel worker URL to `https://9router.com/api/tunnel/register`

#### Docker Fixes
- Fixed permission issues with named Docker volume (`9router-data`)
- Removed bind mount `./data` to prevent permission denied errors
- Updated docker-compose.yml to use named volume for data persistence
- Updated Dockerfile entrypoint to handle permissions correctly

#### Build Fixes
- Fixed npm install issues by using `npm install` instead of `npm ci` in Dockerfile

---

# Original 9Router Changelog

## Unreleased

## Features
- Added API key visibility toggle (eye icon) to Endpoint dashboard page for improved UX and security.

# v0.2.66 (2026-02-06)

## Features
- Added Cursor provider end-to-end support, including OAuth import flow and translator/executor integration.
- Enhanced auth/settings flow with `requireLogin` control and `hasPassword` state handling in dashboard/login APIs.
- Improved usage/quota UX with richer provider limit cards, new quota table, and clearer reset/countdown display.
- Added model support for custom providers in UI/combos/model selection.
- Expanded model/provider catalog:
  - Codex updates: GPT-5.3 support, translation fixes, thinking levels
  - Added Claude Opus 4.6 model
  - Added MiniMax Coding (CN) provider
  - Added iFlow Kimi K2.5 model
  - Updated CLI tools with Droid/OpenClaw cards and base URL visibility improvements
- Added auto-validation for provider API keys when saving settings.
- Added Docker/runtime deployment docs and architecture documentation updates.

## Fixes
- Improved local-network compatibility by allowing auth cookie flow over HTTP deployments.
- Improved Antigravity quota/stream handling and Droid CLI compatibility behavior.
- Fixed GitHub Copilot model mapping/selection issues.
- Hardened local DB behavior with corrupt JSON recovery and schema-shape migration safeguards.
- Fixed logout/login edge cases.

# v0.2.56 (2026-02-04)

## Features
- Added Anthropic-compatible provider support across providers API/UI flow.
- Added provider icons to dashboard provider pages/lists.
- Enhanced usage tracking pipeline across response handlers/streams with buffered accounting improvements.

## Fixes
- Fixed usage conversion and related provider limits presentation issues.

# v0.2.52 (2026-02-02)

## Features
- Implemented Codex Cursor compatibility and Next.js 16 proxy migration updates.
- Added OpenAI-compatible provider nodes with CRUD/validation/test coverage in API and UI.
- Added token expiration and key-validity checks in provider test flow.
- Added Kiro token refresh support in shared token refresh service.
- Added non-streaming response translation support for multiple formats.
- Updated Kiro OAuth wiring and auth-related UI assets/components.

## Fixes
- Fixed cloud translation/request compatibility path.
- Fixed Kiro auth modal/flow issues.
- Included Antigravity stability fixes in translator/executor flow.

# v0.2.43 (2026-01-27)

## Fixes
- Fixed CLI tools model selection behavior.
- Fixed Kiro translator request handling.

# v0.2.36 (2026-01-19)

## Features
- Added the Usage dashboard page and related usage stats components.
- Integrated outbound proxy support in Open SSE fetch pipeline.
- Improved OpenAI compatibility and build stability across endpoint/profile/providers flows.

## Fixes
- Fixed combo fallback behavior.
- Resolved SonarQube findings, Next.js image warnings, and build/lint cleanups.

# v0.2.31 (2026-01-18)

## Fixes
- Fixed Kiro token refresh and executor behavior.
- Fixed Kiro request translation handling.

# v0.2.27 (2026-01-15)

## Features
- Added Kiro provider support with OAuth flow.

## Fixes
- Fixed Codex provider behavior.

# v0.2.21 (2026-01-12)

## Changes
- README updates.
- Antigravity bug fixes.
