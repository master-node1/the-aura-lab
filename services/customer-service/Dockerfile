# ─────────────────────────────────────────────────────────────────────────────
# customer-service — NestJS multi-stage build
# Pattern matches auth/chat/memory/companion/analytics/identity/authorization.
# Customer-service has no src/ yet; this Dockerfile will succeed once code lands.
# ─────────────────────────────────────────────────────────────────────────────

# ---------- Stage 1: build ----------
FROM node:20-slim AS builder

# Prisma engines need OpenSSL at build/runtime
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps with cache-friendly layering
COPY package.json package-lock.json* ./
COPY .npmrc* ./
RUN npm install --no-audit --no-fund

# Generate client from schema (fails gracefully if prisma/ not yet present)
COPY prisma ./prisma
RUN if [ -f prisma/schema.prisma ]; then npx prisma generate; fi

# Build TS -> dist/
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && \
    if [ -f prisma/schema.prisma ]; then npx prisma generate; fi

# Prune dev dependencies for the runner image
RUN npm prune --omit=dev


# ---------- Stage 2: runner ----------
FROM node:20-slim AS runner

RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Run as non-root
USER node

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package.json ./package.json

EXPOSE 3000

# Migrations are idempotent; safe to run on every boot.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]