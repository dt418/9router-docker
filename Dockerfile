# -------- Builder --------
FROM node:20-alpine AS builder

WORKDIR /app

# copy dependency files first (better cache)
COPY package.json package-lock.json* ./

# install dependencies - use npm install to avoid lock file version issues
RUN npm install --no-audit --no-fund

# copy source
COPY . .

# build next standalone
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# -------- Runner --------
FROM node:20-alpine AS runner

WORKDIR /app

LABEL org.opencontainers.image.title="9router"

ENV NODE_ENV=production
ENV PORT=20128
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# runtime data dir
RUN mkdir -p /app/data

# copy only runtime files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/open-sse ./open-sse
# Next file tracing can omit sibling files; MITM runs server.js as a separate process.
COPY --from=builder /app/src/mitm ./src/mitm
# Standalone node_modules may omit deps only required by the MITM child process.
COPY --from=builder /app/node_modules/node-forge ./node_modules/node-forge

RUN mkdir -p /app/data

# Fix permissions at runtime (handles mounted volumes)
RUN printf '#!/bin/sh\necho "Setting permissions..."\nls -la /app/data 2>/dev/null || true\nchown -R node:node /app/data 2>/dev/null || true\nchmod -R 755 /app/data 2>/dev/null || true\necho "Permissions set"\nexec su-exec node "$@"\n' > /entrypoint.sh && chmod +x /entrypoint.sh
RUN apk add --no-cache su-exec

EXPOSE 20128

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
