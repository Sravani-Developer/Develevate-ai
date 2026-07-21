# DevElevate AI Demo Walkthrough

This walkthrough shows how to evaluate DevElevate AI without paid API keys. The app includes local/demo fallbacks for the major product flows, so reviewers can inspect the UX and architecture before connecting OpenAI, Judge0, Stripe, OAuth, or object storage.

## No-Cost Demo Mode

Start the frontend:

```bash
npm run dev:web
```

Open:

```text
http://localhost:3000
```

In the Secure access panel, choose **Start demo mode**.

## Flows To Check

### 1. AI Mock Interview

1. Select `Easy`, `Medium`, or `Hard`.
2. Paste this sample answer:

```text
I would clarify requirements, identify constraints, propose a scalable design, explain tradeoffs, cover failure modes, add tests, define metrics, and monitor the release with logs and dashboards.
```

3. Click **Evaluate answer**.
4. Confirm the score and feedback update.

### 2. Real-Time Coding Room

Use JavaScript:

```js
const fs = require("fs");

const input = fs.readFileSync(0, "utf8").trim().split(/\s+/).map(Number);
const target = input[0];
const nums = input.slice(1);

function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i += 1) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}

console.log(twoSum(nums, target).join(" "));
```

Use stdin:

```text
9
2 7 11 15
```

In demo mode the UI confirms the run path. Real execution requires the backend plus Judge0 configuration.

Also test chat:

```text
Can we optimize this to O(n)?
```

### 3. Resume Analyzer

Use `docs/sample-resume.txt`, or upload a `.pdf`, `.docx`, `.txt`, or `.md` resume when the backend is running.

In frontend-only demo mode, clicking **Analyze resume** without a backend shows local demo analysis. Real PDF/DOCX extraction runs in the API service.

### 4. Career Roadmap

Use:

```text
Target role: Full Stack AI Engineer
Current skills: React, TypeScript, Node.js, NestJS, PostgreSQL, Prisma, Docker
```

Click **Generate** and confirm the roadmap updates.

### 5. Analytics

Click **Refresh analytics** and confirm the demo metrics remain visible.

### 6. Admin And Subscription

1. Click **Load overview**.
2. Click **Activate pro**.
3. Confirm the admin and subscription cards update.

## Full Backend Check

For real persistence and backend parsing:

```bash
cp .env.example .env
npm run setup:local
npm run dev:api
npm run dev:web
```

Then sign in with:

```text
demo@develevate.ai / Password123!
```

Health endpoints:

```text
GET http://localhost:4000/api/health
GET http://localhost:4000/api/health/ready
```
