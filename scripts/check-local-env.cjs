const fs = require("fs");
const net = require("net");
const path = require("path");
const { execFileSync } = require("child_process");

const requiredEnv = [
  "DATABASE_URL",
  "REDIS_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "COOKIE_SECRET",
  "FRONTEND_URL",
  "NEXT_PUBLIC_API_URL"
];

const optionalEnv = ["OPENAI_API_KEY", "JUDGE0_API_KEY", "GOOGLE_CLIENT_ID", "AWS_S3_BUCKET"];
const checks = [];

function add(status, label, detail) {
  checks.push({ status, label, detail });
}

function commandVersion(command, args = ["--version"]) {
  const candidates = process.platform === "win32" && !command.endsWith(".cmd") ? [command, `${command}.cmd`, ...windowsCommandCandidates(command)] : [command];
  for (const candidate of candidates) {
    try {
      return execFileSync(candidate, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      // Try the next platform-specific command name.
    }
  }
  return undefined;
}

function windowsCommandCandidates(command) {
  if (process.platform !== "win32") return [];
  const localAppData = process.env.LOCALAPPDATA;
  if (command !== "docker" || !localAppData) return [];
  return [path.join(localAppData, "Programs", "DockerDesktop", "resources", "bin", "docker.exe")];
}

function compareVersions(actual, minimum) {
  const a = actual.split(".").map(Number);
  const b = minimum.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
}

function readEnvFile() {
  if (!fs.existsSync(".env")) {
    add("warn", ".env file", "Missing .env. Copy .env.example to .env before running the backend.");
    return {};
  }
  const values = {};
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    values[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  add("pass", ".env file", "Found local .env file.");
  return values;
}

function checkNode() {
  const nodeVersion = process.versions.node;
  if (compareVersions(nodeVersion, "18.20.0") >= 0) {
    add("pass", "Node.js", `Using ${nodeVersion}.`);
  } else {
    add("fail", "Node.js", `Using ${nodeVersion}. Project requires >=18.20.0.`);
  }

  const npmVersion = npmVersionFromEnv() ?? commandVersion("npm", ["--version"]);
  if (!npmVersion) {
    add("fail", "npm", "npm is not available on PATH.");
  } else if (compareVersions(npmVersion, "10.0.0") >= 0) {
    add("pass", "npm", `Using ${npmVersion}.`);
  } else {
    add("fail", "npm", `Using ${npmVersion}. Project requires >=10.0.0.`);
  }
}

function npmVersionFromEnv() {
  if (!process.env.npm_execpath) return undefined;
  try {
    return execFileSync(process.execPath, [process.env.npm_execpath, "--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return undefined;
  }
}

async function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port, timeout: 700 });
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(false));
  });
}

async function checkPorts() {
  for (const [port, label] of [
    [3000, "Web app"],
    [4000, "API"],
    [5432, "PostgreSQL"],
    [6379, "Redis"]
  ]) {
    const open = await isPortOpen(port);
    add(open ? "pass" : "warn", `${label} port ${port}`, open ? "Port is reachable." : "Port is not currently reachable.");
  }
}

function checkEnv(values) {
  for (const key of requiredEnv) {
    const value = values[key];
    if (!value) {
      add("fail", `env ${key}`, "Missing required local backend setting.");
    } else if (value.includes("change-me")) {
      add("warn", `env ${key}`, "Uses placeholder value. Replace before realistic backend testing.");
    } else {
      add("pass", `env ${key}`, "Configured.");
    }
  }

  for (const key of optionalEnv) {
    add(values[key] ? "pass" : "warn", `env ${key}`, values[key] ? "Configured." : "Optional integration not configured.");
  }
}

function checkDocker() {
  const dockerVersion = commandVersion("docker", ["--version"]);
  if (!dockerVersion) {
    add("warn", "Docker", "Docker is not available on PATH. Backend database stack needs Docker or separate Postgres/Redis.");
    return;
  }
  add("pass", "Docker", dockerVersion);
}

function checkFiles() {
  for (const file of ["package-lock.json", "docker-compose.yml", "apps/api/prisma/schema.prisma"]) {
    add(fs.existsSync(file) ? "pass" : "fail", file, fs.existsSync(file) ? "Found." : "Missing.");
  }
}

function print() {
  const icon = { pass: "PASS", warn: "WARN", fail: "FAIL" };
  console.log("\nDevElevate local environment check\n");
  for (const check of checks) {
    console.log(`${icon[check.status]} ${check.label}: ${check.detail}`);
  }
  const failures = checks.filter((check) => check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warn").length;
  console.log(`\nSummary: ${failures} failed, ${warnings} warnings, ${checks.length - failures - warnings} passed.`);
  if (failures > 0) process.exitCode = 1;
}

async function main() {
  checkNode();
  checkDocker();
  checkFiles();
  const env = readEnvFile();
  checkEnv(env);
  await checkPorts();
  print();
}

void main();
