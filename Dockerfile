# -------- Builder --------
FROM node:25-alpine AS builder

WORKDIR /app

# copy dependency files first (better cache)
COPY package.json package-lock.json* ./

# install dependencies - use npm install to avoid lock file version issues
RUN npm install --no-audit --no-fund && npm cache clean --force

# copy source
COPY . .

# build next standalone
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# -------- Runner --------
FROM node:25-alpine AS runner

WORKDIR /app

LABEL org.opencontainers.image.title="9router"

ENV NODE_ENV=production
ENV PORT=20128
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# runtime data dir
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# copy only runtime files
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/open-sse ./open-sse
# Next file tracing can omit sibling files; MITM runs server.js as a separate process.
COPY --from=builder --chown=nextjs:nodejs /app/src/mitm ./src/mitm
# Standalone node_modules may omit deps only required by the MITM child process.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/node-forge ./node_modules/node-forge

RUN mkdir -p /app/data

# Fix permissions at runtime (handles mounted volumes)
RUN printf '#!/bin/sh\necho "Setting permissions..."\nls -la /app/data 2>/dev/null || true\nchown -R nextjs:nodejs /app/data 2>/dev/null || true\nchmod -R 755 /app/data 2>/dev/null || true\necho "Permissions set"\nexec "$@"\n' > /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 20128

USER 1001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q --spider -O /dev/null http://127.0.0.1:20128 || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
