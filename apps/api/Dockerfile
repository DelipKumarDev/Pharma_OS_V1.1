# PharmaOS API — Express + Prisma
FROM node:20-alpine AS base
RUN corepack enable && apk add --no-cache postgresql-client openssl
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
RUN pnpm install --frozen-lockfile --filter @pharmaos/api...

FROM deps AS build
COPY packages ./packages
COPY apps/api ./apps/api
RUN cd apps/api && pnpm prisma generate && pnpm build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/

WORKDIR /app/apps/api
EXPOSE 4000
# Run pending migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
