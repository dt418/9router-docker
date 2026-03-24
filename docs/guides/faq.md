# Frequently Asked Questions

## General

### What is 9Router?
9Router is a local AI router that exposes a single OpenAI-compatible endpoint and automatically routes requests across multiple AI providers with smart fallback.

### Is it free?
The software is free. Some AI providers have free tiers, others are paid. You only pay for the AI providers you use.

### How does fallback work?
When one provider fails or runs out of quota, 9Router automatically tries the next provider in your configured combo.

## Installation

### npm install fails?
```bash
# Try with sudo
sudo npm install -g 9router

# Or use npx
npx 9router
```

### Port already in use?
```bash
# Find what's using port 20128
lsof -i :20128

# Use a different port
PORT=3000 9router
```

## Configuration

### How to get API key?
1. Open Dashboard at `http://localhost:20128/dashboard`
2. Go to **Endpoint** page
3. Click the key icon to reveal your API key

### Which model should I use?
Start with `if/kimi-k2-thinking` (free, fast). For higher quality, try `claude-sonnet-4-20250514`.

## Troubleshooting

### CLI tool not connecting?
1. Check endpoint is correct: `http://localhost:20128/v1`
2. Verify API key matches dashboard
3. Check Dashboard → Usage for errors

### Provider auth issues?
Some OAuth providers expire tokens. Reconnect from Dashboard → Providers.

See also: [Troubleshooting](./troubleshooting.md)
