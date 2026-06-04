FROM node:22-alpine AS base
RUN npm install -g pnpm

FROM base AS installer
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM installer AS builder
ARG VITE_VAPID_PUBLIC_KEY
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY
COPY packages/types ./packages/types
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web
RUN pnpm --filter @eolas/types build
RUN pnpm --filter @eolas/ui build
RUN pnpm --filter @eolas/web build

FROM nginx:alpine AS runner
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf.template /etc/nginx/conf.d/default.conf.template
EXPOSE 80
# Substitute $API_INTERNAL_URL into the nginx config at container startup
CMD ["/bin/sh", "-c", "envsubst '${API_INTERNAL_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
