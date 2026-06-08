# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Python Crawler Stage ----
FROM python:3.12-alpine AS crawler-deps
WORKDIR /crawler
COPY crawler/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- Production Stage ----
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache python3 py3-pip

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=crawler-deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY crawler ./crawler

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
