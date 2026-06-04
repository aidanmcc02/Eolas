FROM node:22-alpine AS base
RUN npm install -g pnpm

FROM base AS installer
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --frozen-lockfile

FROM installer AS builder
COPY packages/types ./packages/types
COPY apps/api ./apps/api
RUN pnpm --filter @eolas/types build
RUN pnpm --filter @eolas/api build
# Create a standalone deployment folder with all prod deps flattened (no symlinks)
RUN pnpm --filter @eolas/api deploy --prod /deploy

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /deploy .
COPY --from=builder /repo/apps/api/drizzle ./drizzle
EXPOSE 3001
CMD ["node", "dist/index.js"]
