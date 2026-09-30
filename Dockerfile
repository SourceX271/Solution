# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# `npm ci` runs the `postinstall` hook (prisma generate), which needs the schema
# file and a resolvable datasource URL to already be present.
ENV DATABASE_URL="file:/app/prisma/build.db"
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

COPY . .

# Schema/bootstrap database for the runtime image. The standalone output ships
# no Prisma CLI, so the schema is applied here and snapshotted for the
# entrypoint to copy into the data volume on first boot.
RUN npx prisma generate
RUN npx prisma db push --skip-generate --accept-data-loss

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
# Alpine's python3 installs into /usr, while the crawler deps were installed by
# the python:3.12-alpine image into /usr/local — make them importable.
ENV PYTHONPATH=/usr/local/lib/python3.12/site-packages
ENV PYTHONUNBUFFERED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma/build.db ./prisma-template.db
COPY --from=crawler-deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY crawler ./crawler
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Named volumes inherit ownership from the image path they are mounted over, so
# these directories must exist and be writable by the unprivileged runtime user
# (the SQLite database and uploaded avatars both live here).
RUN mkdir -p /app/data /app/public/uploads/avatars \
  && chown -R nextjs:nodejs /app/data /app/public /app/prisma /app/prisma-template.db /app/crawler

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
CMD ["node", "server.js"]
