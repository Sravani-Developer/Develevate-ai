import { BadRequestException, Injectable } from "@nestjs/common";
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
    const text = extractResumeText(file);
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

function extractResumeText(file?: Express.Multer.File) {
  if (!file?.buffer?.length) {
    throw new BadRequestException("Resume file is required.");
  }

  const supportedTypes = new Set(["text/plain", "text/markdown", "application/octet-stream"]);
  const extension = file.originalname.toLowerCase().split(".").pop();
  if (!supportedTypes.has(file.mimetype) && extension !== "txt" && extension !== "md") {
    throw new BadRequestException("Resume text extraction currently supports .txt and .md files. PDF/DOCX parsing is planned for production storage integration.");
  }

  const text = file.buffer.toString("utf8").replace(/\u0000/g, "").trim();
  if (text.length < 20) {
    throw new BadRequestException("Resume text is too short to analyze.");
  }
  return text.slice(0, 12000);
}
