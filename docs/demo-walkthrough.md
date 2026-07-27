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

1. Enter:

```text
Target role: Senior Frontend Developer
Interview stack: React, Next.js, TypeScript, Tailwind CSS
Question focus: dashboard filtering and role-based access
```

2. Select `Easy`, `Medium`, or `Hard`.
3. Click **Generate questions**.
4. Choose one generated question and paste this sample answer:

```text
I would clarify requirements, identify constraints, propose a scalable design, explain tradeoffs, cover failure modes, add tests, define metrics, and monitor the release with logs and dashboards.
```

5. Click **Evaluate answer**.
6. Confirm the score and feedback update.

### 2. Real-Time Coding Room

Enter:

```text
Target role: QA Automation Engineer
Coding topic: release risk
Difficulty: Medium
Language: JavaScript
```

Click **Generate challenge**. Then replace the starter code with this JavaScript solution:

```js
const fs = require("fs");

const lines = fs.readFileSync(0, "utf8").trim().split(/\r?\n/);

function solve(inputLines) {
  const count = Number(inputLines[0]);
  const result = [];
  const seen = new Set();

  for (let i = 1; i <= count && i < inputLines.length; i += 1) {
    const [feature, resultStatus, severity] = inputLines[i].trim().split(/\s+/);
    if (!feature || !resultStatus || !severity) continue;
    if (resultStatus === "fail" && severity === "high" && !seen.has(feature)) {
      seen.add(feature);
      result.push(feature);
    }
  }

  return result.join(",");
}

console.log(solve(lines));
```

Use stdin:

```text
6
login pass high
filters fail high
charts fail medium
filters fail high
rbac fail high
export pass high
```

Expected output:

```text
filters,rbac
```

In demo mode the UI confirms the run path. Real execution requires the backend plus Judge0 configuration.

Also test chat:

```text
Can we optimize this to O(n)?
```

### 3. Resume Analyzer

Use `docs/sample-resume.txt`, or upload a `.pdf`, `.docx`, `.txt`, or `.md` resume when the backend is running.

Paste a target job description and click **Analyze resume**. Frontend-only demo mode can compare the job description locally after a file is selected. Real PDF/DOCX extraction and saved analysis run in the API service after sign-in.

### 4. Career Roadmap

Use:

```text
Target role: Product Manager
Current skills: Roadmapping, stakeholder management, analytics, user research
```

Click **Generate** and confirm the roadmap updates.

### 5. Analytics

Click **Refresh analytics**. In demo mode, confirm the section asks you to sign in for saved analytics and does not show fake metrics.

### 6. Admin And Subscription

1. Click **Load overview**.
2. Click **Activate pro**.
3. In demo mode, confirm both actions ask for sign-in instead of showing fake admin or billing data.

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
