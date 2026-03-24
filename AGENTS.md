# AGENTS.md – 9Router Developer Guide

This file provides guidance for AI coding agents operating in this repository.

---

## 1. Commands

### Development
```bash
npm run dev          # Start dev server on port 20128 (Next.js + webpack)
npm run dev:bun      # Alternative: dev with Bun runtime
```

### Build & Run
```bash
npm run build        # Production build
npm run start        # Start production server
npm run build:bun    # Build with Bun
npm run start:bun    # Start with Bun
```

### Linting
```bash
npx eslint .         # Lint entire project
npx eslint src/app/api/v1/chat/route.js  # Lint specific file
```

### Testing
```bash
npx vitest run               # Run all tests (vitest)
npx vitest run tests/unit/embeddingsCore.test.js  # Single test file
npx vitest run --reporter=verbose  # Verbose output
```

### Project Checker (Build + Test + Review)
```bash
./scripts/project-check.sh         # Build + Tests only
./scripts/project-check.sh --full  # Build + Lint + Tests
```

### Security Scripts
```bash
./scripts/rotate-secrets.sh        # Rotate JWT_SECRET, API_KEY_SECRET, MACHINE_ID_SALT
./scripts/reset-password.sh        # Reset INITIAL_PASSWORD (default/random/custom)
```

---

## 2. Project Overview

**9Router** is a local AI router/gateway that exposes a single OpenAI-compatible endpoint (`http://localhost:20128/v1`) and automatically routes requests across multiple AI providers (Claude, Codex, Gemini, Qwen, Kiro, OpenRouter, etc.) with smart fallback, multi-account quota management, and format translation.

### Architecture
```
Client → src/app/api/v1/* → open-sse/ → Upstream AI Providers
           ↓
Dashboard (Next.js) → localDb.js (lowdb) / usageDb.js (SQLite)
```

### Key Directories
- `src/app/api/` – API routes (Next.js Route Handlers)
- `src/app/(dashboard)/dashboard/` – Dashboard pages
- `open-sse/` – Local monorepo package (provider routing, format translation)
- `cloud/` – Optional Cloudflare Workers for multi-device sync
- `tests/` – Vitest test suite

---

## 3. Code Style Guidelines

### General
- **Language**: Pure JavaScript (ESNext modules), no TypeScript
- **No TypeScript** – Use JSDoc comments for complex types if needed
- Path alias `@/` maps to `src/`

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Functions/variables | camelCase | `getProvider()`, `isAuthenticated` |
| React components | PascalCase | `Header.js`, `ProviderCard` |
| Zustand stores | `use[Feature]Store` | `useProviderStore`, `useThemeStore` |
| Store files | `[feature]Store.js` | `providerStore.js` |

### Imports
```javascript
// Path alias (preferred)
import { Button } from "@/shared/components";
import { useProviderStore } from "@/store";

// Local relative (when @/ isn't appropriate)
import { getMachineId } from "@/shared/utils/machine";

// open-sse package
import { handleChatCore } from "open-sse/handlers/chatCore.js";
```

### React Patterns
- Client components: Start with `"use client"` directive
- Server Components: No directive (default in Next.js App Router)
- `useSearchParams` must be wrapped in `<Suspense>`:
```javascript
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <ClientComponent />
    </Suspense>
  );
}
```

### API Routes (Route Handlers)
```javascript
// src/app/api/providers/route.js
import { NextResponse } from "next/server";

export async function GET(request) {
  // Next.js 15+: await params
  const data = await getData();
  return NextResponse.json(data);
}

export async function POST(request) {
  const body = await request.json();
  // ... handle POST
  return NextResponse.json({ success: true });
}
```

### Response Shape
```javascript
// Management APIs
{ success: true, data: { ... } }  // success
{ error: "message" }               // failure

// Compatibility routes (/v1/*)
OpenAI-compatible JSON or streaming response
```

### Error Handling
- Use `try/catch` in all async handlers
- Return proper HTTP status codes: `400` (bad request), `401` (unauthorized), `404` (not found), `500` (server error)
- Log errors with `console.error()` for debugging

### Zustand Stores
```javascript
// src/store/providerStore.js
"use client";
import { create } from "zustand";

const useProviderStore = create((set) => ({
  providers: [],
  setProviders: (providers) => set({ providers }),
  addProvider: (provider) => set((state) => ({
    providers: [...state.providers, provider]
  })),
}));

export default useProviderStore;
```

---

## 4. Middleware & Authentication

- **Middleware**: `src/dashboardGuard.js` (named "proxy" in Next.js 16)
- **Auth cookie**: `auth_token` (JWT, httpOnly, secure)
- **Logout**: API at `/api/auth/logout` clears cookie via `maxAge: 0`

---

## 5. Provider / Account Fallback

Fallback is a **core feature** – do not remove or short-circuit it:
1. **Account-level**: Try account 1 → account 2 → … within a provider
2. **Provider-level**: Use a *combo* (ordered list of models/providers)
3. **Format translation**: Auto-detect incoming format (OpenAI / Claude / Codex), translate to provider format, translate response back

---

## 6. Data Persistence

| File | Technology | Location |
|------|------------|----------|
| Provider connections, API keys, settings | lowdb (JSON) | `data/db.json` |
| Request logs, usage tracking | better-sqlite3 | `data/usage.db` |

Set `DATA_DIR` env var to override, defaults to `./data` (Docker: `/var/lib/9router`).

---

## 7. Testing Guidelines

- Tests live in `tests/` with own `package.json` and `vitest.config.js`
- Mock data alongside test files
- Run single test: `npx vitest run tests/unit/filename.test.js`

---

## 8. Next.js Best Practices

- **Runtime**: Default to Node.js; use Edge only when appropriate
- **Data fetching**: Server Components for initial data, Server Actions for mutations
- **Avoid waterfalls**: Use `Promise.all()` or Suspense for parallel data fetching
- **Images**: Always use `next/image`, configure remote patterns in `next.config.mjs`
- **Fonts**: Use `next/font` for optimized loading

---

## 9. What NOT To Do

- Don't add TypeScript without team approval
- Don't remove account/provider fallback logic
- Don't change auth cookie name without updating all related code
- Don't use `localStorage` for auth tokens (use httpOnly cookies)
- Don't skip Suspense boundary when using `useSearchParams`
