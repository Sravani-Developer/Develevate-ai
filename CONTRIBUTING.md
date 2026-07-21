# Contributing

DevElevate AI is maintained as a production-style portfolio project. Changes should preserve the no-cost demo path unless they are explicitly marked as optional paid integrations.

## Local Checks

Run the main verification flow before opening a pull request:

```bash
npm run doctor
npm run typecheck
npm test -- --runInBand
npm run test:e2e
npm run build
```

`npm run doctor` may fail on machines that do not have Node 20+ or Docker configured. Treat that output as environment guidance, then run the remaining checks in a supported environment.

## Development Guidelines

- Keep shared request/response contracts in `packages/shared`.
- Keep demo/local fallback behavior working without paid API keys.
- Add or update tests when changing backend services, frontend flows, or validation behavior.
- Update README or docs when setup, verification, or product behavior changes.
- Do not commit generated folders such as `test-results`, `playwright-report`, `.next`, `dist`, or `coverage`.

## Paid Integrations

OpenAI, Judge0, Stripe, Google OAuth, and S3/R2 support should remain optional. The default reviewer path should still work without those services.
