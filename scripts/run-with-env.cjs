const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function findEnvFile(startDir) {
  let current = startDir;
  while (true) {
    const candidate = path.join(current, ".env");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function loadEnvFile(file) {
  if (!file) return {};
  if (!fs.existsSync(file)) return {};

  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/run-with-env.cjs <command> [...args]");
  process.exit(1);
}

const result = spawnSync(command, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    ...loadEnvFile(findEnvFile(process.cwd()))
  }
});

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
