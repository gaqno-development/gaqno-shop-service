FROM node:20-alpine AS builder
WORKDIR /app

ARG NPM_TOKEN
COPY package*.json ./
COPY .npmrc* ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

RUN if [ -n "$NPM_TOKEN" ]; then echo "//npm.pkg.github.com/:_authToken=$NPM_TOKEN" >> .npmrc 2>/dev/null || true; fi
RUN npm config set fetch-timeout 1200000 && \
    npm config set fetch-retries 10 && \
    npm install --legacy-peer-deps --ignore-scripts --include=dev

ARG GAQNO_CACHE_BUST
RUN npm update @gaqno-development/backcore @gaqno-development/types --legacy-peer-deps 2>/dev/null || true

COPY src ./src

RUN npx nest build

FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache wget
ARG NPM_TOKEN
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.npmrc* ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/database/migrations ./dist/database/migrations

RUN if [ -n "$NPM_TOKEN" ]; then echo "//npm.pkg.github.com/:_authToken=$NPM_TOKEN" >> .npmrc 2>/dev/null || true; fi
RUN npm config set fetch-timeout 1200000 && \
    npm config set fetch-retries 10 && \
    npm install --omit=dev --legacy-peer-deps --ignore-scripts

ENV NODE_ENV=production
ENV PORT=4017
EXPOSE 4017
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:4017/v1/health" || exit 1
CMD ["node", "dist/main.js"]
