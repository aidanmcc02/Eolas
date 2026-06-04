FROM node:22-alpine AS base
RUN npm install -g pnpm

FROM base AS installer
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM installer AS builder
COPY packages/types ./packages/types
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @eolas/types build
RUN pnpm --filter @eolas/ui build
RUN pnpm --filter @eolas/web build

FROM nginx:alpine AS runner
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
