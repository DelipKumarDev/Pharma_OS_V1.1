# PharmaOS Web — Next.js 15
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
RUN pnpm install --frozen-lockfile --filter web...

FROM deps AS build
COPY packages ./packages
COPY apps/web ./apps/web
# API URL is baked at build time for the browser bundle
ARG NEXT_PUBLIC_API_URL=/
ARG NEXT_PUBLIC_USE_REAL_API=true
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_USE_REAL_API=$NEXT_PUBLIC_USE_REAL_API \
    NEXT_TELEMETRY_DISABLED=1
RUN cd apps/web && pnpm build

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/package.json /app/apps/web/next.config.ts ./apps/web/

# Next writes to .next/cache at runtime (ISR) — give the non-root user ownership.
RUN chown -R node:node /app/apps/web/.next

WORKDIR /app/apps/web
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/login || exit 1

CMD ["npx", "next", "start", "-p", "3000"]
