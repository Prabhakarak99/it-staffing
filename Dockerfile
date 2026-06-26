# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# better-sqlite3 is a native module — needs build tools
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Generate Prisma client and build Next.js
RUN npx prisma generate
RUN npm run build

# ── Stage 2: Production runner ─────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app
ENV NODE_ENV=production

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Next.js app
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

# Node modules (includes compiled better-sqlite3 native binary)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Prisma files needed for migrate deploy at startup
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated

# Startup script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
