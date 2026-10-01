# TheAuraLab Microservices Architecture

## Overview
The TheAuraLab backend has been split into 6 microservices:

```
services/
├── shared/               # Shared TypeScript types and constants
├── auth-service/         # NestJS - Authentication & user management
├── chat-service/         # NestJS - WebSocket, conversations, messages  
├── memory-service/       # NestJS - Memory CRUD, Redis short-term
├── companion-service/    # NestJS - Personality profiles, avatar config
├── analytics-service/    # NestJS - Read-only stats & dashboards
└── ai-service/           # Python - Agent orchestration, LLM, emotion
```

## Service Ports
- **auth-service**: 3000
- **chat-service**: 3000  
- **memory-service**: 3000
- **companion-service**: 3000
- **analytics-service**: 3000
- **ai-service**: 3000

## Inter-Service Communication

### Redis Pub/Sub Channels
- `TheAuraLab:ai:process` - Chat → AI (process message)
- `TheAuraLab:ai:response` - AI → Chat (send response)
- `TheAuraLab:memory:save` - AI → Memory (save extracted memory)

### HTTP Calls
- AI Service → Memory Service (semantic search, save memories)
- All services validate JWT but don't call Auth Service per-request

## Setup Instructions

### 1. Install dependencies for each service
```bash
cd services/shared && npm install && npm run build
cd ../auth-service && npm install
cd ../chat-service && npm install  
cd ../memory-service && npm install
cd ../companion-service && npm install
cd ../analytics-service && npm install
cd ../ai-service && pip install -r requirements.txt
```

### 2. Generate Prisma clients
```bash
cd services/auth-service && npx prisma generate && npx prisma db push
cd ../chat-service && npx prisma generate && npx prisma db push
cd ../memory-service && npx prisma generate && npx prisma db push
cd ../companion-service && npx prisma generate
cd ../analytics-service && npx prisma generate
```

### 3. Environment variables
