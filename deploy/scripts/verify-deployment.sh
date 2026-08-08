#!/bin/sh

set -eu

base_url="${1:-${DEPLOY_BASE_URL:-https://frame.lingcoo.com}}"
base_url="${base_url%/}"

assert_status() {
  path="$1"
  expected="$2"
  method="${3:-GET}"
  status="$(curl -sS -o /dev/null -w '%{http_code}' -X "${method}" "${base_url}${path}")"
  if [ "${status}" != "${expected}" ]; then
    echo "smoke check failed: ${method} ${path} returned ${status}, expected ${expected}"
    return 1
  fi
  echo "smoke check passed: ${method} ${path} (${status})"
}

assert_contains() {
  path="$1"
  expected="$2"
  body="$(curl -fsS "${base_url}${path}")"
  case "${body}" in
    *"${expected}"*) echo "content check passed: ${path} contains ${expected}" ;;
    *)
      echo "content check failed: ${path} does not contain ${expected}"
      return 1
      ;;
  esac
}

assert_header() {
  path="$1"
  header_name="$2"
  expected="$3"
  headers="$(curl -fsSI "${base_url}${path}" | tr -d '\r')"
  normalized="$(printf '%s\n' "${headers}" | awk -v name="${header_name}" '
    BEGIN { prefix = tolower(name) ":" }
    index(tolower($0), prefix) == 1 { sub(/^[^:]+:[[:space:]]*/, ""); print; exit }
  ')"
  case "${normalized}" in
    *"${expected}"*) echo "header check passed: ${path} ${header_name}" ;;
    *)
      echo "header check failed: ${path} ${header_name}=${normalized:-missing}"
      return 1
      ;;
  esac
}

assert_status '/health' '200'
assert_status '/ready' '200'
assert_status '/' '200'
assert_status '/framework' '200'
assert_status '/docs/architecture' '200'
assert_status '/articles' '200'
assert_status '/admin/' '200'
assert_status '/api/public/cms/articles?page=1&pageSize=1' '200'
assert_status '/api/auth/me' '401'
assert_status '/api/auth/login' '400' 'POST'
assert_status '/robots.txt' '200'
assert_status '/sitemap.xml' '200'

assert_contains '/robots.txt' 'Sitemap:'
assert_contains '/sitemap.xml' '<loc>'
assert_contains '/sitemap.xml' '/framework</loc>'
assert_contains '/sitemap.xml' '/docs/architecture</loc>'
assert_contains '/sitemap.xml' '/articles</loc>'

assert_header '/' 'X-Content-Type-Options' 'nosniff'
assert_header '/' 'Referrer-Policy' 'strict-origin-when-cross-origin'
assert_header '/framework' 'Content-Type' 'text/html'

echo "deployment smoke verification passed for ${base_url}"
