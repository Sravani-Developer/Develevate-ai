const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function dockerCommand() {
  const localAppData = process.env.LOCALAPPDATA;
  const dockerDesktop = localAppData ? path.join(localAppData, "Programs", "DockerDesktop", "resources", "bin", "docker.exe") : undefined;
  const candidates =
    process.platform === "win32"
      ? [dockerDesktop, "docker.cmd", "docker"].filter(Boolean)
      : ["docker"];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return "docker";
}

const args = process.argv.slice(2);
const result = spawnSync(dockerCommand(), args, {
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
