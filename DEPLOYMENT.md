# Deployment

## Target flow

`git push → CI → GitHub Actions Docker build → Aliyun ACR + GHCR → server pull → migrate → start → health check`

The production server never builds the application image from source.

## Target

- Repository: `LingcooTech/lingcoo-system-base-framework`
- Host: `82.157.22.93`
- Domain: `frame.lingcoo.com`
- Deploy path: `/opt/lingcoo-system-base-framework`
- Health check: `https://frame.lingcoo.com/ready`
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

Project-specific values:

```text
DEPLOY_HOST=82.157.22.93
DEPLOY_USER=root
DEPLOY_PATH=/opt/lingcoo-system-base-framework
DEPLOY_HEALTHCHECK_URL=https://frame.lingcoo.com/ready
```

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
LOG_LEVEL=info
CADDY_SITE_ADDRESS=:80
LINGCOO_BASE_HTTP_PORT=18093
LINGCOO_BASE_HTTPS_PORT=18449
```

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
