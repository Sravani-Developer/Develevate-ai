import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { codingSchemas } from "@develevate/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CodingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  createRoom(userId: string, title: string, language = "typescript") {
    return this.prisma.codingRoom.create({
      data: {
        ownerId: userId,
        title,
        language,
        code: "function solve(input) {\\n  return input;\\n}\\n"
      }
    });
  }

  async updateCode(roomId: string, code: string) {
    return this.prisma.codingRoom.update({ where: { id: roomId }, data: { code } });
  }

  async execute(raw: unknown) {
    const input = codingSchemas.execute.parse(raw);
    const judgeUrl = this.config.get<string>("JUDGE0_API_URL");
    const judgeKey = this.config.get<string>("JUDGE0_API_KEY");
    if (!judgeUrl || !judgeKey) {
      return {
        status: "skipped",
        stdout: "Judge0 is not configured. Add JUDGE0_API_URL and JUDGE0_API_KEY.",
        stderr: "",
        time: null
      };
    }
    const response = await fetch(`${judgeUrl}/submissions?base64_encoded=false&wait=true`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-RapidAPI-Key": judgeKey
      },
      body: JSON.stringify({
        source_code: input.sourceCode,
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
