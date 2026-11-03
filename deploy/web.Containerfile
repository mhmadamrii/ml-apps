# One image recipe for every TanStack Start app in the monorepo.
#   podman build -f deploy/web.Containerfile --build-arg APP=adano -t adano-web .
# Context must be the repo root (pnpm workspace + catalog + packages/ui).
ARG NODE_IMAGE=docker.io/library/node:24-slim

FROM ${NODE_IMAGE} AS base
ARG APP
RUN test -n "$APP" || (echo "build-arg APP is required (e.g. adano, fraudless)" >&2; exit 1)
RUN npm install -g pnpm@12.11.2
WORKDIR /repo
# Manifests first: the dependency layer is rebuilt only when dependencies change.
# Every workspace manifest is needed so the frozen lockfile matches the workspace.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/adano/package.json apps/adano/
COPY apps/fraudless/package.json apps/fraudless/
COPY packages/ui/package.json packages/ui/

FROM base AS build
RUN pnpm install --frozen-lockfile --filter "${APP}..."
COPY packages/ui packages/ui
COPY apps/${APP} apps/${APP}
RUN pnpm --filter "${APP}" build

FROM base AS runtime
ARG APP
ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile --prod --filter "${APP}..."
COPY packages/ui packages/ui
COPY --from=build /repo/apps/${APP}/dist apps/${APP}/dist
WORKDIR /repo/apps/${APP}
USER node
EXPOSE 3000
# srvx serves dist/client statically and hands everything else to the SSR fetch handler
CMD ["node_modules/.bin/srvx", "serve", "--prod", "--entry", "dist/server/server.js", "--static", "../client", "--host", "0.0.0.0", "--port", "3000"]
