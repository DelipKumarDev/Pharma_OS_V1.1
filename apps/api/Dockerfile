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

# Create writable runtime dirs and hand ownership to the non-root 'node' user
# (uid 1000, present in the official node image). Named volumes mounted at these
# paths inherit node ownership on first use.
RUN mkdir -p /app/apps/api/logs /app/apps/api/uploads /backups \
 && chown -R node:node /app /backups

WORKDIR /app/apps/api
USER node
EXPOSE 4000

# Container liveness — orchestrator restarts the container if this fails.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

# Apply pending migrations, then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
