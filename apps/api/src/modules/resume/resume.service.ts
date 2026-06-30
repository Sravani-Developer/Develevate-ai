import { Injectable } from "@nestjs/common";
import { resumeSchemas } from "@develevate/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "../ai/ai.service";

@Injectable()
export class ResumeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService
  ) {}

  async analyze(userId: string, file: Express.Multer.File, raw: unknown) {
    const input = resumeSchemas.analyze.parse(raw);
    const text = file.buffer.toString("utf8").slice(0, 12000);
    const fallback = {
      skills: ["TypeScript", "React", "Node.js"],
      projects: ["AI interview platform"],
      atsScore: 78,
      matchedKeywords: ["frontend", "backend", "API"],
      missingKeywords: ["observability", "CI/CD"],
      improvements: ["Quantify impact", "Add deployment details", "Mirror keywords from the job description"]
    };
    const result = await this.ai.generateJson(
      "Analyze resume text. Return JSON: skills, projects, atsScore, matchedKeywords, missingKeywords, improvements.",
      JSON.stringify({ resume: text, jobDescription: input.jobDescription }),
      fallback
    );
    return this.prisma.resumeAnalysis.create({
      data: {
        userId,
        fileName: file.originalname,
        extractedText: text,
        skills: result.skills as string[],
        projects: result.projects as string[],
        atsScore: Number(result.atsScore),
        matchedKeywords: result.matchedKeywords as string[],
        missingKeywords: result.missingKeywords as string[],
        improvements: result.improvements as string[]
      }
    });
  }
}
