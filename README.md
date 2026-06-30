# DevElevate AI

Production-grade AI-powered developer interview and career platform built from the supplied specification.

## Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn-style components, Zustand, TanStack Query, React Hook Form, Zod, Monaco Editor, Socket.io client
- Backend: NestJS, Prisma, PostgreSQL, Redis, JWT refresh rotation, Passport, BullMQ, Pino, Multer, Socket.io
- AI and external APIs: OpenAI for interview/resume/roadmap intelligence, Judge0 for code execution, S3-ready file storage boundary
- DevOps: Docker Compose, CI workflow, environment-based config, test scripts

## Quick Start

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis
npm run build
npm run dev -w apps/api
npm run dev -w apps/web
```

Frontend runs on `http://localhost:3000`; API runs on `http://localhost:4000`.

## Production Notes

- Deploy `apps/web` to Vercel.
- Deploy `apps/api` to Railway or Render.
- Use Neon PostgreSQL, Upstash Redis, and AWS S3.
- Set secure secrets for JWT, cookies, OAuth, OpenAI, Judge0, and AWS.
