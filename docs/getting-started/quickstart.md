# Quick Start

## 5 Minute Setup

### Step 1: Install & Run

```bash
npm install -g 9router
9router
```

Dashboard opens at `http://localhost:20128`

### Step 2: Connect a Provider

1. Go to **Dashboard → Providers**
2. Click **Connect** on a provider
3. Complete authentication (OAuth or API key)
4. Test the connection

**Recommended free providers:**
- **iFlow** - Unlimited free, no signup
- **Qwen** - Unlimited free, device auth
- **Gemini CLI** - 180K/month free

### Step 3: Configure Your CLI Tool

```
Endpoint: http://localhost:20128/v1
API Key: [copy from Dashboard → Endpoint]
Model: if/kimi-k2-thinking
```

### Step 4: Start Coding!

Your CLI tool will now route through 9Router.

## Configuration Examples

### Claude Code

```bash
export ANTHROPIC_BASE_URL=http://localhost:20128/v1
export ANTHROPIC_API_KEY=[your-api-key]
export ANTHROPIC_MODEL=if/kimi-k2-thinking
```

### Cline (VSCode)

1. Settings → API Provider → OpenAI Compatible
2. Base URL: `http://localhost:20128/v1`
3. API Key: [paste from dashboard]
4. Model: Select from list

### Cursor

1. Settings → Models → Enable "OpenAI API key"
2. Base URL: `http://localhost:20128/v1`
3. API Key: [paste from dashboard]
4. Add Custom Model: Select model

## Next Steps

- [Connect more providers](../guides/supported-providers.md)
- [Set up fallback combos](./combos.md)
- [Configure CLI tools](../guides/supported-cli-tools.md)
- [Enable MITM proxy](./mitm-proxy.md)
