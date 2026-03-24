# Installation

## npm (Recommended)

```bash
npm install -g 9router
9router
```

Dashboard opens at `http://localhost:20128`

## Docker

```bash
# Clone and run
docker-compose up -d
```

Access at `http://localhost:20128`

## From Source

```bash
# Clone repository
git clone https://github.com/dt418/9router-docker.git
cd 9router-docker

# Setup environment
cp .env.example .env

# Install dependencies
npm install

# Development
PORT=20128 NEXT_PUBLIC_BASE_URL=http://localhost:20128 npm run dev

# Production build
npm run build

# Production run
PORT=20128 HOSTNAME=0.0.0.0 NEXT_PUBLIC_BASE_URL=http://localhost:20128 npm run start
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 20128 | Server port |
| JWT_SECRET | - | Auth secret (change in production) |
| DATA_DIR | ./data | Data storage directory |
| AUTH_COOKIE_SECURE | true | Cookie security setting |

## Default URLs

- Dashboard: `http://localhost:20128/dashboard`
- OpenAI API: `http://localhost:20128/v1`
- API Docs: `http://localhost:20128/docs` (if enabled)

## Related

- [Quick Start](./quickstart.md)
- [Setup Guide](../guides/setup.md)
- [Troubleshooting](../guides/troubleshooting.md)
