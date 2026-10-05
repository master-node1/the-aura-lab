# The Aura Lab

A microservices backend for **AuraLab**, an emotionally aware AI companion with real-time chat, long-term memory and selectable personalities, plus the first services (customer, identity, authorization) of an enterprise e-commerce platform.

| | |
|---|---|
| **Languages** | TypeScript (NestJS 10), Python 3.11 (FastAPI) |
| **Data** | PostgreSQL 16 (Prisma 6), Redis 7, ChromaDB 0.4 |
| **AI** | OpenAI through LangChain |
| **Edge** | nginx API gateway on `:8001` |
| **Runtime** | Docker Compose |

---

## Documentation index

### Architecture and services

| Document | Contents |
|---|---|
| [services/README.md](services/README.md) | **Start here.** System HLD, service index, shared database ER diagram, Redis contracts, end-to-end flows, configuration and known issues |
| [services/DEPLOYMENT.md](services/DEPLOYMENT.md) | Docker Compose deployment and troubleshooting |
| [docs/architecture/ci-cd.md](docs/architecture/ci-cd.md) | GitHub Actions CI/CD: tests and Terraform plans for changed services; manual ECR build and EKS deploy |

### Per-service docs

Each README covers HLD, LLD, API, DB schema, flows, configuration and limitations.

| Domain | Service | README |
|---|---|---|
| Edge | api-gateway (nginx) | [services/api-gateway](services/api-gateway/README.md) |
| Companion | auth-service | [services/auth-service](services/auth-service/README.md) |
| Companion | chat-service | [services/chat-service](services/chat-service/README.md) |
| Companion | memory-service | [services/memory-service](services/memory-service/README.md) |
| Companion | companion-service | [services/companion-service](services/companion-service/README.md) |
| Companion | analytics-service | [services/analytics-service](services/analytics-service/README.md) |
| Companion | ai-service (Python) | [services/ai-service](services/ai-service/README.md) |
| E-commerce | customer-service | [services/customer-service](services/customer-service/README.md) |
| E-commerce | identity-service | [services/identity-service](services/identity-service/README.md) |
| E-commerce | authorization-service | [services/authorization-service](services/authorization-service/README.md) |
| Library | shared types | [services/shared](services/shared/README.md) |

### Product and business requirements

| Document | Contents |
|---|---|
| [docs/README.md](docs/README.md) | E-commerce PRD index: executive summary, goals, scope, NFRs, roles |
| [docs/modules/](docs/modules) | Functional specs per module (customer, identity, authorization, AI chat, …) |
| [docs/business-rules/](docs/business-rules) | Pricing, payments, refunds, returns, coupons, inventory |
| [docs/workflows/](docs/workflows) | Order, payment, return, inventory and warehouse flows |
| [docs/api/](docs/api) | Target API specs |

### Contributor guidance

| Document | Contents |
|---|---|
| [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md) | Rules for AI coding agents |
| [docs/ai/master-prompt.md](docs/ai/master-prompt.md) | Detailed engineering process |

---

## Repository structure

```text
.
├── docker-compose.yml        # full stack: postgres, redis, chromadb, 9 services + gateway
├── .env.example              # root environment template (copy to .env)
├── services/                 # all microservices (see services/README.md)
├── docs/                     # product requirements, business rules, workflows
├── infra/terraform/service/  # per-service EKS deployment stack (Terraform)
├── .github/                  # CI/CD workflow and change-detection script
├── .githooks/                # pre-commit / pre-push quality hooks
├── eslint.config.mjs         # ESLint config for all TypeScript services
└── package.json              # root lint / quality scripts
```

## Quick start

```sh
cp .env.example .env          # then set SECRET_KEY, INTERNAL_SERVICE_TOKEN and OPENAI_API_KEY
docker compose up -d --build
curl http://localhost:8001/health

# make an existing identity the first admin
docker compose exec authorization-service node dist/cli/assign-role.js <identityId>
```

With `NODE_ENV=production`, new users must verify their email before logging in, and no email provider exists yet. For local development, set `NODE_ENV=development` in `.env`: the email check is skipped, verification codes are returned as `devCode` by the internal API, and Swagger is enabled. Override the check with `REQUIRE_VERIFIED_EMAIL=true` or `false`. See [identity-service §3.6](services/identity-service/README.md#36-verification-delivery).

Swagger UI for each NestJS service is at `/api/<service>/docs` when `NODE_ENV` isn't `production` (compose defaults to `production`, so set `NODE_ENV=development` in `.env` to see it). The [service index](services/README.md#service-index) lists the ports and routes, and [known issues](services/README.md#cross-cutting-known-issues) lists the problems that currently affect startup.

## Local quality checks

Install the repository's linting tools and enable its Git hooks:

```sh
npm install
npm run hooks:install
```

The pre-commit hook checks whitespace and lints staged TypeScript files. The
pre-push hook runs ESLint across the TypeScript services and checks Python
syntax in `services/ai-service`. Run the full checks manually with
`npm run quality`. Run the unit tests with `npm test` (each tested service needs `npm install` first).
