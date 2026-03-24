# Supported Providers

9Router supports 40+ AI providers across multiple authentication methods.

## Free Providers (No API Key Required)

| Provider | Alias | Notes |
|----------|-------|-------|
| iFlow AI | if | OAuth - unlimited free |
| Qwen Code | qw | Device auth - unlimited free |
| Gemini CLI | gc | OAuth - 180K/month free |
| Kiro AI | kr | AWS Builder ID - unlimited free |

## OAuth Providers

| Provider | Alias | Notes |
|----------|-------|-------|
| Claude Code | cc | Anthropic account required |
| Antigravity | ag | Google account required |
| OpenAI Codex | cx | OpenAI account required |
| GitHub Copilot | gh | GitHub account required |
| Cursor IDE | cu | Cursor Pro account |
| Kilo Code | kc | OAuth available |
| Cline | cl | OAuth available |

## API Key Providers

### Premium
| Provider | Alias | Website |
|----------|-------|---------|
| OpenAI | openai | platform.openai.com |
| Anthropic | anthropic | console.anthropic.com |
| Gemini | gemini | ai.google.dev |
| Claude (Direct) | cc | anthropic.com |

### Budget APIs
| Provider | Alias | Notes |
|----------|-------|-------|
| GLM | glm | ~$0.6/1M tokens |
| GLM (China) | glm-cn | For China users |
| Kimi | kimi | ByteDance |
| MiniMax | minimax | ~$0.2/1M tokens |
| MiniMax (China) | minimax-cn | For China users |
| Alibaba | alicode | Alibaba Cloud |
| Alibaba Intl | alicode-intl | International |

### Open Source / Cheap
| Provider | Alias | Notes |
|----------|-------|-------|
| DeepSeek | ds | Great quality/price |
| Groq | groq | Fast inference |
| xAI (Grok) | xai | Elon Musk's AI |
| Mistral | mistral | Open source models |
| Perplexity | pplx | Search-focused |

### Aggregators
| Provider | Alias | Notes |
|----------|-------|-------|
| OpenRouter | openrouter | 100+ models |
| Together AI | together | Open source models |
| Fireworks AI | fireworks | Fast inference |
| Cerebras | cerebras | Fastest inference |
| Cohere | cohere | Enterprise AI |
| NVIDIA NIM | nvidia | NVIDIA GPUs |
| Nebius AI | nebius | NVIDIA GPUs |
| SiliconFlow | siliconflow | China-friendly |
| Hyperbolic | hyperbolic | GPU marketplace |

### Specialized
| Provider | Alias | Notes |
|----------|-------|-------|
| Deepgram | dg | Speech-to-text |
| AssemblyAI | aai | Speech-to-text |
| Ollama Cloud | ollama | Open source models |
| Ollama Local | ollama-local | Local models |
| Vertex AI | vx | Google Cloud |
| Vertex Partner | vxp | Google Cloud partners |
| NanoBanana | nb | Image generation |
| Chutes AI | ch | AI inference |

## Provider Fallback

Configure automatic fallback in **Dashboard → Combos**:

```
Tier 1: Subscription → Claude Code, Codex, Gemini CLI
Tier 2: Cheap API → GLM, MiniMax, Kimi  
Tier 3: Free → iFlow, Qwen, Kiro
```

## Related

- [Quick Start](../getting-started/quickstart.md)
- [CLI Tools](./supported-cli-tools.md)
- [Combos & Fallback](./combos.md)
