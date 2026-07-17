import { BadRequestException, Injectable } from "@nestjs/common";
import { resumeSchemas } from "@develevate/shared";
import mammoth from "mammoth";
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
    const text = await extractResumeText(file);
    const fallback = analyzeResumeLocally(text, input.jobDescription);
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

async function extractResumeText(file?: Express.Multer.File) {
  if (!file?.buffer?.length) {
    throw new BadRequestException("Resume file is required.");
  }

  const supportedTypes = new Set([
    "text/plain",
    "text/markdown",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream"
  ]);
  const extension = file.originalname.toLowerCase().split(".").pop();
  if (!supportedTypes.has(file.mimetype) && !["txt", "md", "pdf", "docx"].includes(extension ?? "")) {
    throw new BadRequestException("Resume upload supports .txt, .md, .pdf, and .docx files.");
  }

  let text = "";
  if (extension === "pdf" || file.mimetype === "application/pdf") {
    const pdfModule = await import("pdf-parse");
    const parsePdf = pdfModule.default as unknown as (data: Buffer) => Promise<{ text: string }>;
    const result = await parsePdf(file.buffer);
    text = result.text;
  } else if (extension === "docx" || file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    text = result.value;
  } else {
    text = file.buffer.toString("utf8");
  }

  text = text.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
  if (text.length < 20) {
    throw new BadRequestException("Resume text is too short to analyze or could not be extracted from the uploaded file.");
  }
  return text.slice(0, 12000);
}

function analyzeResumeLocally(text: string, jobDescription = "") {
  const resumeText = text.toLowerCase();
  const jobText = jobDescription.toLowerCase();
  const knownSkills = [
    "TypeScript",
    "JavaScript",
    "React",
    "Next.js",
    "Node.js",
    "NestJS",
    "PostgreSQL",
    "Prisma",
    "Docker",
    "GitHub Actions",
    "CI/CD",
    "Socket.io",
    "REST APIs",
    "JWT",
    "Testing",
    "Playwright",
    "Redis",
    "AWS"
  ];
  const skills = knownSkills.filter((skill) => resumeText.includes(skill.toLowerCase()));
  const jobKeywords = knownSkills.filter((skill) => jobText.includes(skill.toLowerCase()));
  const matchedKeywords = jobKeywords.length ? jobKeywords.filter((skill) => resumeText.includes(skill.toLowerCase())) : skills.slice(0, 8);
  const missingKeywords = jobKeywords.filter((skill) => !resumeText.includes(skill.toLowerCase())).slice(0, 8);
  const projectLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /project|platform|dashboard|api|application/i.test(line))
    .slice(0, 5);

  const quantified = /\b\d+%|\b\d+\+|\b\d+\s*(users|requests|tests|features|projects|seconds|minutes)\b/i.test(text);
  const deploymentReady = /deploy|docker|ci\/cd|github actions|vercel|render|aws|cloud/i.test(text);
  const score = Math.min(
    96,
    58 + Math.min(22, skills.length * 3) + Math.min(12, matchedKeywords.length * 3) + (quantified ? 4 : 0) + (deploymentReady ? 4 : 0)
  );

  return {
    skills: skills.length ? skills : ["TypeScript", "React", "Node.js"],
    projects: projectLines.length ? projectLines : ["Full-stack developer platform"],
    atsScore: score,
    matchedKeywords,
    missingKeywords: missingKeywords.length ? missingKeywords : ["Observability", "Cloud deployment", "Performance metrics"],
    improvements: [
      quantified ? "Keep quantified impact visible near each project." : "Add measurable impact such as latency, users, test coverage, or delivery time.",
      deploymentReady ? "Highlight deployment and CI/CD details in the project summary." : "Add deployment, CI/CD, and production-readiness details.",
      missingKeywords.length ? `Mirror missing role keywords: ${missingKeywords.slice(0, 4).join(", ")}.` : "Tailor the summary to the exact target role."
    ]
  };
}
