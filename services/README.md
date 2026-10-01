# TheAuraLab services: architecture and service index

> The starting point for the backend. It covers the platform-wide architecture (HLD), the shared database, inter-service contracts and cross-cutting issues, and links to every service's README (LLD, API, DB, flows).
> [← Repository README](../README.md) · [Deployment guide](DEPLOYMENT.md)

---

## Service index

| Service | Tech | Port | Public route (gateway `:8001`) | Owns | README |
|---|---|---|---|---|---|
| **api-gateway** | nginx | 8001 | entry point | – | [api-gateway](api-gateway/README.md) |
| **auth-service** | NestJS | 3000 | `/api/auth/*` | `users` | [auth-service](auth-service/README.md) |
| **chat-service** | NestJS + Socket.IO | 3000 | `/api/chat/*`, `/socket.io/` | `conversations`, `messages` | [chat-service](chat-service/README.md) |
| **memory-service** | NestJS | 3000 | `/api/memory/*` | `memories`, Redis `st:*` | [memory-service](memory-service/README.md) |
| **companion-service** | NestJS | 3000 | `/api/companion/*` | – (writes `users` columns) | [companion-service](companion-service/README.md) |
| **analytics-service** | NestJS | 3000 | `/api/analytics/*` | – (read-only) | [analytics-service](analytics-service/README.md) |
| **ai-service** | Python / FastAPI | 3000 | `/api/ai/health` only | ChromaDB `TheAuraLab_memories` | [ai-service](ai-service/README.md) |
| **customer-service** | NestJS | 3000 | `/api/customer/*` | `customers`, `customer_*` | [customer-service](customer-service/README.md) |
| **identity-service** | NestJS | 3001 | `/api/identity/*` (`/internal/*` blocked) | `identities`, `identity_*` | [identity-service](identity-service/README.md) |
| **authorization-service** | NestJS | 3002 | – (internal only) | `roles`, `permissions`, `role_permissions`, `user_roles`, `policies`, `authorization_audit_logs` | [authorization-service](authorization-service/README.md) |
| **shared** | TypeScript library | – | – | – | [shared](shared/README.md) |

Every service README has the same sections: **Responsibilities → High-Level Design → Low-Level Design → API → Data model → Flows → Configuration → Run/Build/Test → Known limitations.**

### Quick links by topic

| I want to… | Go to |
|---|---|
| Understand login and tokens | [auth-service §3.3](auth-service/README.md#33-business-rules) |
| Integrate the chat WebSocket | [chat-service §3.3](chat-service/README.md#33-websocket-protocol) |
| Verify an email or mobile number | [identity-service §2](identity-service/README.md#2-high-level-design) |
| Know which endpoints need a JWT | [Request authentication](#request-authentication-across-services) |
| See how an AI reply is produced | [ai-service §3.1](ai-service/README.md#31-pipeline-steps-pipelinerun_pipeline) |
| Find every table | [Shared database](#shared-database) |
| See the Redis channels and keys | [Inter-service communication](#inter-service-communication) |
| See the environment variables | [Configuration](#configuration) |
| Know what's broken or missing | [Cross-cutting known issues](#cross-cutting-known-issues) |
| Read the business requirements (e-commerce PRD) | [docs/README.md](../docs/README.md) |

---

## Platform overview

The repository contains two product areas that share the same infrastructure:

1. **AI companion ("Sora")**: auth, chat, memory, companion, analytics and ai-service. Users chat in real time with a personality-driven AI that detects emotion and remembers facts about them.
2. **E-commerce foundation**: customer, identity and authorization services, the first services of the enterprise e-commerce platform described in [`docs/`](../docs/README.md).

### System context

```mermaid
flowchart TB
    U([User / Browser]) -->|HTTPS + WSS :8001| GW[api-gateway<br/>nginx]

    subgraph Companion[AI companion domain]
        AUTH[auth-service]
        CHAT[chat-service<br/>Socket.IO]
        MEM[memory-service]
        COMP[companion-service]
        AN[analytics-service]
        AI[ai-service<br/>Python agents]
    end

    subgraph Commerce[E-commerce domain]
        CUST[customer-service]
        ID[identity-service]
        AZ[authorization-service]
    end

    GW --> AUTH & CHAT & MEM & COMP & AN & CUST & ID
    GW -->|/api/ai/health| AI

    CHAT <-->|pub/sub| REDIS[(Redis 7)]
    AI <-->|pub/sub + short-term memory| REDIS
    MEM <-->|short-term memory| REDIS
    AI -->|vectors| CHROMA[(ChromaDB 0.4)]
    AI -->|LLM| OPENAI[(OpenAI API)]
    COMP -->|HTTP DELETE short-term| MEM

    AUTH & CHAT & MEM & COMP & AN & CUST & ID & AZ --> PG[(PostgreSQL 16<br/>single shared DB)]
```

### Architecture style and key decisions

| Decision | What the code does | Consequence |
|---|---|---|
| Service style | NestJS microservices plus one Python worker, each with its own Docker image | Services deploy independently, but every one repeats the same scaffolding |
| Database | **One shared Postgres database.** Each service owns its tables, but analytics, companion and chat read other services' tables directly | Simple to run, but the schemas are tightly coupled (see [Shared database](#shared-database)) |
| Authentication | Stateless HS256 JWT with a shared `JWT_SECRET`, verified locally by each service. Every public endpoint needs an access JWT except signup, login, refresh, health, and identity verification (which uses one-time codes). | auth-service isn't called on every request, but tokens can't be revoked and rotating the secret means redeploying every service |
| Service-to-service | identity-service `/internal/*` uses a shared `INTERNAL_SERVICE_TOKEN` header and is blocked at the gateway; authorization-service isn't routed | Calls made before the user has a token (signup, login) don't need a user JWT |
| Async messaging | Redis pub/sub between chat-service and ai-service | Low latency, but **at-most-once delivery**: messages are lost while ai-service is down |
| Vector memory | ChromaDB, used only by ai-service | Relevant memories are retrieved semantically, but separately from Postgres `memories` |
| Edge | nginx path-based routing | No authentication, rate limiting or TLS at the edge |
| Migrations | Each service runs `prisma migrate deploy` on boot | No central coordination. authorization-service has **no migrations**. |

---

## Shared database

Every service connects to the same database (`DATABASE_URL` → `postgres:5432/theauralab`, reached through `host.docker.internal`). The table below lists each table's owner and the other services that access it.

| Table | Owner (migrations) | Also read by | Also written by |
|---|---|---|---|
| `users` | auth-service | chat-service (raw SQL), analytics-service, companion-service | companion-service |
| `conversations`, `messages` | chat-service | analytics-service | – |
| `memories` | memory-service | analytics-service | – |
| `identities`, `identity_providers`, `identity_audit_logs`, `identity_verifications` | identity-service | – | – |
| `roles`, `permissions`, `role_permissions`, `user_roles`, `policies`, `authorization_audit_logs` | authorization-service (⚠️ no migrations) | – | – |
| `customers`, `customer_addresses`, `customer_preferences`, `customer_audit_logs`, `customer_events` | customer-service | – | – |

### Logical ER diagram (whole platform)

Solid relationships are real foreign keys inside a service. The `logical` ones are IDs shared across services with **no foreign key**.

```mermaid
erDiagram
    users ||--o{ conversations : "logical user_id"
    users ||--o{ memories : "logical user_id"
    conversations ||--o{ messages : "FK cascade"
    conversations ||--o{ memories : "logical conversation_id"

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

`users` (the companion domain) and `identities` (the e-commerce domain) are **two separate user stores** with nothing linking them.

Column-level details are in each service's README under **§5 Data model**.

---

## Inter-service communication

### Redis

| Name | Kind | Producer | Consumer | Payload |
|---|---|---|---|---|
| `TheAuraLab:ai:process` | pub/sub channel | chat-service | ai-service | `{userId, messageId, content, conversationId, username, personality}` |
| `TheAuraLab:ai:response` | pub/sub channel | ai-service | chat-service | `{userId, messageId, content, emotion, avatarExpression, memoryUpdates[], suggestions[], conversationId}` |
| `TheAuraLab:st:{userId}` | LIST (max 50, TTL 3600 s) | ai-service, memory-service | ai-service, memory-service | `{role, content}` JSON |
| `TheAuraLab:memory:save`, `TheAuraLab:memory:search` | declared in `shared` | – | – | unused |

### Synchronous HTTP

| From | To | Call |
|---|---|---|
| companion-service | memory-service | `DELETE /api/memory/short-term`, forwarding the user's Bearer token |

No other service-to-service HTTP calls exist. ai-service declares `MEMORY_SERVICE_URL` but never uses it.

### End-to-end flow: a user sends a chat message

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend
    participant GW as api-gateway
    participant AU as auth-service
    participant CS as chat-service
    participant PG as Postgres
    participant R as Redis
    participant AI as ai-service
    participant CH as ChromaDB
    participant OA as OpenAI
    FE->>GW: POST /api/auth/login
    GW->>AU: forward
    AU->>PG: verify user + bcrypt
    AU-->>FE: access_token, refresh_token
    FE->>GW: WSS /socket.io/?token=access
    GW->>CS: upgrade
    CS->>CS: verify JWT, register socket
    FE->>CS: emit message {content}
    CS-->>FE: ack, typing
    CS->>PG: INSERT conversation? + message(user)
    CS->>PG: SELECT username, personality FROM users
    CS->>R: PUBLISH ai:process
    R->>AI: deliver
    AI->>R: LRANGE short-term
    AI->>OA: detect emotion
    AI->>CH: semantic search memories
    AI->>OA: generate reply (personality prompt)
    AI->>R: RPUSH short-term
    AI->>OA: extract memories
    AI->>CH: add memories
    AI->>R: PUBLISH ai:response
    R->>CS: deliver
    CS-->>FE: emit message {content, emotion, avatarExpression, suggestions}
```

### Request authentication across services

```mermaid
flowchart LR
    T[Access JWT<br/>sub, email, type=access] --> CS[chat-service ✔]
    T --> MS[memory-service ✔]
    T --> CP[companion-service ✔]
    T --> AN[analytics-service ✔]
    T --> AU["auth-service /me, /logout ✔"]
    T --> CU[customer-service ✔]
    T --> ID["identity-service /identities/* ✔"]
    P[Public, no JWT] --> PA["auth /register, /login, /refresh"]
    P --> PV["identity /verify-email, /verify-mobile,<br/>/verifications/resend (one-time code)"]
    P --> PH["every /health"]
    K[x-internal-token<br/>backend network only] --> IN["identity /internal/*"]
    N[Not routed, no auth yet] --> AZ[authorization-service]
```

---

## Infrastructure (docker-compose)

| Container | Image | Host port | Health check |
|---|---|---|---|
| `the-aura-lab-postgres` | postgres:16-alpine | `${POSTGRES_PORT:-5432}` | `pg_isready` |
| `the-aura-lab-redis` | redis:7-alpine (AOF on, `allkeys-lru`) | `${REDIS_PORT:-6379}` | `redis-cli ping` |
| `the-aura-lab-chromadb` | chromadb/chroma:0.4.22 (persistent) | `${CHROMA_PORT:-8000}` | `/api/v1/heartbeat` |
| `the-aura-lab-<name>-service` | built from `services/<name>` | – (internal only) | `wget /api/<name>/health` |
| `the-aura-lab-ai` | built from `services/ai-service` | – | `wget /health` |
| `the-aura-lab-gateway` | built from `services/api-gateway` | `${API_GATEWAY_PORT:-8001}` | `wget /health` |

Networks: `backend` (all services and the data stores) and `edge` (the gateway only). Volumes: `postgres-data`, `redis-data`, `chroma-data`. All containers rotate their JSON logs (`LOG_MAX_SIZE`, `LOG_MAX_FILE`).

### Startup order

```mermaid
flowchart LR
    PG[(postgres)] --> AUTH[auth-service]
    RD[(redis)] --> AUTH
    AUTH --> ID[identity] & AZ[authorization] & CHAT[chat] & MEM[memory] & COMP[companion] & AN[analytics] & CUST[customer]
    RD --> CHAT & MEM
    CH[(chromadb)] --> AI[ai-service]
    MEM --> AI
    AUTH & CHAT & MEM & COMP & AN & ID & AZ & CUST --> GW[api-gateway]
```

---

## Configuration

Copy `.env.example` to `.env` at the repository root. docker-compose maps these root variables into each service:

| Root variable | Becomes | Used by |
|---|---|---|
| `SECRET_KEY` | `JWT_SECRET` | auth, chat, memory, companion, analytics, customer, identity |
| `INTERNAL_SERVICE_TOKEN` | same | identity-service `/internal/*` (unset means internal calls are rejected) |
| `JWT_REFRESH_SECRET` | `JWT_REFRESH_SECRET` | passed to auth-service, but unused |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `DATABASE_URL` | all NestJS services |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | same | ai-service |
| `CORS_ORIGINS` | same | all NestJS services |
| `NODE_ENV` | same | all NestJS services |
| `API_GATEWAY_PORT`, `POSTGRES_PORT`, `REDIS_PORT`, `CHROMA_PORT` | host port mappings | compose |
| `LOG_MAX_SIZE`, `LOG_MAX_FILE` | log rotation | compose |

The service-specific variables are listed in each README under **§7 Configuration**.

---

## Local development

```bash
# 1. infrastructure only
docker compose up -d postgres redis chromadb

# 2. a NestJS service (repeat per service)
cd services/<service>
npm install
npx prisma generate
npx prisma migrate deploy        # auth, chat, memory, customer, identity
# authorization has no migrations yet. Do NOT run `prisma db push` against the
# shared database: its schema doesn't know the other services' tables, so Prisma
# would offer to drop them. Use a separate schema for local work instead:
#   DATABASE_URL="…/theauralab?schema=authz" npx prisma db push
# (companion and analytics use other services' tables: generate only)
DATABASE_URL=postgresql://theauralab:theauralab_dev_pw@localhost:5432/theauralab \
JWT_SECRET=dev-secret PORT=3000 npm run start:dev

# 3. ai-service
cd services/ai-service && pip install -r requirements.txt && uvicorn main:app --port 3000

# 4. everything
docker compose up -d --build
```

Several services default to port 3000, so give each one a different `PORT` when you run them side by side on the host.

**Quality gates:** `npm install && npm run hooks:install` at the repository root. The pre-commit hook lints staged TypeScript files; pre-push runs `npm run quality` (ESLint plus `python -m compileall`). **No service has automated tests yet.**

---

## Cross-cutting known issues

Severity reflects what someone deploying the stack today would hit first.

| # | Severity | Issue | Affected |
|---|---|---|---|
| 1 | 🔴 High | **Authentication without authorization.** customer and identity now require a JWT, but any logged-in user can act on any customer or identity, including suspend and delete. authorization-service (unrouted) has no auth at all. | customer, identity, authorization |
| 2 | 🔴 High | **No email or SMS delivery.** Identity verification codes can't reach users, so issuing a code returns 503 in production. | identity |
| 3 | 🔴 High | **No migrations** for authorization-service, so `migrate deploy` creates no tables. | authorization |
| 4 | 🟠 Medium | auth-service isn't wired to identity-service: signup doesn't create an identity, and the JWT `sub` (`users.id`) isn't linked to `identities.id`. | auth, identity, customer |
| 5 | 🟠 Medium | AI-extracted memories go to ChromaDB only, never to Postgres `memories`, so analytics and the memory UI don't see them. | ai, memory, analytics |
| 6 | 🟠 Medium | Assistant replies aren't persisted, and `message_count`, `emotion` and `summary` are never updated. | chat, analytics |
| 7 | 🟠 Medium | Chat sockets don't check that the user owns the `conversationId` they send. | chat |
| 8 | 🟠 Medium | Redis pub/sub isn't durable, and neither chat-service nor ai-service can scale horizontally. | chat, ai |
| 9 | 🟠 Medium | Shared database with cross-service table access (`users` is written by two services). | auth, companion, chat, analytics |
| 10 | 🟡 Low | The refresh token is in a query string, there's one secret for both token types, there's no revocation, and the code falls back to a `changeme` secret. | auth (and all JWT verifiers) |
| 11 | 🟡 Low | The `shared` package is unused and its types have drifted. | shared |
| 12 | 🟡 Low | No automated tests, structured logging, metrics, tracing or correlation IDs anywhere. | all |
| 13 | 🟡 Low | customer-service's outbox (`customer_events`) has no relay. | customer |
| 14 | 🟡 Low | The repo already fails `npm run lint` (36 pre-existing ESLint errors, mostly `no-explicit-any`), so the pre-push hook can't pass. | all TypeScript services |

Fixed since the first version of this index: `/health` is public everywhere and checks its databases; nginx starts (the unused `frontend` upstream was removed); identity-service has migrations and a gateway route; customer and identity require a JWT; Swagger is hidden when `NODE_ENV=production`.

[DEPLOYMENT.md](DEPLOYMENT.md) is older than this index and lists some items that have since changed. For example, companion's `reset-memory` is now implemented.
