# -------- Builder --------
FROM node:20-alpine AS builder

WORKDIR /app

# copy dependency files first (better cache)
COPY package.json package-lock.json* ./

# install dependencies
RUN if [ -f package-lock.json ]; then \
      echo "Using npm ci"; \
      npm ci --include=dev --no-audit --no-fund; \
    else \
      echo "No lockfile, using npm install"; \
      npm install --no-audit --no-fund; \
    fi

# copy source
COPY . .

# build next standalone
RUN npm run build


# -------- Runner --------
FROM node:20-alpine AS runner

WORKDIR /app

LABEL org.opencontainers.image.title="9router"

ENV NODE_ENV=production
ENV PORT=20128
ENV HOSTNAME=0.0.0.0

# runtime data dir
RUN mkdir -p /app/data

# copy only runtime files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/open-sse ./open-sse

EXPOSE 20128

CMD ["node", "server.js"]