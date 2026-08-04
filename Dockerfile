ARG NODE_BASE_IMAGE=node:22-alpine

FROM ${NODE_BASE_IMAGE} AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY admin-ui/package.json ./admin-ui/
COPY public-web/package.json ./public-web/
COPY fixtures/example-extension/package.json ./fixtures/example-extension/
COPY packages/database/package.json ./packages/database/
COPY packages/design-tokens/package.json ./packages/design-tokens/
COPY packages/extension-sdk/package.json ./packages/extension-sdk/
COPY packages/ui/package.json ./packages/ui/
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
COPY --from=build --chown=lingcoo:lingcoo /app/dist ./dist
COPY --from=build --chown=lingcoo:lingcoo /app/packages/database/package.json ./packages/database/package.json
COPY --from=build --chown=lingcoo:lingcoo /app/packages/database/dist ./packages/database/dist
COPY --from=build --chown=lingcoo:lingcoo /app/packages/database/drizzle ./packages/database/drizzle
COPY --from=build --chown=lingcoo:lingcoo /app/packages/extension-sdk/package.json ./packages/extension-sdk/package.json
COPY --from=build --chown=lingcoo:lingcoo /app/packages/extension-sdk/dist ./packages/extension-sdk/dist
COPY --from=build --chown=lingcoo:lingcoo /app/admin-ui/dist ./admin-ui/dist
COPY --from=build --chown=lingcoo:lingcoo /app/public-web/dist ./public-web/dist

USER lingcoo
EXPOSE 8090
CMD ["node", "dist/server.js"]
