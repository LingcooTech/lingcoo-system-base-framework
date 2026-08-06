ARG NODE_BASE_IMAGE=node:22-alpine

FROM ${NODE_BASE_IMAGE} AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/reference-system/package.json ./apps/reference-system/
COPY apps/reference-admin/package.json ./apps/reference-admin/
COPY apps/reference-web/package.json ./apps/reference-web/
COPY fixtures/example-extension/package.json ./fixtures/example-extension/
COPY packages/database/package.json ./packages/database/
COPY packages/design-tokens/package.json ./packages/design-tokens/
COPY packages/extension-sdk/package.json ./packages/extension-sdk/
COPY packages/admin-shell/package.json ./packages/admin-shell/
COPY packages/cms/package.json ./packages/cms/
COPY packages/frame/package.json ./packages/frame/
COPY packages/ui/package.json ./packages/ui/
COPY packages/web-shell/package.json ./packages/web-shell/
RUN npm ci

FROM dependencies AS build
COPY . .
RUN npm run build:all
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
ARG APP_VERSION=development
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    API_HOST=0.0.0.0 \
    API_PORT=8090

WORKDIR /app
RUN addgroup -S lingcoo && adduser -S lingcoo -G lingcoo

COPY --from=build --chown=lingcoo:lingcoo /app/package.json /app/package-lock.json ./
COPY --from=build --chown=lingcoo:lingcoo /app/node_modules ./node_modules
COPY --from=build --chown=lingcoo:lingcoo /app/apps/reference-system/package.json ./apps/reference-system/package.json
COPY --from=build --chown=lingcoo:lingcoo /app/apps/reference-system/dist ./apps/reference-system/dist
COPY --from=build --chown=lingcoo:lingcoo /app/apps/reference-admin/dist ./apps/reference-admin/dist
COPY --from=build --chown=lingcoo:lingcoo /app/apps/reference-web/dist ./apps/reference-web/dist
COPY --from=build --chown=lingcoo:lingcoo /app/packages/frame/package.json ./packages/frame/package.json
COPY --from=build --chown=lingcoo:lingcoo /app/packages/frame/dist ./packages/frame/dist
COPY --from=build --chown=lingcoo:lingcoo /app/packages/database/package.json ./packages/database/package.json
COPY --from=build --chown=lingcoo:lingcoo /app/packages/database/dist ./packages/database/dist
COPY --from=build --chown=lingcoo:lingcoo /app/packages/database/drizzle ./packages/database/drizzle
COPY --from=build --chown=lingcoo:lingcoo /app/packages/extension-sdk/package.json ./packages/extension-sdk/package.json
COPY --from=build --chown=lingcoo:lingcoo /app/packages/extension-sdk/dist ./packages/extension-sdk/dist
COPY --from=build --chown=lingcoo:lingcoo /app/packages/admin-shell/package.json ./packages/admin-shell/package.json
COPY --from=build --chown=lingcoo:lingcoo /app/packages/admin-shell/dist ./packages/admin-shell/dist
COPY --from=build --chown=lingcoo:lingcoo /app/packages/cms/package.json ./packages/cms/package.json
COPY --from=build --chown=lingcoo:lingcoo /app/packages/cms/dist ./packages/cms/dist
COPY --from=build --chown=lingcoo:lingcoo /app/packages/cms/migrations ./packages/cms/migrations
COPY --from=build --chown=lingcoo:lingcoo /app/packages/web-shell/package.json ./packages/web-shell/package.json
COPY --from=build --chown=lingcoo:lingcoo /app/packages/web-shell/dist ./packages/web-shell/dist

USER lingcoo
EXPOSE 8090
CMD ["node", "apps/reference-system/dist/server.js"]
