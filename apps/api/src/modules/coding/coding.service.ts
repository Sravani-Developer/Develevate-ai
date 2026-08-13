import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { codingSchemas, type CreateCodingRoomInput } from "@develevate/shared";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ts from "typescript";
import { PrismaService } from "../prisma/prisma.service";

const execFileAsync = promisify(execFile);

@Injectable()
export class CodingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  createRoom(userId: string, input: CreateCodingRoomInput) {
    return this.prisma.codingRoom.create({
      data: {
        ownerId: userId,
        title: input.title,
        language: input.language,
        code: input.code
      }
    });
  }

  async updateCode(roomId: string, code: string) {
    return this.prisma.codingRoom.update({ where: { id: roomId }, data: { code } });
  }

  async execute(raw: unknown) {
    const input = codingSchemas.execute.parse(raw);
    const sourceCode = normalizeSourceForLanguage(input.language, input.sourceCode);
    const judgeUrl = this.config.get<string>("JUDGE0_API_URL");
    const judgeKey = this.config.get<string>("JUDGE0_API_KEY");
    if (!judgeUrl || !judgeKey) {
      return executeWithDocker(input.language, sourceCode, input.stdin ?? "");
    }
    const response = await fetch(`${judgeUrl}/submissions?base64_encoded=false&wait=true`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-RapidAPI-Key": judgeKey
      },
      body: JSON.stringify({
        source_code: sourceCode,
        language_id: languageId(input.language),
        stdin: input.stdin ?? ""
      })
    });
    return response.json();
  }
}

function languageId(language: string) {
  return { javascript: 63, typescript: 74, python: 71, java: 62, cpp: 54 }[language] ?? 63;
}

function decodePastedSource(sourceCode: string) {
  return sourceCode
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

function normalizeSourceForLanguage(language: string, sourceCode: string) {
  const decoded = decodePastedSource(sourceCode);
  if (language !== "cpp") return decoded;

  const hasUsefulInclude = /^#include\s+[<"].+[>"]/m.test(decoded);
  if (hasUsefulInclude) return decoded;

  const withoutBrokenIncludes = decoded
    .split(/\r?\n/)
    .filter((line) => !/^#include\s*$/.test(line.trim()))
    .join("\n");

  return [
    "#include <iostream>",
    "#include <sstream>",
    "#include <string>",
    "#include <vector>",
    "#include <unordered_map>",
    "#include <set>",
    withoutBrokenIncludes
  ].join("\n");
}

async function executeWithDocker(language: string, sourceCode: string, stdin: string) {
  const definition = getDockerDefinition(language, sourceCode);
  const workspace = await mkdtemp(join(tmpdir(), "develevate-run-"));
  const dockerCli = resolveDockerCli();

  try {
    await writeFile(join(workspace, definition.fileName), definition.sourceCode, "utf8");
    await writeFile(join(workspace, "input.txt"), stdin, "utf8");

    const startedAt = Date.now();
    const result = await execFileAsync(
      dockerCli,
      [
        "run",
        "--rm",
        "--network",
        "none",
        "--memory",
        "256m",
        "--cpus",
        "0.5",
        "-v",
        `${workspace}:/work:ro`,
        definition.image,
        "sh",
        "-lc",
        definition.command
      ],
      { timeout: 20000, maxBuffer: 1024 * 256 }
    );

    return {
      status: "completed",
      stdout: result.stdout,
      stderr: result.stderr,
      time: ((Date.now() - startedAt) / 1000).toFixed(3)
    };
  } catch (error) {
    return normalizeDockerError(error);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

function resolveDockerCli() {
  if (process.env.DOCKER_CLI_PATH) return process.env.DOCKER_CLI_PATH;

  if (process.platform === "win32") {
    const candidates = [
      process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Programs", "DockerDesktop", "resources", "bin", "docker.exe") : "",
      process.env.USERPROFILE ? join(process.env.USERPROFILE, "AppData", "Local", "Programs", "DockerDesktop", "resources", "bin", "docker.exe") : "",
      "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
      "C:\\Program Files\\Docker\\Docker\\resources\\docker.exe"
    ];

    const dockerDesktopCli = candidates.find((candidate) => candidate && existsSync(candidate));
    if (dockerDesktopCli) return dockerDesktopCli;
  }

  return "docker";
}

function getDockerDefinition(language: string, sourceCode: string) {
  if (language === "javascript") {
    return {
      image: "node:22-alpine",
      fileName: "main.js",
      sourceCode,
      command: "node /work/main.js < /work/input.txt"
    };
  }

  if (language === "typescript") {
    return {
      image: "node:22-alpine",
      fileName: "main.js",
      sourceCode: transpileTypeScript(sourceCode),
      command: "node /work/main.js < /work/input.txt"
    };
  }

  if (language === "python") {
    return {
      image: "python:3.12-alpine",
      fileName: "main.py",
      sourceCode,
      command: "python /work/main.py < /work/input.txt"
    };
  }

  if (language === "java") {
    return {
      image: "eclipse-temurin:21-jdk",
      fileName: "Main.java",
      sourceCode,
      command: "javac /work/Main.java -d /tmp && java -cp /tmp Main < /work/input.txt"
    };
  }

  if (language === "cpp") {
    return {
      image: "gcc:14",
      fileName: "main.cpp",
      sourceCode,
      command: "g++ /work/main.cpp -O2 -std=c++17 -o /tmp/main && /tmp/main < /work/input.txt"
    };
  }

  return {
    image: "node:22-alpine",
    fileName: "main.js",
    sourceCode,
    command: "node /work/main.js < /work/input.txt"
  };
}

function transpileTypeScript(sourceCode: string) {
  return ts.transpileModule(sourceCode, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }).outputText;
}

function normalizeDockerError(error: unknown) {
  const executionError = error as {
    code?: number | string;
    killed?: boolean;
    signal?: string;
    stdout?: string;
    stderr?: string;
    message?: string;
  };

  if (executionError.killed || executionError.signal === "SIGTERM") {
    return {
      status: "timeout",
      stdout: executionError.stdout ?? "",
      stderr: "Execution timed out after 20 seconds.",
      time: null
    };
  }

  const stderr = executionError.stderr || executionError.message || "Docker execution failed.";
  const dockerMissing = /ENOENT|docker daemon|cannot connect|is not recognized as|executable file not found/i.test(stderr);

  return {
    status: dockerMissing ? "runner_unavailable" : "failed",
    stdout: executionError.stdout ?? "",
    stderr: dockerMissing
      ? "Hosted code execution is not configured. Use local Docker for development, or configure Judge0 for production code execution."
      : stderr,
    time: null
  };
}
