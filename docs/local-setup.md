# Local Setup

This project can run locally without paid services. Docker Desktop provides PostgreSQL and Redis, while AI and Judge0 integrations stay optional.

## Requirements

- Node.js 18.20 or newer
- npm 10 or newer
- Docker Desktop

## First-Time Setup

Create your local env file:

```bash
cp .env.example .env
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

Install dependencies:

```bash
npm install
```

Start PostgreSQL and Redis, sync the database, seed demo users, and run readiness checks:

```bash
npm run setup:local
```

Demo users:

```text
demo@develevate.ai / Password123!
admin@develevate.ai / Password123!
```

## Run The App

Open two terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Then open:

```text
http://localhost:3000
```

API health checks:

```text
http://localhost:4000/api/health
http://localhost:4000/api/health/ready
```

## Useful Commands

```bash
npm run docker:up
npm run docker:down
npm run db:generate
npm run db:push
npm run db:seed
npm run doctor
npm run test:e2e:backend
```

## Cost Notes

No paid services are required for local development. These integrations are optional and can stay empty in `.env`:

```text
OPENAI_API_KEY
JUDGE0_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
AWS_S3_BUCKET
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```
