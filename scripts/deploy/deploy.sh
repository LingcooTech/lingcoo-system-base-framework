#!/bin/sh

set -eu

: "${DEPLOY_PATH:?DEPLOY_PATH is required}"
: "${ACR_REGISTRY:?ACR_REGISTRY is required}"
: "${ACR_USERNAME:?ACR_USERNAME is required}"
: "${ACR_PASSWORD:?ACR_PASSWORD is required}"
: "${LINGCOO_BASE_IMAGE_NAME:?LINGCOO_BASE_IMAGE_NAME is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"

DEPLOY_COMPOSE_FILE="${DEPLOY_COMPOSE_FILE:-docker-compose.prod.yml}"
DEPLOY_HEALTHCHECK_URL="${DEPLOY_HEALTHCHECK_URL:-https://frame.lingcoo.com/ready}"
LINGCOO_BASE_RUNTIME_IMAGE="${LINGCOO_BASE_IMAGE_NAME}:${IMAGE_TAG}"
APP_VERSION="${IMAGE_TAG}"

cleanup_docker_space() {
  docker container prune -f >/dev/null 2>&1 || true
  docker image prune -af >/dev/null 2>&1 || true
  docker builder prune -af >/dev/null 2>&1 || true
}

login_acr() {
  login_attempt=1
  login_max_attempts=5
  while [ "${login_attempt}" -le "${login_max_attempts}" ]; do
    if printf '%s' "${ACR_PASSWORD}" |
      docker login "${ACR_REGISTRY}" --username "${ACR_USERNAME}" --password-stdin; then
      return 0
    fi
    if [ "${login_attempt}" -eq "${login_max_attempts}" ]; then
      echo "ACR login failed after ${login_attempt} attempts"
      return 1
    fi
    login_wait_s=$((login_attempt * 15))
    echo "ACR login failed (${login_attempt}/${login_max_attempts}); retrying in ${login_wait_s}s"
    sleep "${login_wait_s}"
    login_attempt=$((login_attempt + 1))
  done
}

cd "${DEPLOY_PATH}"

git fetch --prune origin
git checkout main
git reset --hard origin/main

login_acr

export APP_VERSION
export LINGCOO_BASE_RUNTIME_IMAGE

docker compose -f "${DEPLOY_COMPOSE_FILE}" config >/dev/null
cleanup_docker_space
if ! docker compose -f "${DEPLOY_COMPOSE_FILE}" pull api; then
  cleanup_docker_space
  docker compose -f "${DEPLOY_COMPOSE_FILE}" pull api
fi
docker compose -f "${DEPLOY_COMPOSE_FILE}" up -d postgres
docker compose -f "${DEPLOY_COMPOSE_FILE}" run --rm \
  api node dist/migrate.js
docker compose -f "${DEPLOY_COMPOSE_FILE}" up -d --remove-orphans api worker caddy
cleanup_docker_space

worker_container_id="$(docker compose -f "${DEPLOY_COMPOSE_FILE}" ps -q worker)"
if [ -z "${worker_container_id}" ]; then
  echo "worker container was not created"
  exit 1
fi

worker_attempt=1
while [ "${worker_attempt}" -le 24 ]; do
  worker_status="$(docker inspect --format '{{.State.Health.Status}}' "${worker_container_id}" 2>/dev/null || true)"
  if [ "${worker_status}" = "healthy" ]; then
    echo "worker health check passed on attempt ${worker_attempt}"
    break
  fi
  if [ "${worker_attempt}" -eq 24 ]; then
    echo "worker health check failed: ${worker_status:-unknown}"
    docker compose -f "${DEPLOY_COMPOSE_FILE}" logs --tail=100 worker || true
    exit 1
  fi
  worker_attempt=$((worker_attempt + 1))
  sleep 5
done

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
