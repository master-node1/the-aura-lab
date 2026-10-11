# TheAuraLab services: Docker Compose deployment

> How to run the theauralab backend locally or on a single host with Docker Compose. Kubernetes deployment is covered in [docs/architecture/ci-cd.md](../docs/architecture/ci-cd.md).
> [← Service index](README.md)

The AI chat agent (AuraMind: chat, ai, memory, analytics and companion services, plus ChromaDB) is no longer part of this stack. It lives in [master-node1/the-aura-mind](https://github.com/master-node1/the-aura-mind) and has its own deployment guide.

---

## Prerequisites

- Docker and Docker Compose.
- A `.env` file at the repository root, copied from `.env.example`. Set at least `SECRET_KEY` and `INTERNAL_SERVICE_TOKEN`; signup, login and permission checks fail without the internal token.

## Step 1: build and start

```bash
docker compose up -d --build
```

This starts, in dependency order:

- postgres:5432
- redis:6379
- authorization-service:3002
- identity-service:3001
- customer-service:3000
- auth-service:3000
- api-gateway:8001 (nginx, the only port published besides the data stores)

## Step 2: wait for migrations

Every NestJS service runs `prisma migrate deploy` on startup, and the compose health checks gate the next service. Watch progress with:

```bash
docker compose ps
docker compose logs -f auth-service
```

## Step 3: check health

- http://localhost:8001/health (gateway)
- http://localhost:8001/api/auth/health
- http://localhost:8001/api/identity/health
- http://localhost:8001/api/customer/health

authorization-service is internal only; check it with `docker compose ps authorization-service`.

## Step 4: make the first admin

```bash
docker compose exec authorization-service node dist/cli/assign-role.js <identityId>
```

---

## Architecture

```
Client
  ↓ HTTP
nginx API gateway (:8001)
  ├─→ auth-service (:3000)        register, login, JWT
  ├─→ identity-service (:3001)    identities, email/mobile verification
  └─→ customer-service (:3000)    customer profiles, addresses, preferences
        identity / customer ─→ authorization-service (:3002, internal)
        auth ─→ identity /internal/* (x-internal-token)
```

## Known limitations

1. **One shared Postgres database.** Each service owns its tables, but they share one database and one `_prisma_migrations` table. Never run `prisma db push` against it.
2. **No authentication, rate limiting or TLS at the gateway.** Each service verifies JWTs itself.
3. **No email or SMS delivery yet.** With `NODE_ENV=production`, new users can't verify and so can't log in. Use `NODE_ENV=development` locally.
4. **No tracing or metrics.**

## Troubleshooting

**"table does not exist" on startup**: Postgres wasn't ready when a service migrated. Restart it with `docker compose restart <service>`.

**Signup or login returns 503**: `INTERNAL_SERVICE_TOKEN` is unset, or identity-service / authorization-service is unhealthy. Check `docker compose ps` and the service logs.

**Login returns 401 for a new user**: the email isn't verified and verification is enforced. See [identity-service §3.6](identity-service/README.md#36-verification-delivery).
