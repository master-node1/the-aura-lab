# TheAuraLab services: architecture and service index

> The starting point for the backend. It covers the platform-wide architecture (HLD), the shared database, inter-service contracts and cross-cutting issues, and links to every service's README (LLD, API, DB, flows).
> [← Repository README](../README.md) · [Deployment guide](DEPLOYMENT.md)

---

## Service index

| Service | Tech | Port | Public route (gateway `:8001`) | Owns | README |
|---|---|---|---|---|---|
| **api-gateway** | nginx | 8001 | entry point | – | [api-gateway](api-gateway/README.md) |
| **auth-service** | NestJS | 3000 | `/api/auth/*` | `users` | [auth-service](auth-service/README.md) |
| **customer-service** | NestJS | 3000 | `/api/customer/*` | `customers`, `customer_*` | [customer-service](customer-service/README.md) |
| **identity-service** | NestJS | 3001 | `/api/identity/*` (`/internal/*` blocked) | `identities`, `identity_*` | [identity-service](identity-service/README.md) |
| **authorization-service** | NestJS | 3002 | – (internal only, `x-internal-token`) | `roles`, `permissions`, `role_permissions`, `user_roles`, `policies`, `authorization_audit_logs` | [authorization-service](authorization-service/README.md) |

Every service README has the same sections: **Responsibilities → High-Level Design → Low-Level Design → API → Data model → Flows → Configuration → Run/Build/Test → Known limitations.**

### Quick links by topic

| I want to… | Go to |
|---|---|
| Understand login and tokens | [auth-service §3.3](auth-service/README.md#33-business-rules) |
| Verify an email or mobile number | [identity-service §2](identity-service/README.md#2-high-level-design) |
| Know which endpoints need a JWT | [Request authentication](#request-authentication-across-services) |
| Make someone an admin | [authorization-service §6](authorization-service/README.md#bootstrapping-the-first-admin) |
| Find every table | [Shared database](#shared-database) |
| See the service-to-service calls | [Inter-service communication](#inter-service-communication) |
| See the environment variables | [Configuration](#configuration) |
| Know what's broken or missing | [Cross-cutting known issues](#cross-cutting-known-issues) |
| Read the business requirements (e-commerce PRD) | [docs/README.md](../docs/README.md) |

---

## Platform overview

This repository is the backend of the theauralab e-commerce platform described in [`docs/`](../docs/README.md). Today it holds the account foundation: auth, identity, customer and authorization services behind an nginx gateway.

The AI chat agent (formerly "Sora", now **AuraMind**: chat, ai, memory, analytics and companion services) moved to its own repository, [master-node1/the-aura-mind](https://github.com/master-node1/the-aura-mind). theauralab will integrate with it only through AuraMind's public API, events and a tool adapter, never through shared tables or secrets.

### System context

```mermaid
flowchart TB
    U([User / Browser]) -->|HTTPS :8001| GW[api-gateway<br/>nginx]

    subgraph Commerce[theauralab]
        AUTH[auth-service]
        CUST[customer-service]
        ID[identity-service]
        AZ[authorization-service]
    end

    GW --> AUTH & CUST & ID
    AUTH -->|x-internal-token| ID
    ID & CUST -->|x-internal-token| AZ

    AUTH & CUST & ID & AZ --> PG[(PostgreSQL 16<br/>single shared DB)]
    AUTH --> REDIS[(Redis 7)]
```

### Architecture style and key decisions

| Decision | What the code does | Consequence |
|---|---|---|
| Service style | NestJS microservices, each with its own Docker image | Services deploy independently, but every one repeats the same scaffolding |
| Database | **One shared Postgres database.** Each service owns its tables and no service reads another's | Simple to run; one migration history (see [Shared database](#shared-database)) |
| Authentication | Stateless HS256 JWT with a shared `JWT_SECRET`, verified locally by each service. Every public endpoint needs an access JWT except signup, login, refresh, health, and identity verification (which uses one-time codes). | auth-service isn't called on every request, but tokens can't be revoked and rotating the secret means redeploying every service |
| Service-to-service | auth-service → identity-service `/internal/*`, and identity/customer → authorization-service, all with the shared `INTERNAL_SERVICE_TOKEN` header. Neither target is reachable through the gateway. | Calls made before the user has a token (signup, login) don't need a user JWT |
| Authorization | Owner-or-permission: owners act on their own identity and customer records; anyone else needs an RBAC permission from authorization-service. Fails closed (503) when authorization-service can't answer. | One extra HTTP call per non-owner request; no caching yet |
| User identity | One ID everywhere: `users.id` = `identities.id` = JWT `sub` = `customers.identity_id` | Ownership checks need no lookups |
| Edge | nginx path-based routing | No authentication, rate limiting or TLS at the edge |
| Migrations | Each service runs `prisma migrate deploy` on boot; all share one `_prisma_migrations` table | No central coordination; startup order comes from `depends_on` |

---

## Shared database

Every service connects to the same database (`DATABASE_URL` → `postgres:5432/theauralab`, reached through `host.docker.internal`). The table below lists each table's owner and the other services that access it.

| Table | Owner (migrations) | Also read by | Also written by |
|---|---|---|---|
| `users` | auth-service | – | – |
| `identities`, `identity_providers`, `identity_audit_logs`, `identity_verifications` | identity-service | – | – |
| `roles`, `permissions`, `role_permissions`, `user_roles`, `policies`, `authorization_audit_logs` | authorization-service (seeds `admin` and the permission catalog) | – | – |
| `customers`, `customer_addresses`, `customer_preferences`, `customer_audit_logs`, `customer_events` | customer-service | – | – |

### Logical ER diagram (whole platform)

Solid relationships are real foreign keys inside a service. The `logical` ones are IDs shared across services with **no foreign key**.

```mermaid
erDiagram
    users ||--|| identities : "same id (logical)"
    identities ||--o{ identity_providers : FK
    identities ||--o{ identity_audit_logs : FK
    identities ||--o{ identity_verifications : FK
    identities ||--o{ user_roles : "logical identity_id"
    identities ||--o| customers : "logical identity_id"

    roles ||--o{ role_permissions : "FK cascade"
    permissions ||--o{ role_permissions : "FK cascade"
    roles ||--o{ user_roles : "FK cascade"

    customers ||--o{ customer_addresses : "FK cascade"
    customers ||--o| customer_preferences : "FK cascade"
    customers ||--o{ customer_audit_logs : "FK cascade"
    customers ||--o{ customer_events : "FK cascade"
```

`users` (login credentials) and `identities` (verification state) share the same ID: signup creates the identity first, then the user with that ID. `users` still carries three companion columns (`personality_archetype`, `avatar_config`, `communication_style`) left over from AuraMind; nothing in this repo reads them any more, and they are due to be dropped in a follow-up migration.

Column-level details are in each service's README under **§5 Data model**.

---

## Inter-service communication

### Synchronous HTTP

| From | To | Call |
|---|---|---|
| auth-service | identity-service | `POST /api/identity/internal/identities` and `…/:id/verifications` at register; `GET …/:id` at login and refresh (`x-internal-token`, 3 s timeout) |
| identity-service, customer-service | authorization-service | `POST /api/authorization/authorize` for every non-owner request (`x-internal-token`, 2 s timeout, fails closed) |

No other service-to-service HTTP calls exist.

### Request authentication across services

```mermaid
flowchart LR
    T[Access JWT<br/>sub, email, type=access] --> AU["auth-service /me, /logout ✔"]
    T --> CU["customer-service ✔ + owner or customer:*"]
    T --> ID["identity-service /identities/* ✔ + owner or identity:*"]
    P[Public, no JWT] --> PA["auth /register, /login, /refresh"]
    P --> PV["identity /verify-email, /verify-mobile,<br/>/verifications/resend (one-time code)"]
    P --> PH["every /health"]
    K[x-internal-token<br/>backend network only] --> IN["identity /internal/*"]
    K --> AZ["authorization-service (all but /health)"]
```

---

## Infrastructure (docker-compose)

| Container | Image | Host port | Health check |
|---|---|---|---|
| `the-aura-lab-postgres` | postgres:16-alpine | `${POSTGRES_PORT:-5432}` | `pg_isready` |
| `the-aura-lab-redis` | redis:7-alpine (AOF on, `allkeys-lru`) | `${REDIS_PORT:-6379}` | `redis-cli ping` |
| `the-aura-lab-<name>-service` | built from `services/<name>` | – (internal only) | `wget /api/<name>/health` |
| `the-aura-lab-gateway` | built from `services/api-gateway` | `${API_GATEWAY_PORT:-8001}` | `wget /health` |

Networks: `backend` (all services and the data stores) and `edge` (the gateway only). Volumes: `postgres-data`, `redis-data`. All containers rotate their JSON logs (`LOG_MAX_SIZE`, `LOG_MAX_FILE`).

### Startup order

```mermaid
flowchart LR
    PG[(postgres)] --> AZ[authorization]
    AZ --> ID[identity] & CUST[customer]
    ID --> AUTH[auth-service]
    RD[(redis)] --> AUTH
    AUTH & ID & AZ & CUST --> GW[api-gateway]
```

---

## Configuration

Copy `.env.example` to `.env` at the repository root. docker-compose maps these root variables into each service:

| Root variable | Becomes | Used by |
|---|---|---|
| `SECRET_KEY` | `JWT_SECRET` | auth, customer, identity, authorization |
| `INTERNAL_SERVICE_TOKEN` | same | auth, identity, customer, authorization. **Required**: without it signup, login and permission checks fail. |
| `REQUIRE_VERIFIED_EMAIL` | same (unset: required only when `NODE_ENV=production`) | auth-service: block login until the email is verified |
| `JWT_REFRESH_SECRET` | `JWT_REFRESH_SECRET` | passed to auth-service, but unused |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `DATABASE_URL` | all NestJS services |
| `CORS_ORIGINS` | same | all NestJS services |
| `NODE_ENV` | same | all NestJS services |
| `API_GATEWAY_PORT`, `POSTGRES_PORT`, `REDIS_PORT` | host port mappings | compose |
| `LOG_MAX_SIZE`, `LOG_MAX_FILE` | log rotation | compose |

The service-specific variables are listed in each README under **§7 Configuration**.

---

## Local development

```bash
# 1. infrastructure only
docker compose up -d postgres redis

# 2. a NestJS service (repeat per service)
cd services/<service>
npm install
npx prisma generate
npx prisma migrate deploy
# Never run `prisma db push` against the shared database: each service's schema
# only knows its own tables, so Prisma would offer to drop everyone else's.
DATABASE_URL=postgresql://theauralab:theauralab_dev_pw@localhost:5432/theauralab \
JWT_SECRET=dev-secret INTERNAL_SERVICE_TOKEN=dev-internal PORT=3000 npm run start:dev

# 3. everything
docker compose up -d --build
```

Several services default to port 3000, so give each one a different `PORT` when you run them side by side on the host.

**Tests:** `npm test` at the repository root runs the Jest unit tests of auth, identity, customer and authorization (install each service's dependencies first).

**Quality gates:** `npm install && npm run hooks:install` at the repository root. The pre-commit hook lints staged TypeScript files; pre-push runs `npm run quality` (ESLint).

---

## Cross-cutting known issues

Severity reflects what someone deploying the stack today would hit first.

| # | Severity | Issue | Affected |
|---|---|---|---|
| 1 | 🔴 High | **No email or SMS delivery** (planned: a separate notification and campaign application). In production, issuing a code returns 503 and **new users can't log in**, because verification is required there. Development skips the check by default. | identity, auth |
| 2 | 🟠 Medium | **Coarse admin model.** authorization-service trusts any holder of `INTERNAL_SERVICE_TOKEN` and doesn't know which admin is acting. Permission checks aren't cached, and suspending or deleting an identity doesn't revoke tokens already issued. | authorization, identity, customer, auth |
| 3 | 🟡 Low | The refresh token is in a query string, there's one secret for both token types, there's no revocation, and the code falls back to a `changeme` secret. | auth (and all JWT verifiers) |
| 4 | 🟡 Low | No structured logging, metrics, tracing or correlation IDs anywhere. | all |
| 5 | 🟡 Low | customer-service's outbox (`customer_events`) has no relay. | customer |
| 6 | 🟡 Low | `users` still has the AuraMind companion columns, and `POST /api/auth/register` still accepts `personalityArchetype`. | auth |

Fixed since the first version of this index: ownership and RBAC checks on customer and identity; authorization-service has migrations, a seeded `admin` role and requires the internal token; signup creates the identity with the same ID as the user, and login requires an active identity with a verified email; `/health` is public everywhere and checks its databases; nginx starts (the unused `frontend` upstream was removed); identity-service has migrations and a gateway route; customer and identity require a JWT; Swagger is hidden when `NODE_ENV=production`; the repo is lint-clean and every service has unit tests in CI. The chat, AI, memory and Redis issues moved to AuraMind with its services.


