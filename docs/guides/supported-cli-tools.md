# Supported CLI Tools

9Router works with any CLI tool that supports OpenAI-compatible endpoints.

## CLI Tools (Direct Endpoint)

| Tool | Config Type | Description |
|------|-------------|-------------|
| Claude Code | env | Anthropic's CLI - set environment variables |
| Open Claw | custom | Open source AI assistant |
| OpenAI Codex | custom | OpenAI's CLI tool |
| OpenCode | custom | OpenCode terminal assistant |
| Factory Droid | custom | Factory's AI assistant |

## IDE Tools (Guide-based Setup)

| Tool | Provider | Notes |
|------|----------|-------|
| Cursor | openai | Requires Pro account |
| Cline | openai | VSCode extension |
| Kilo Code | openai | Kilo Code IDE |
| Roo | ollama | Roo Code editor |
| Continue | openai | VSCode/JetBrains extension |

## MITM Proxy Tools

These tools can be intercepted via 9Router's built-in MITM proxy:

| Tool | Domain | Models |
|------|--------|--------|
| Antigravity | daily-cloudcode-pa.googleapis.com | Claude, Gemini, GPT |
| GitHub Copilot | api.individual.githubcopilot.com | GPT models |
| Kiro | q.us-east-1.amazonaws.com | Claude, DeepSeek |

## Configuration

### Direct Configuration

```
Endpoint: http://localhost:20128/v1
API Key: [copy from 9Router Dashboard → Endpoint]
Model: if/kimi-k2-thinking (or any available model)
```

### Claude Code

```bash
# Set environment variables
export ANTHROPIC_BASE_URL=http://localhost:20128/v1
export ANTHROPIC_API_KEY=[your-api-key]
export ANTHROPIC_MODEL=if/kimi-k2-thinking
```

### Cline / Cursor / Kilo Code

1. Open tool settings
2. Select "OpenAI Compatible API"
3. Base URL: `http://localhost:20128/v1`
4. API Key: Copy from Dashboard
5. Select model from dropdown

## Recommended Models

| Model | Provider | Use Case |
|-------|----------|----------|
| if/kimi-k2-thinking | iFlow | Fast, free |
| cc/claude-sonnet-4-6 | Claude Code | High quality |
| qw/qwen3-coder-plus | Qwen | Code-focused |
| gc/gemini-2.5-flash | Gemini CLI | Balanced |

## Related

- [Quick Start](../getting-started/quickstart.md)
- [Supported Providers](./supported-providers.md)
