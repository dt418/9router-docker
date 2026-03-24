# syntax=docker/dockerfile:1.4

# ============================================================
# STAGE 1: Builder - build the application
# ============================================================
FROM node:25-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDependencies for build)
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ============================================================
# STAGE 2: Production Runner - minimal, secure image
# ============================================================
FROM node:25-alpine AS runner

WORKDIR /app

LABEL org.opencontainers.image.title="9router" \
      org.opencontainers.image.description="9Router - Local AI Router" \
      org.opencontainers.image.version="0.3.61"

# Set production environment
ENV NODE_ENV=production \
    PORT=20128 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Security: Create non-root user with specific UID/GID
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Create directories with proper ownership
RUN mkdir -p /app/data /app/logs && \
    chown -R nextjs:nodejs /app

# Copy only necessary files from builder
# Using --chown for security (ownership set during copy)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/open-sse ./open-sse
COPY --from=builder --chown=nextjs:nodejs /app/src/mitm ./src/mitm
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/node-forge ./node_modules/node-forge

# Create entrypoint script for permission handling on startup
COPY --chown=nextjs:nodejs <<'EOF' /entrypoint.sh
#!/bin/sh
set -e

# Handle mounted volumes with proper permissions
if [ -d /app/data ]; then
    chown -R nextjs:nodejs /app/data 2>/dev/null || true
    chmod -R 755 /app/data 2>/dev/null || true
fi

if [ -d /app/logs ]; then
    chown -R nextjs:nodejs /app/logs 2>/dev/null || true
    chmod -R 755 /app/logs 2>/dev/null || true
fi

# Execute the main process
exec "$@"
EOF
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 20128

# Switch to non-root user
USER nextjs

# Health check with more comprehensive testing
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -q --spider -O /dev/null http://127.0.0.1:20128/api/version || exit 1

# Entrypoint with startup script
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]