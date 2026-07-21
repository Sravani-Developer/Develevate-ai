# DevElevate AI Roadmap

This roadmap keeps the next improvements aligned with the project goal: a standout full-stack portfolio project that can be evaluated without paid services.

## Completed Foundation

- Full-stack monorepo with Next.js, NestJS, Prisma, PostgreSQL, shared Zod contracts, and Docker Compose.
- JWT auth, refresh flow, role guard, admin overview, subscriptions boundary, analytics, interviews, coding room, resume analyzer, roadmaps, and health checks.
- Demo-mode frontend fallbacks and deterministic local backend fallbacks for no-cost usage.
- PDF/DOCX/text/Markdown resume extraction.
- Jest, Vitest, Playwright E2E, production build, and GitHub Actions verification.

## No-Cost Next Work

1. Backend-authenticated E2E path
   - Run Postgres/Redis locally.
   - Seed demo users.
   - Add Playwright coverage for real login and saved backend flows.

2. More resume intelligence
   - Add section-level scoring for summary, skills, projects, and impact.
   - Add clearer suggestions for missing metrics and role keywords.

3. Coding room polish without Judge0
   - Add local static code review hints.
   - Add problem prompts, constraints, and expected complexity.

4. Documentation assets
   - Add screenshots or short GIFs for GitHub.
   - Add architecture diagram for frontend, API, database, and integrations.

## Optional Paid Or External Work

- OpenAI API for live AI interview/resume/roadmap generation.
- Judge0 execution provider for real code execution.
- Google OAuth client for social login.
- Stripe Checkout and webhook-backed subscriptions.
- S3/R2 object storage for production resume files.
- Hosted production deployment with persistent database.

## Definition Of Done For Future Changes

- Typecheck passes.
- Unit tests pass.
- Playwright E2E passes.
- Production build passes.
- README/docs are updated when behavior changes.
- No paid dependency is required for the default demo path.
