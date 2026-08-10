ARG NODE_BASE_IMAGE=node:22-alpine

FROM ${NODE_BASE_IMAGE} AS dependencies
WORKDIR /app

# <github>
COPY package.json package-lock.json .npmrc ./
# </github>
# <npmjs>
COPY package.json package-lock.json ./
# </npmjs>
COPY apps/admin/package.json ./apps/admin/
COPY apps/system/package.json ./apps/system/
# <web>
COPY apps/web/package.json ./apps/web/
# </web>
COPY packages/domain/package.json ./packages/domain/
# <github>
RUN --mount=type=secret,id=npm_token \
    NODE_AUTH_TOKEN="$(cat /run/secrets/npm_token)" npm ci
# </github>
# <npmjs>
RUN npm ci
# </npmjs>

FROM dependencies AS build
COPY . .
RUN npm run build:all
# <github>
RUN --mount=type=secret,id=npm_token \
    NODE_AUTH_TOKEN="$(cat /run/secrets/npm_token)" npm prune --omit=dev
# </github>
# <npmjs>
RUN npm prune --omit=dev
# </npmjs>

FROM ${NODE_BASE_IMAGE} AS runtime
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=8090
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/package.json /app/package-lock.json ./
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/apps/system/package.json ./apps/system/package.json
COPY --from=build --chown=app:app /app/apps/system/dist ./apps/system/dist
COPY --from=build --chown=app:app /app/apps/admin/dist ./apps/admin/dist
# <web>
COPY --from=build --chown=app:app /app/apps/web/dist ./apps/web/dist
# </web>
COPY --from=build --chown=app:app /app/packages/domain/package.json ./packages/domain/package.json
COPY --from=build --chown=app:app /app/packages/domain/dist ./packages/domain/dist
COPY --from=build --chown=app:app /app/packages/domain/migrations ./packages/domain/migrations
USER app
EXPOSE 8090
CMD ["node", "apps/system/dist/server.js"]
