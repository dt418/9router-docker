# Combos & Fallback

Combos let you configure automatic fallback between providers.

## Why Use Combos?

- **Never stop coding** - Auto-fallback when quota exhausted
- **Cost optimization** - Use cheap/free before expensive
- **Reliability** - Multiple accounts per provider

## Creating a Combo

1. Go to **Dashboard → Combos**
2. Click **Add Combo**
3. Add providers in priority order:
   ```
   1. gc/gemini-3-flash (180K/month free)
   2. if/kimi-k2-thinking (unlimited free)
   3. qw/qwen3-coder-plus (unlimited free)
   ```
4. Save and use as default

## Fallback Order

```
Request → [Tier 1] → Fail → [Tier 2] → Fail → [Tier 3]
              ↓            ↓            ↓
         Claude Code    GLM MiniMax   iFlow
         Gemini CLI     Kimi          Qwen
         Codex          DeepSeek      Kiro
```

## Multi-Account Fallback

Add multiple accounts per provider:

1. Go to **Dashboard → Providers**
2. Connect same provider multiple times
3. 9Router will round-robin between accounts

## Example Combos

### Maximum Free

```yaml
1. gc/gemini-3-flash      # 180K/month
2. if/kimi-k2-thinking    # Unlimited
3. qw/qwen3-coder-plus   # Unlimited
```

### Quality First

```yaml
1. cc/claude-opus-4-6    # Subscription
2. cx/codex-sonnet-4     # Subscription  
3. ds/deepseek-coder     # Cheap backup
```

### Budget

```yaml
1. glm/glm-4-flash       # ~$0.4/1M
2. minimax/minimax-coder # ~$0.2/1M
3. if/kimi-k2-thinking   # Free
```

## Related

- [Supported Providers](./supported-providers.md)
- [CLI Tools](./supported-cli-tools.md)
