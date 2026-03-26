# 9Router – Copilot Instructions

## What This Project Does

9Router is a local AI router/gateway that exposes a single OpenAI-compatible endpoint (`http://localhost:20128/v1`) and automatically routes requests across multiple AI providers (Claude, Codex, Gemini, Qwen, Kiro, OpenRouter, etc.) with smart fallback, multi-account quota management, and format translation. It runs as both a web dashboard (Next.js) and a globally-installed npm package (`9router`).

## Commands

```bash
# Development
npm run dev          # Start dev server on port 20128 (Next.js + webpack)
npm run dev:bun      # Alternative: dev with Bun runtime

# Build & run
npm run build
npm run start

# Lint
npx eslint .

# Tests (must cd into tests/ first)
cd tests && npm test              # Run full suite (vitest)
cd tests && npm run test:watch    # Watch mode
cd tests && NODE_PATH=/tmp/node_modules vitest tests/unit/embeddingsCore.test.js  # Single test
```

## Architecture

```
Client (Claude Code / Cursor / Cline / etc.)
    ↓ HTTP to localhost:20128/v1/*
src/app/api/v1/*          ← Compatibility routes (OpenAI / Claude / Codex / Gemini formats)
    ↓
src/sse/handlers/chat.js  ← Core streaming handler: format detection, model resolution,
                             credential selection, account fallback, token refresh
    ↓
open-sse/                 ← Local monorepo package: provider routing, format translation,
                             error utilities (shared with npm package)
    ↓
Upstream AI Providers     ← OAuth: Claude, Codex, Gemini, Cursor, Kiro, GitHub, Qwen, iFlow
                             API Key: OpenAI, Anthropic, OpenRouter, GLM, Kimi, MiniMax
```

**Persistence:**
- `src/lib/localDb.js` — lowdb JSON (`data/db.json`): provider connections, API keys, aliases, combos, settings
- `src/lib/usageDb.js` — better-sqlite3 (`data/usage.db`): request logs, usage tracking

**Dashboard** (`src/app/(dashboard)/dashboard/*`) reads/writes data via management APIs (`src/app/api/*`), which call `localDb.js` directly.

**Middleware** (`src/middleware.js` / `src/dashboardGuard.js`) protects all dashboard routes with JWT stored in the `auth_token` cookie.

**Cloud sync** (`cloud/`) is an optional Cloudflare Workers endpoint for multi-device sync.

## Key Conventions

### File/Module Layout
- Path alias `@/` maps to `src/`
- `open-sse` is a local package resolved via `jsconfig.json` paths — import it as `import ... from 'open-sse'` or `from 'open-sse/...'`
- API routes export named HTTP methods: `export async function GET(request) {}`, `POST`, `DELETE`, `PATCH`
- Client components begin with `"use client"`
- Zustand stores live in `src/store/[feature]Store.js` and are exported from `src/store/index.js`

### Naming
- Functions and variables: `camelCase`
- React components: `PascalCase`
- Zustand hooks: `use[Feature]Store` (e.g., `useProviderStore`, `useThemeStore`)
- Store files: `[feature]Store.js`

### API Response Shape
Management APIs return:
```js
{ success: true, data: { ... } }   // success
{ error: "message" }               // failure
```
Compatibility routes (`/v1/*`) stream or return OpenAI-compatible JSON.

### Provider / Account Fallback
Fallback is a core feature — don't remove or short-circuit it:
1. **Account-level**: Try account 1 → account 2 → … within a provider
2. **Provider-level**: Use a *combo* (ordered list of models/providers) defined by the user
3. **Format translation**: Auto-detect incoming format (OpenAI / Claude / Codex), translate to provider format, translate response back

### OAuth Services
Each provider has its own adapter in `src/lib/oauth/services/`. Token refresh is orchestrated by `src/sse/services/tokenRefresh.js`. Always use these adapters rather than calling provider OAuth endpoints directly.

### Data Directory
Runtime data (`db.json`, `usage.db`, logs) is stored in the directory pointed to by `DATA_DIR` env var, defaulting to `./data`. In Docker, this maps to `/var/lib/9router`.

### No TypeScript
The project is pure JavaScript (ESNext modules). `jsconfig.json` provides editor path resolution only.

### Testing
Tests are in a separate `tests/` package with its own `package.json` and `vitest.config.js`. Mock data and fixtures live alongside the test files. `NODE_PATH=/tmp/node_modules` is used in watch mode to resolve the parent project's dependencies.


<!-- localskills:start:puODsXk3vw -->
## puODsXk3vw

---
name: mermaid-validator
description: Validate Mermaid diagrams in markdown files using @probelabs/maid. Use when user asks to validate mermaid, check diagrams, or validate markdown documentation.
version: 1.0.2
author: dt418
license: MIT
tags:
  - mermaid
  - diagram
  - validation
  - markdown
  - documentation
platforms:
  - opencode
  - claude
  - cursor
  - codex
  - windsurf
  - copilot
tools:
  - Bash
  - Read
  - Grep
---

# Mermaid Validator

Validate Mermaid diagrams in markdown files using @probelabs/maid for GitHub-compatible rendering.

## When to Use

- User asks to "validate mermaid", "check diagrams", or "validate markdown"
- Before committing markdown files with mermaid diagrams
- During code review of documentation changes

## Workflow

### 1. Find & Validate

```bash
# Install if needed
npm ls @probelabs/maid || npm install -D @probelabs/maid

# Validate single file
npx @probelabs/maid <file>

# Validate all docs
find docs -name "*.md" | xargs -I{} npx @probelabs/maid "{}"
```

### 2. Common Fixes

| Issue | Invalid | Valid |
|-------|---------|-------|
| Pipe in label | `A[text\|desc]` | `A["text\|desc"]` |
| Parentheses | `A[Name (X)]` | `A["Name (X)"]` |
| Leading slash | `A[/path]` | `A["/path"]` |
| Arrow syntax | `A -> B` | `A --> B` |
| Arrow in label | `A[text -> val]` | `A["text to val"]` |
| Brackets | `A[items[]]` | `A["items[]"]` |

**Rule:** When in doubt, wrap labels in double quotes: `A["any text here"]`

### 3. Quick Fix All

```bash
# Auto-fix common issues
npx @probelabs/maid "docs/**/*.md" --fix
```

## Exit Codes

- `0` - All diagrams valid
- `1` - Validation errors found

## Integration

### GitHub Actions
```yaml
- run: npx @probelabs/maid "docs/**/*.md"
```

### Lefthook
```yaml
mermaid-check:
  glob: "docs/**/*.md"
  run: npx @probelabs/maid {staged_files}
```

## Notes

- @probelabs/maid is stricter than GitHub's renderer
- Some warnings (e.g. sequence diagram activation) are acceptable
- Always validate before committing markdown with diagrams

<!-- localskills:end:puODsXk3vw -->
