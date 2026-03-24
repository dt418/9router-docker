# Troubleshooting

## Connection Issues

### "Connection refused" error
- Make sure 9Router is running
- Check port (default: 20128)
- Try `curl http://localhost:20128/v1/models`

### "Invalid API key" error
1. Go to Dashboard → Endpoint
2. Copy the API key
3. Paste into your CLI tool settings

### "Model not found" error
- Check the model name matches Dashboard → Endpoint
- Try a different model

## Provider Issues

### OAuth login fails
- Clear browser cookies for the provider
- Try incognito mode
- Reconnect from Dashboard → Providers

### "Quota exceeded" error
- Provider ran out of quota
- 9Router should auto-fallback (if combo configured)
- Add another provider in Dashboard

### Token expired
- Reconnect the provider in Dashboard
- Some tokens expire after 24h

## Performance

### Slow responses
- Try a faster model (e.g., `if/kimi-k2-thinking`)
- Check Dashboard → Usage for latency
- Use local providers (iFlow)

### High memory usage
- Restart 9Router
- Check for large request logs in Dashboard

## Docker

### Container won't start
```bash
# Check logs
docker-compose logs -f

# Rebuild
docker-compose build --no-cache
docker-compose up -d
```

### Data persistence
Data is stored in `/var/lib/9router` inside container. Mount a volume to persist.

## Getting Help

- [GitHub Issues](https://github.com/dt418/9router-docker/issues)
- [Discord Community](#)
- [Email Support](#)
