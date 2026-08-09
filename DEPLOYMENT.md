# Deployment

## Target flow

`git push → CI → GitHub Actions Docker build → Aliyun ACR + GHCR → server pull → migrate → start → health check → route smoke`

The production server never builds the application image from source.
ACR authentication is retried with bounded backoff on both the GitHub runner and production host so a transient
registry TLS timeout does not immediately abort the deployment.

## Target

- Repository: `LingcooTech/lingcoo-system-base-framework`
- Domain: `frame.lingcoo.com`
- Deploy path: `/opt/lingcoo-system-base-framework`
- Health check: `https://frame.lingcoo.com/ready`
- Smoke verification: `https://frame.lingcoo.com` (health, official routes, CMS public API, auth guard, robots, sitemap and security headers)
- Local HTTP upstream: `127.0.0.1:18093`

## Required GitHub Secrets

- `ACR_REGISTRY`
- `ACR_NAMESPACE`
- `ACR_USERNAME`
- `ACR_PASSWORD`
- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PATH`
- `DEPLOY_SSH_PRIVATE_KEY`
- `DEPLOY_SSH_KNOWN_HOSTS`
- `DEPLOY_HEALTHCHECK_URL`

Example values (replace host, user and path for the target environment):

```text
DEPLOY_HOST=<server-hostname-or-ip>
DEPLOY_USER=<dedicated-non-root-deploy-user>
DEPLOY_PATH=<absolute-deploy-path>
DEPLOY_HEALTHCHECK_URL=https://frame.lingcoo.com/ready
```

Do not use direct root SSH for a new deployment. Give a dedicated deploy account only the filesystem and container
runtime permissions required by this application.

## One-time server bootstrap

```bash
git clone https://github.com/LingcooTech/lingcoo-system-base-framework.git \
  /opt/lingcoo-system-base-framework
cd /opt/lingcoo-system-base-framework
cp .env.example .env
```

Production `.env`:

```text
NODE_ENV=production
APP_NAME=lingcoo-system-base-framework
API_HOST=0.0.0.0
API_PORT=8090
CORS_ORIGIN=https://frame.lingcoo.com
DATABASE_URL=postgres://lingcoo_base:<password>@postgres:5432/lingcoo_base
POSTGRES_DB=lingcoo_base
POSTGRES_USER=lingcoo_base
POSTGRES_PASSWORD=<password>
SETTINGS_ENCRYPTION_KEY=<at-least-32-random-characters>
AUTH_JWT_SECRET=<at-least-32-random-characters>
AUTH_COOKIE_NAME=lingcoo_frame_session
AUTH_SESSION_TTL_HOURS=168
AUTH_BOOTSTRAP_EMAIL=<first-owner-email>
AUTH_BOOTSTRAP_PASSWORD=<temporary-password-at-least-12-characters>
AUTH_BOOTSTRAP_DISPLAY_NAME=系统所有者
LOG_LEVEL=info
METRICS_BEARER_TOKEN=<optional-at-least-24-random-characters>
CADDY_SITE_ADDRESS=:80
LINGCOO_BASE_HTTP_PORT=18093
LINGCOO_BASE_HTTPS_PORT=18449
```

`AUTH_BOOTSTRAP_EMAIL` and `AUTH_BOOTSTRAP_PASSWORD` are only needed until the
first owner is created. Remove the bootstrap password from `.env` after the
first successful deployment; the owner must replace it on first login.

`METRICS_BEARER_TOKEN` 为空时 `/metrics` 返回 404。需要接入 Prometheus 时再生成独立令牌，
并使用 `Authorization: Bearer <token>` 抓取；不要复用登录密码、JWT 密钥或 Provider 凭据。

The host Nginx terminates TLS for `frame.lingcoo.com` and proxies requests to
`http://127.0.0.1:18093`.

Install the tracked HTTP ingress configuration:

```bash
sudo cp deploy/nginx.frame.lingcoo.conf /etc/nginx/conf.d/frame.lingcoo.com.conf
sudo nginx -t
sudo systemctl reload nginx
```

After the DNS A record resolves to `82.157.22.93`, issue the certificate:

```bash
sudo certbot --nginx -d frame.lingcoo.com --redirect
```

每次部署在 `/ready` 通过后，`deploy/scripts/verify-deployment.sh` 会继续检查官网首页、官网文档、CMS
文章入口、`/admin/`、未登录 API 的 401 语义、`robots.txt`、包含静态官网和动态 CMS 内容的 `sitemap.xml`，
以及 `X-Content-Type-Options`、`Referrer-Policy` 等安全响应头。也可以手动执行：

```bash
sh deploy/scripts/verify-deployment.sh https://frame.lingcoo.com
```
