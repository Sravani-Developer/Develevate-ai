const { spawnSync } = require("child_process");

const result = spawnSync(
  process.execPath,
  ["./node_modules/@playwright/test/cli.js", "test", "tests/e2e/backend-auth.spec.ts"],
  {
    stdio: "inherit",
    env: { ...process.env, BACKEND_E2E: "1" }
  }
);

process.exit(result.status ?? 1);
