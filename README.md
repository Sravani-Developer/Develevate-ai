# DevElevate AI

DevElevate AI is a full-stack developer interview and career platform. It combines AI mock interviews, collaborative coding rooms, resume analysis, career roadmap generation, analytics, subscriptions, and admin operations in one SaaS-style workspace.

## What This Project Demonstrates

- Production-style monorepo architecture with shared validation contracts.
- JWT auth with refresh-token rotation and secure cookie support.
- AI-backed workflows for interview feedback, resume review, and roadmap generation.
- Local deterministic fallback intelligence for no-cost demo and development flows.
- Realtime-ready coding room architecture with Socket.io and Judge0-ready execution.
- PostgreSQL data modeling with Prisma and repeatable demo seeding.
- CI verification for typecheck, tests, and production build.
- Deployment-ready frontend/backend/infra configuration.

## Tech Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS, Zustand, React Hook Form, Zod, Monaco Editor, Recharts, Lucide icons.
- Backend: NestJS, TypeScript, Prisma, PostgreSQL, Redis-ready config, JWT, Passport, Multer, Socket.io, Helmet, sanitization.
- AI and integrations: OpenAI-ready AI service, Judge0-ready code execution, Google OAuth dependency, S3-ready storage boundary.
- DevOps: npm workspaces, Docker Compose, GitHub Actions CI, Vercel/Render config.
- Testing: Jest for API tests, Vitest and Testing Library for frontend smoke tests.

## Monorepo Layout

```text
apps/
  api/       NestJS API, Prisma schema, auth, AI, coding, resume, roadmap, analytics
  web/       Next.js app and feature UI
packages/
  shared/    Shared Zod schemas and TypeScript types
infra/       Vercel and Render deployment config
```

## Local Setup

Requirements:

- Node.js 18.20+
- npm 10+
- Docker Desktop, or separate PostgreSQL and Redis services

Create env file:

```bash
cp .env.example .env
```

Start local services:

```bash
npm run docker:up
```

Install dependencies:

```bash
npm install
```

Check local readiness:

```bash
npm run doctor
```

Generate Prisma client and sync the local database:

```bash
npm run db:generate
npm run db:push
```

Seed demo data:

```bash
npm run db:seed
```

Or run the full free local setup in one command after creating `.env`:

```bash
npm run setup:local
```

Demo credentials:

```text
demo@develevate.ai / Password123!
admin@develevate.ai / Password123!
```

Run the API and web app:

```bash
npm run dev:api
npm run dev:web
```

Frontend: `http://localhost:3000`
API: `http://localhost:4000`

For a no-cost reviewer walkthrough, see [docs/demo-walkthrough.md](docs/demo-walkthrough.md).
For first-time Docker setup, see [docs/local-setup.md](docs/local-setup.md).
For a system overview, see [docs/architecture.md](docs/architecture.md).
For real backend validation, see [docs/backend-validation.md](docs/backend-validation.md).
For planned next work, see [docs/roadmap.md](docs/roadmap.md).
For contribution and verification expectations, see [CONTRIBUTING.md](CONTRIBUTING.md).

Operational checks:

```text
GET /api/health
GET /api/health/ready
```

`/api/health` is a lightweight liveness check. `/api/health/ready` verifies database connectivity and reports optional integration configuration.

## Environment Variables

Required for core local backend:

```text
DATABASE_URL
REDIS_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
COOKIE_SECRET
FRONTEND_URL
NEXT_PUBLIC_API_URL
```

Optional production integrations:

```text
OPENAI_API_KEY
JUDGE0_API_URL
JUDGE0_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
AWS_REGION
AWS_S3_BUCKET
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

## Verification

```bash
npm run doctor
npm run typecheck
npm test -- --runInBand
npm run test:e2e
npm run build
```

GitHub Actions runs the same verification flow on `main`, including Playwright browser coverage for the demo product flows.

## Current Feature Coverage

- Auth: email/password register/login, refresh endpoint, logout endpoint, demo-mode frontend fallback.
- Interviews: create interview, answer/evaluate, save score and AI feedback.
- Coding: create room, websocket room join, frontend code sync, chat, language/stdin controls, Judge0-ready execution endpoint.
- Resume: upload endpoint, PDF/DOCX/text/Markdown extraction, and AI analysis boundary.
- Roadmaps: AI-generated roadmap persistence.
- Analytics: saved interview/resume/roadmap dashboard data.
- Admin: role-protected platform overview.
- Subscriptions: checkout endpoint and subscription state model.
- Operations: liveness and readiness endpoints for local setup and deployment checks.

## Production Hardening Still Planned

- Real Google OAuth strategy and callback UI.
- Stripe Checkout and webhook-verified subscription state.
- Redis-backed distributed rate limiting.
- File-type validation and S3/R2 upload storage.
- More integration and end-to-end tests.

## Resume Positioning

Full-stack AI-powered developer interview and career SaaS platform with JWT auth, Prisma/PostgreSQL persistence, AI mock interviews, collaborative coding rooms, resume intelligence, career roadmaps, analytics, admin controls, Dockerized infrastructure, CI/CD, and deployment-ready configuration.
