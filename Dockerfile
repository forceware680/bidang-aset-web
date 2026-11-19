# syntax=docker/dockerfile:1

# Build pakai Debian slim (bukan Alpine) supaya binary Prisma engine target linux-openssl
# cocok tanpa perlu binary musl.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl postgresql-client \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Static standalone tidak membawa folder public; logo dipakai di sidebar, login, dan kop cetak.
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/db/schema.sql ./db/schema.sql

# Lampiran disimpan di folder ini; di Coolify folder ini sebaiknya dipetakan ke volume.
RUN mkdir -p uploads && chown -R node:node /app
USER node

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
