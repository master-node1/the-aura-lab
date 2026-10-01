# auth-service

> User registration, login and JWT issuing for the TheAuraLab companion app.
> [← Service index](../README.md)

| | |
|---|---|
| **Stack** | NestJS 10, Prisma 6, PostgreSQL, Passport-JWT, bcryptjs |
| **Port** | `3000` |
| **Route prefix** | `/api/auth` |
| **Gateway route** | `http://<gateway>:8001/api/auth/*` |
| **Swagger** | `/api/auth/docs` (not served when `NODE_ENV=production`) |
| **Owns tables** | `users` |
| **Depends on** | PostgreSQL, identity-service (internal API, at register/login/refresh) |
| **Used by** | Frontend; every service that validates JWTs (they share `JWT_SECRET`) |

---

## 1. Responsibilities

- Register users (email, username, password, personality archetype). Registration first creates the **identity** in identity-service, then the user **with the same ID**, so the JWT `sub` = `users.id` = `identities.id` = `customers.identity_id`.
- Ask identity-service to send an email verification code after registering.
- Authenticate users and issue **access** and **refresh** JWTs, but only when the identity is active and, by default, its email is verified.
- Exchange a refresh token for a new token pair.
- Return the current user's profile.
- Own the `users` table. `companion-service` and `analytics-service` also read it, and `companion-service` writes to it (see [Data model](#5-data-model)).

Out of scope: token revocation, password reset and social login. Verification codes and the identity lifecycle live in [identity-service](../identity-service/README.md).

---

## 2. High-Level Design

```mermaid
flowchart LR
    FE[Frontend] -->|HTTPS| GW[nginx api-gateway :8001]
    GW -->|/api/auth/*| AUTH[auth-service :3000]
    AUTH -->|Prisma| PG[(PostgreSQL<br/>users)]
    AUTH -->|"x-internal-token<br/>/api/identity/internal/*"| ID[identity-service]
    AUTH -. issues JWT signed with JWT_SECRET .-> FE
    FE -. Bearer token .-> OTHERS[chat / memory / companion / analytics]
    OTHERS -. verify with same JWT_SECRET .-> OTHERS
```

- **Identity link.** auth-service is the only caller of identity-service's internal API: it creates identities at signup, checks status and email verification at login and refresh, and backfills an identity for users created before this link existed.
- **Stateless auth.** Other services never call auth-service. They verify JWTs locally with the shared `JWT_SECRET` and accept only tokens whose `type` is `access`.
- **Shared database.** The `users` table lives in the single shared Postgres database. Other services read it directly (see [services/README.md](../README.md#shared-database)).
- **Migrations** run on container start (`npx prisma migrate deploy`). Because this service creates `users`, the other services that depend on it wait for it to report healthy in `docker-compose.yml`.

---

## 3. Low-Level Design

```text
src/
├── main.ts                 # bootstrap: prefix api/auth, ValidationPipe, CORS, Swagger
├── app.module.ts           # ConfigModule (global), PrismaModule, AuthModule, HealthController
├── health/health.controller.ts # public; SELECT 1 with a 2 s timeout, 503 when down
├── prisma/
│   ├── prisma.module.ts    # @Global, exports PrismaService
│   └── prisma.service.ts   # PrismaClient with connect/disconnect lifecycle hooks
├── identity/
│   └── identity.client.ts  # identity-service internal API client (x-internal-token, 3 s timeout)
└── auth/
    ├── auth.module.ts      # PassportModule + JwtModule (secret, 30m default expiry), IdentityClient
    ├── auth.controller.ts  # REST endpoints
    ├── auth.service.ts     # business logic
    ├── jwt.strategy.ts     # Passport 'jwt' strategy; rejects non-access tokens
    └── dto/
        ├── register.dto.ts
        └── login.dto.ts
```

### 3.1 Components

| Class | Responsibility |
|---|---|
| `AuthController` | Maps HTTP routes to `AuthService`. `GET /me` is protected by `AuthGuard('jwt')`. |
| `AuthService` | `register`, `login`, `refresh`, `getMe`, plus the private helpers `createOrRecoverIdentity`, `assertIdentityMaySignIn`, `generateTokens` and `sanitizeUser`. |
| `IdentityClient` | `create`, `findById`, `findByEmail` and `requestEmailVerification` against `/api/identity/internal/identities`. Network errors and unexpected statuses become 503. |
| `JwtStrategy` | Pulls the Bearer token from the request, verifies it with `JWT_SECRET`, requires `payload.type === 'access'`, and returns `{ sub, email }` as `req.user`. |
| `PrismaService` | Shared Prisma client. |

### 3.2 DTOs and validation

The global `ValidationPipe({ whitelist: true, transform: true })` strips properties that are not declared on a DTO.

| DTO | Field | Rules |
|---|---|---|
| `RegisterDto` | `email` | `@IsEmail` |
| | `username` | string, 3–30 characters, `^[a-zA-Z0-9_-]+$` |
| | `password` | string, at least 8 characters |
| | `personalityArchetype` | optional, one of `friend \| mentor \| coach \| creator \| assistant`. Default `friend`. |
| `LoginDto` | `email` | `@IsEmail` |
| | `password` | string |

### 3.3 Business rules

1. Email and username must each be unique. A duplicate returns `409 Conflict`.
2. Passwords are hashed with **bcrypt, cost 12**. The hash is never returned, because `sanitizeUser` strips `hashedPassword`.
3. Login returns the same `401 Invalid email or password` for an unknown email and for a wrong password, so the response doesn't reveal which accounts exist.
4. Login is refused with `401 Account is deactivated` when `isActive = false`. This check runs **after** the password check.
5. Tokens:

   | Token | Payload | Expiry |
   |---|---|---|
   | access | `{ sub, email, type: 'access' }` | `JWT_ACCESS_EXPIRE_MINUTES`, default 30 minutes |
   | refresh | `{ sub, type: 'refresh' }` | `JWT_REFRESH_EXPIRE_DAYS`, default 7 days |

   Both tokens are signed with `JWT_SECRET` using HS256, the `@nestjs/jwt` default.
6. A refresh succeeds only for a valid token whose `type` is `refresh` and whose user still exists and is active. Those failures return `401 Invalid refresh token`. The identity checks in rules 8–9 apply to refresh too.
7. Logout requires a valid access token but is otherwise client-side only. The endpoint returns a message and doesn't revoke anything.
8. **Identity status.** Login and refresh are refused with `403 Account is not active` unless the identity's status is `PENDING_VERIFICATION`, `VERIFIED` or `ACTIVE` and it isn't soft-deleted. Suspending or deleting an identity therefore blocks new tokens. Tokens already issued stay valid until they expire (30 minutes by default).
9. **Verified email.** Login and refresh are refused with `403 Email address is not verified` until the email is verified, **in production only** by default. In every other environment the check is skipped, because nothing can deliver codes until the planned notification and campaign application exists. `REQUIRE_VERIFIED_EMAIL=true` or `false` overrides the default in either direction. See [identity-service §3.6](../identity-service/README.md#36-verification-delivery).
10. **Signup order.** auth-service checks the email and username against `users` (409), creates the identity with a new UUID, creates the user with that same ID, then requests an email verification code. That last step is best-effort: if it fails, the user can ask for a new code through the identity resend endpoint.
11. **Recovering a failed signup.** If an earlier registration created the identity but failed before creating the user, registering again with the same email **reuses** that identity instead of returning 409. That only happens when no user owns it and it isn't deleted.
12. **Backfill.** A user created before this link existed gets an identity with the same ID on their next login (status `PENDING_VERIFICATION`, so rule 9 applies). If another identity already owns that email under a different ID, login returns `403 Account requires attention; contact support` and logs an error.
13. Checks run in this order: password, then `isActive`, then identity. A wrong password returns 401 even while identity-service is down.

### 3.4 Error handling

| Situation | Exception | HTTP |
|---|---|---|
| DTO validation fails | `BadRequestException` (ValidationPipe) | 400 |
| Duplicate email or username | `ConflictException` | 409 |
| Bad credentials, inactive account, invalid refresh token, missing or invalid access token | `UnauthorizedException` | 401 |
| Email not verified, identity suspended/deleted/locked, or backfill conflict | `ForbiddenException` | 403 |
| identity-service unreachable, timed out, misconfigured (`INTERNAL_SERVICE_TOKEN`) or returned an unexpected status | `ServiceUnavailableException` | 503 |
| `/me` for a user who has been deleted | `NotFoundException` | 404 |

---

## 4. API

All paths are relative to `/api/auth`.

| Method | Path | Auth | Description | Success | Errors |
|---|---|---|---|---|---|
| POST | `/register` | – | Create the identity and the user (same ID) and request an email code | 201 user (without password) | 400, 409, 503 |
| POST | `/login` | – | Log in and get tokens | 200 token pair | 400, 401, 403, 503 |
| POST | `/refresh?refresh_token=<jwt>` | – | Exchange a refresh token for a new pair | 200 token pair | 401, 403, 503 |
| GET | `/me` | Bearer (access) | Current user profile | 200 user | 401, 404 |
| POST | `/logout` | Bearer (access) | Acknowledge logout; tokens aren't revoked | 200 `{ message }` | 401 |
| GET | `/health` | – | Checks database connectivity (`SELECT 1`, 2 s timeout) | 200 `{ status: 'ok', service, checks: { database: 'up' } }`; 503 with the failed check marked `down` | – |

### Examples

```http
POST /api/auth/register
Content-Type: application/json

{ "email": "jane@example.com", "username": "jane_d", "password": "s3cretpass", "personalityArchetype": "mentor" }
```

```json
{
  "id": "6f1c…", "email": "jane@example.com", "username": "jane_d",
  "personalityArchetype": "mentor", "avatarConfig": {}, "communicationStyle": "casual",
  "isActive": true, "isVerified": false,
  "createdAt": "2026-10-01T10:00:00.000Z", "updatedAt": "2026-10-01T10:00:00.000Z"
}
```

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "jane@example.com", "password": "s3cretpass" }
```

```json
{ "access_token": "<jwt>", "refresh_token": "<jwt>", "token_type": "bearer" }
```

---

## 5. Data model

**Table `users`**, created by migration `20260722124750_init`.

| Column | Type | Constraints / default | Notes |
|---|---|---|---|
| `id` | UUID | PK | Generated by Prisma (`uuid()`) |
| `email` | TEXT | NOT NULL, UNIQUE (`users_email_key`) | |
| `username` | TEXT | NOT NULL, UNIQUE (`users_username_key`) | Updated by companion-service |
| `hashed_password` | TEXT | NOT NULL | bcrypt hash |
| `personality_archetype` | TEXT | NOT NULL, default `'friend'` | Updated by companion-service; read by chat-service and analytics-service |
| `avatar_config` | JSONB | NOT NULL, default `'{}'` | Updated by companion-service |
| `communication_style` | TEXT | NOT NULL, default `'casual'` | Updated by companion-service |
| `is_active` | BOOLEAN | NOT NULL, default `true` | Inactive users can't log in |
| `is_verified` | BOOLEAN | NOT NULL, default `false` | Nothing sets it yet |
| `created_at` | TIMESTAMP(3) | NOT NULL, default now | |
| `updated_at` | TIMESTAMP(3) | NOT NULL | Prisma `@updatedAt` |

```mermaid
erDiagram
    users {
        uuid id PK
        text email UK
        text username UK
        text hashed_password
        text personality_archetype
        jsonb avatar_config
        text communication_style
        bool is_active
        bool is_verified
        timestamp created_at
        timestamp updated_at
    }
    users ||--o{ conversations : "user_id (logical, chat-service)"
    users ||--o{ memories : "user_id (logical, memory-service)"
```

Relationships to `conversations` and `memories` are **logical only**: no foreign keys cross service boundaries.

---

## 6. Flows

### Register and login

```mermaid
sequenceDiagram
    participant C as Client
    participant A as auth-service
    participant DB as Postgres (users)
    participant I as identity-service (internal)
    C->>A: POST /register {email, username, password}
    A->>DB: findUnique(email), findUnique(username)
    alt email or username exists
        A-->>C: 409 Conflict
    else
        A->>I: POST /internal/identities {id: new UUID, email, displayName}
        I-->>A: 201 identity (PENDING_VERIFICATION)
        A->>A: bcrypt.hash(password, 12)
        A->>DB: INSERT users (id = identity.id)
        A->>I: POST /internal/identities/:id/verifications {channel: email}
        A-->>C: 201 user (no hash)
    end
    Note over C,I: user verifies through POST /api/identity/verify-email
    C->>A: POST /login {email, password}
    A->>DB: findUnique(email)
    A->>A: bcrypt.compare, check isActive
    A->>I: GET /internal/identities/:id
    alt suspended, deleted or email not verified
        A-->>C: 403
    else
        A-->>C: 200 {access_token, refresh_token}
    end
```

### Token refresh and use by other services

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Any protected service
    participant A as auth-service
    C->>S: GET … (Authorization: Bearer access)
    S->>S: verify signature + exp + type=access (local)
    alt token expired
        S-->>C: 401
        C->>A: POST /refresh?refresh_token=…
        A->>A: verify, require type=refresh, user exists
        A-->>C: 200 new token pair
        C->>S: retry with new access token
    end
```

---

## 7. Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | no | `3000` | HTTP port |
| `DATABASE_URL` | yes | – | Postgres connection string |
| `JWT_SECRET` | yes | `changeme` (fallback in code; never use it outside local development) | HS256 signing secret, shared with all services. Compose maps it from `SECRET_KEY`. |
| `JWT_ACCESS_EXPIRE_MINUTES` | no | `30` | Access token lifetime |
| `JWT_REFRESH_EXPIRE_DAYS` | no | `7` | Refresh token lifetime |
| `CORS_ORIGINS` | no | `http://localhost:3000` | Comma-separated list of allowed origins |
| `NODE_ENV` | no | – | `production` hides Swagger |
| `IDENTITY_SERVICE_URL` | no | `http://identity-service:3001` | Base URL of identity-service's internal API |
| `INTERNAL_SERVICE_TOKEN` | **yes** | – | Sent as `x-internal-token` to identity-service. If unset, register, login and refresh return 503. |
| `REQUIRE_VERIFIED_EMAIL` | no | unset: `true` when `NODE_ENV=production`, otherwise `false` | Require a verified email to log in. `true`/`false` overrides the environment default. |
| `JWT_REFRESH_SECRET` | – | – | Passed in by compose but **not read by the code** |
| `REDIS_URL` | – | – | Passed in by compose but **not used** |

---

## 8. Run, build and test

```bash
cd services/auth-service
npm install
npx prisma generate
npx prisma migrate deploy        # requires DATABASE_URL
npm run start:dev                # http://localhost:3000/api/auth/docs
npm run build && npm start       # production build
```

With Docker: `docker compose up -d --build auth-service`.

**Tests:** `npm test` runs 36 Jest unit tests in `test/`, which are kept out of `src/` so production builds don't include them. They cover:

- signup order and the shared ID, orphan recovery, and 409 and 503 cases
- login: the password is checked first, every blocked identity status, the email-verification default per environment and its overrides, and backfill (including the conflict case)
- refresh validation
- the identity-service client: status mapping, fail-closed 503, and best-effort verification requests

Lint runs from the repository root with `npm run lint`.

---

## 9. Known limitations and follow-ups

- The refresh token is signed with the same secret as the access token, and `JWT_REFRESH_SECRET` is unused.
- The refresh token travels as a **query parameter** (`?refresh_token=`), so it can end up in proxy and access logs. A request body or an HttpOnly cookie would be safer.
- There is no token revocation or rotation. Logout requires a token but doesn't invalidate it.
- There is no rate limiting or brute-force protection on `/login`.
- The `changeme` fallback secret in code means a misconfigured deployment silently signs tokens with a known secret.
- Logging uses `console.log` and is not structured.
- There are no unit, integration or e2e tests.
- `users` and `identities` share IDs, but signup isn't atomic across the two services. A crash between the two writes leaves an orphan identity, which the next signup with that email reuses.
- Suspending or deleting an identity doesn't revoke tokens already issued; they stay valid until expiry.
- In production, the email-verification requirement blocks every new user until an email provider exists. Development skips it by default.
