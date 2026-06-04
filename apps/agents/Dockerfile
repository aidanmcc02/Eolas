FROM node:22-alpine AS base
RUN npm install -g pnpm

FROM base AS installer
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/agents/package.json ./apps/agents/package.json
RUN pnpm install --frozen-lockfile

FROM installer AS builder
COPY packages/types ./packages/types
COPY apps/agents ./apps/agents
RUN pnpm --filter @eolas/types build
RUN pnpm --filter @eolas/agents build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /repo/apps/agents/dist ./dist
COPY --from=builder /repo/apps/agents/package.json ./package.json
COPY --from=builder /repo/node_modules ./node_modules
CMD ["node", "dist/index.js"]
