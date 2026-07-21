# Backend Validation

Use this guide when Docker, PostgreSQL, and Redis are available locally. These checks verify the real backend persistence path instead of only the no-cost frontend demo path.

## Start Services

```bash
cp .env.example .env
npm run setup:local
```

## Run Apps

Use two terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

## Check Health

```text
http://localhost:4000/api/health
http://localhost:4000/api/health/ready
```

The readiness endpoint should report `database: true`.

## Run Backend E2E

```bash
npm run test:e2e:backend
```

This signs in with:

```text
demo@develevate.ai / Password123!
```

Then it checks backend-backed interview and roadmap flows. If external AI keys are not configured, the API still uses local deterministic fallbacks.
