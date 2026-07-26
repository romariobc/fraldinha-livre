# syntax=docker/dockerfile:1
# Contexto de build = RAIZ do monorepo. Rode a partir da raiz do repo:
#   docker build -f front/Dockerfile -t fraldinha-livre-frontend .

FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
COPY front/package.json front/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci

COPY front front
COPY packages/contracts packages/contracts

WORKDIR /app/front
RUN npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Caminho verificado nesta sessao com um build real: a saida standalone aninha
# por "front/" porque outputFileTracingRoot aponta pra raiz do monorepo.
COPY --from=builder /app/front/.next/standalone/front ./
COPY --from=builder /app/front/.next/static ./.next/static
COPY --from=builder /app/front/public ./public

EXPOSE 8080
CMD ["node", "server.js"]
