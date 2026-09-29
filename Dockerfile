# syntax=docker/dockerfile:1
# Multi-stage build per l'Intranet (Next.js standalone)

# --- Base ---------------------------------------------------------------
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# --- Dipendenze ---------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# --- Build --------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Runner (produzione) ------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Utente non-root per sicurezza
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Cartella per i file caricati (montata su volume Docker), scrivibile dall'app.
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

# Output "standalone" generato da Next.js (vedi next.config.mjs)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
