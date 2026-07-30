#!/bin/sh

set -eu

: "${DEPLOY_PATH:?DEPLOY_PATH is required}"
: "${ACR_REGISTRY:?ACR_REGISTRY is required}"
: "${ACR_USERNAME:?ACR_USERNAME is required}"
: "${ACR_PASSWORD:?ACR_PASSWORD is required}"
: "${LINGCOO_BASE_IMAGE_NAME:?LINGCOO_BASE_IMAGE_NAME is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"

DEPLOY_COMPOSE_FILE="${DEPLOY_COMPOSE_FILE:-docker-compose.prod.yml}"
DEPLOY_HEALTHCHECK_URL="${DEPLOY_HEALTHCHECK_URL:-https://test.lingcoo.com/ready}"
LINGCOO_BASE_RUNTIME_IMAGE="${LINGCOO_BASE_IMAGE_NAME}:${IMAGE_TAG}"
APP_VERSION="${IMAGE_TAG}"

cleanup_docker_space() {
  docker container prune -f >/dev/null 2>&1 || true
  docker image prune -af >/dev/null 2>&1 || true
  docker builder prune -af >/dev/null 2>&1 || true
}

cd "${DEPLOY_PATH}"

git fetch --prune origin
git checkout main
git reset --hard origin/main

printf '%s' "${ACR_PASSWORD}" |
  docker login "${ACR_REGISTRY}" --username "${ACR_USERNAME}" --password-stdin

export APP_VERSION
export LINGCOO_BASE_RUNTIME_IMAGE

docker compose -f "${DEPLOY_COMPOSE_FILE}" config >/dev/null
cleanup_docker_space
if ! docker compose -f "${DEPLOY_COMPOSE_FILE}" pull api; then
  cleanup_docker_space
  docker compose -f "${DEPLOY_COMPOSE_FILE}" pull api
fi
docker compose -f "${DEPLOY_COMPOSE_FILE}" up -d postgres
docker compose -f "${DEPLOY_COMPOSE_FILE}" run --rm --no-deps \
  api node scripts/run-migrations.mjs
docker compose -f "${DEPLOY_COMPOSE_FILE}" up -d --remove-orphans api caddy
cleanup_docker_space

attempt=1
max_attempts=30

while [ "${attempt}" -le "${max_attempts}" ]; do
  if curl -fsS "${DEPLOY_HEALTHCHECK_URL}" >/dev/null; then
    echo "health check passed on attempt ${attempt}"
    exit 0
  fi

  echo "health check pending (${attempt}/${max_attempts})"
  attempt=$((attempt + 1))
  sleep 5
done

echo "deployment health check failed"
exit 1
