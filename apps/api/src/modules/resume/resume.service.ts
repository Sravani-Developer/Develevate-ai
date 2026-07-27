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
    text = await extractPdfText(file);
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

async function extractPdfText(file: Express.Multer.File) {
  try {
    ensurePdfTextPolyfills();
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
    const result = await parser.getText();
    return result.text;
  } catch {
    return pdfExtractionFallback(file);
  }
}

function ensurePdfTextPolyfills() {
  const globalScope = globalThis as Record<string, unknown>;

  globalScope.DOMMatrix ??= class DOMMatrix {};
  globalScope.ImageData ??= class ImageData {};
  globalScope.Path2D ??= class Path2D {};
}

function pdfExtractionFallback(file: Express.Multer.File) {
  return [
    `PDF resume uploaded: ${file.originalname}.`,
    "PDF text extraction is unavailable in this local runtime, so analysis used uploaded file metadata and the target job description.",
    "For deeper PDF parsing, use Node 20+ or upload DOCX/TXT/Markdown."
  ].join(" ");
}

function analyzeResumeLocally(text: string, jobDescription = "") {
  const resumeText = text.toLowerCase();
  const jobText = jobDescription.toLowerCase();
  const knownSkills: SkillKeyword[] = [
    { name: "HTML5", aliases: ["html5", "html"], weight: 2 },
    { name: "CSS3", aliases: ["css3", "css"], weight: 2 },
    { name: "TypeScript", aliases: ["typescript", "type script", "ts"], weight: 4 },
    { name: "JavaScript", aliases: ["javascript", "java script", "js"], weight: 4 },
    { name: "React", aliases: ["react", "react.js", "reactjs"], weight: 4 },
    { name: "Angular", aliases: ["angular"], weight: 3 },
    { name: "Next.js", aliases: ["next.js", "nextjs", "next js"], weight: 2 },
    { name: "Responsive UI", aliases: ["responsive", "responsive ui", "responsive web"], weight: 2 },
    { name: "Accessibility", aliases: ["accessibility", "accessible", "a11y", "wcag"], weight: 3 },
    { name: "UX/UI", aliases: ["ux/ui", "ux ui", "ui/ux", "user experience", "user interface"], weight: 1 },
    { name: "Node.js", aliases: ["node.js", "nodejs", "node js"], weight: 4 },
    { name: "Python", aliases: ["python"], weight: 4 },
    { name: "FastAPI", aliases: ["fastapi", "fast api"], weight: 3 },
    { name: "NestJS", aliases: ["nestjs", "nest.js", "nest js"], weight: 2 },
    { name: "REST APIs", aliases: ["rest apis", "restful apis", "rest api", "restful api", "restful"], weight: 4 },
    { name: "GraphQL", aliases: ["graphql", "graph ql"], weight: 3 },
    { name: "PostgreSQL", aliases: ["postgresql", "postgres", "postgre sql"], weight: 3 },
    { name: "SQL Server", aliases: ["sql server", "mssql", "ms sql"], weight: 2 },
    { name: "SQL", aliases: ["sql", "relational database", "relational databases"], weight: 2 },
    { name: "MongoDB", aliases: ["mongodb", "mongo db"], weight: 3 },
    { name: "Cosmos DB", aliases: ["cosmos db", "cosmosdb"], weight: 2 },
    { name: "NoSQL", aliases: ["nosql", "no sql"], weight: 2 },
    { name: "Prisma", aliases: ["prisma"], weight: 1 },
    { name: "Docker", aliases: ["docker", "container"], weight: 2 },
    { name: "AWS", aliases: ["aws", "amazon web services"], weight: 4 },
    { name: "AWS Lambda", aliases: ["aws lambda", "lambda", "serverless"], weight: 2 },
    { name: "Cloud-native", aliases: ["cloud-native", "cloud native", "cloud"], weight: 2 },
    { name: "Kafka", aliases: ["kafka", "apache kafka"], weight: 2 },
    { name: "Messaging systems", aliases: ["messaging", "message queue", "event-driven", "event driven", "pub/sub"], weight: 2 },
    { name: "Git", aliases: ["git"], weight: 2 },
    { name: "GitHub Actions", aliases: ["github actions", "github ci"], weight: 3 },
    { name: "CI/CD", aliases: ["ci/cd", "cicd", "ci cd", "continuous integration", "continuous delivery"], weight: 4 },
    { name: "Infrastructure as Code", aliases: ["infrastructure-as-code", "infrastructure as code", "iac", "terraform", "cloudformation"], weight: 3 },
    { name: "Automated testing", aliases: ["automated testing", "automated tests", "test automation"], weight: 3 },
    { name: "Unit testing", aliases: ["unit testing", "unit tests", "jest", "vitest"], weight: 3 },
    { name: "Integration testing", aliases: ["integration testing", "integration tests"], weight: 3 },
    { name: "Playwright", aliases: ["playwright"], weight: 1 },
    { name: "Agile/Scrum", aliases: ["agile", "scrum"], weight: 2 },
    { name: "Code reviews", aliases: ["code review", "code reviews", "peer review", "peer reviews"], weight: 2 },
    { name: "Security best practices", aliases: ["security", "secure", "owasp"], weight: 3 },
    { name: "Open source", aliases: ["open-source", "open source", "github community"], weight: 1 },
    { name: "Redis", aliases: ["redis"], weight: 1 },
    { name: "JWT", aliases: ["jwt", "json web token"], weight: 1 },
    { name: "Socket.io", aliases: ["socket.io", "socketio", "websocket", "websockets"], weight: 1 }
  ];
  const skills = knownSkills.filter((skill) => hasSkill(resumeText, skill.aliases)).map((skill) => skill.name);
  const jobKeywords = knownSkills.filter((skill) => hasSkill(jobText, skill.aliases));
  const matched = jobKeywords.filter((skill) => hasSkill(resumeText, skill.aliases));
  const missing = jobKeywords.filter((skill) => !hasSkill(resumeText, skill.aliases));
  const extractedTerms = extractJobTerms(jobDescription);
  const matchedTerms = extractedTerms.filter((term) => hasTerm(resumeText, term));
  const missingTerms = extractedTerms.filter((term) => !hasTerm(resumeText, term));
  const matchedKeywords = unique([...matched.map((skill) => skill.name), ...matchedTerms]).slice(0, 14);
  const missingKeywords = unique([...missing.sort((a, b) => b.weight - a.weight).map((skill) => skill.name), ...missingTerms]).slice(0, 12);
  const projectLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /project|platform|dashboard|api|application/i.test(line))
    .slice(0, 5);

  const quantified = /\b\d+%|\b\d+\+|\b\d+\s*(users|requests|tests|features|projects|seconds|minutes)\b/i.test(text);
  const deploymentReady = /deploy|docker|ci\/cd|github actions|vercel|render|aws|cloud/i.test(text);
  const requestedWeight = jobKeywords.reduce((total, skill) => total + skill.weight, 0);
  const matchedWeight = matched.reduce((total, skill) => total + skill.weight, 0);
  const extractedScore = extractedTerms.length ? matchedTerms.length / extractedTerms.length : 0;
  const skillScore = requestedWeight ? matchedWeight / requestedWeight : Math.min(1, skills.length / 10);
  const keywordScore = extractedTerms.length && requestedWeight ? skillScore * 0.65 + extractedScore * 0.35 : extractedTerms.length ? extractedScore : skillScore;
  const experienceScore = scoreExperienceMatch(resumeText, jobText);
  const evidenceScore = (quantified ? 0.08 : 0) + (deploymentReady ? 0.06 : 0) + (projectLines.length ? 0.06 : 0);
  const rawScore = 38 + keywordScore * 45 + experienceScore * 8 + evidenceScore * 100;
  const score = Math.max(35, Math.min(96, Math.round(rawScore)));

  return {
    skills,
    projects: projectLines,
    atsScore: score,
    matchedKeywords,
    missingKeywords,
    improvements: [
      quantified ? "Keep quantified impact visible near each project." : "Add measurable impact such as latency, users, test coverage, or delivery time.",
      deploymentReady ? "Highlight deployment and CI/CD details in the project summary." : "Add deployment, CI/CD, and production-readiness details.",
      missingKeywords.length ? `Mirror missing role keywords: ${missingKeywords.slice(0, 5).join(", ")}.` : "Tailor the summary to the exact target role and job description."
    ]
  };
}

type SkillKeyword = {
  name: string;
  aliases: string[];
  weight: number;
};

function hasSkill(text: string, aliases: string[]) {
  return aliases.some((alias) => {
    const normalized = alias.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\ /g, "\\s+");
    return new RegExp(`(^|[^a-z0-9])${normalized}([^a-z0-9]|$)`, "i").test(text);
  });
}

function hasTerm(text: string, term: string) {
  const normalized = normalizeText(term);
  if (!normalized) return false;
  if (normalized.length <= 3) return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalized)}([^a-z0-9]|$)`, "i").test(text);
  return text.includes(normalized);
}

function extractJobTerms(jobDescription: string) {
  const normalized = normalizeText(selectRelevantJobText(jobDescription));
  if (!normalized) return [];

  const stopWords = new Set([
    "about",
    "active",
    "adherence",
    "also",
    "all",
    "and",
    "any",
    "are",
    "as",
    "at",
    "be",
    "build",
    "candidate",
    "chance",
    "change",
    "collaborate",
    "company",
    "consistent",
    "currently",
    "degree",
    "develop",
    "developer",
    "development",
    "environment",
    "equivalent",
    "experience",
    "familiarity",
    "fast",
    "field",
    "focused",
    "great",
    "happen",
    "heart",
    "help",
    "hire",
    "high",
    "implement",
    "including",
    "innovation",
    "join",
    "knowledge",
    "least",
    "looking",
    "maintain",
    "major",
    "modern",
    "must",
    "one",
    "other",
    "people",
    "place",
    "places",
    "practical",
    "preferably",
    "preferred",
    "professional",
    "proficiency",
    "proud",
    "related",
    "required",
    "requires",
    "requiring",
    "responsibilities",
    "role",
    "services",
    "skills",
    "solutions",
    "strong",
    "such",
    "team",
    "teams",
    "the",
    "this",
    "through",
    "tools",
    "using",
    "with",
    "work",
    "will",
    "where",
    "world",
    "within",
    "you",
    "years"
  ]);

  const protectedPhrases = [
    "agile/scrum",
    "automated testing",
    "cloud native",
    "code quality",
    "code reviews",
    "continuous learning",
    "data layers",
    "event driven",
    "fast paced",
    "full stack",
    "graphql apis",
    "infrastructure as code",
    "integration testing",
    "messaging systems",
    "open source",
    "peer reviews",
    "rapid prototyping",
    "restful apis",
    "security best practices",
    "serverless computing",
    "software engineering",
    "stakeholder coordination",
    "third party services",
    "unit testing",
    "ux/ui design",
    "web applications"
  ];

  const phrases = protectedPhrases.filter((phrase) => normalized.includes(phrase));
  const tokens = normalized
    .split(/[^a-z0-9+#./-]+/)
    .map((token) => token.trim().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""))
    .filter((token) => token.length > 2 && !stopWords.has(token) && !/^\d+$/.test(token));

  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);

  const tokenTerms = [...counts.entries()]
    .filter(([token]) => !stopWords.has(token))
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([token]) => token);

  const bigrams: string[] = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const first = tokens[index] ?? "";
    const second = tokens[index + 1] ?? "";
    if (!isUsefulTermToken(first, stopWords) || !isUsefulTermToken(second, stopWords)) continue;
    bigrams.push(`${first} ${second}`);
  }

  return unique([...phrases, ...bigrams.slice(0, 12), ...tokenTerms])
    .filter((term) => isUsefulJobTerm(term, stopWords))
    .slice(0, 24);
}

function selectRelevantJobText(jobDescription: string) {
  const lines = jobDescription.replace(/\r\n/g, "\n").split("\n");
  const sectionStarts = [
    "where you",
    "what you'll do",
    "what you’ll do",
    "about you",
    "full-stack product engineering",
    "generative ai",
    "general",
    "key responsibilities",
    "required qualifications",
    "preferred"
  ];
  const selected: string[] = [];
  let include = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (sectionStarts.some((start) => trimmed.toLowerCase().startsWith(start))) include = true;
    if (include && trimmed) selected.push(trimmed);
  }

  return selected.join(" ") || jobDescription;
}

function isUsefulTermToken(token: string, stopWords: Set<string>) {
  return token.length > 2 && !stopWords.has(token) && !/^\d+$/.test(token);
}

function isUsefulJobTerm(term: string, stopWords: Set<string>) {
  const normalized = term.toLowerCase().trim().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  if (!normalized || normalized.length < 4 || stopWords.has(normalized)) return false;
  const parts = normalized.split(/\s+/);
  if (parts.some((part) => stopWords.has(part))) return false;
  return true;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    result.push(normalized);
  }
  return result;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreExperienceMatch(resumeText: string, jobText: string) {
  const requiredYears = Number(jobText.match(/(\d+)\+?\s*years?/)?.[1] ?? 0);
  if (!requiredYears) return 0.5;
  const resumeYears = [...resumeText.matchAll(/(\d+)\+?\s*years?/g)].map((match) => Number(match[1]));
  const maxYears = resumeYears.length ? Math.max(...resumeYears) : 0;
  if (!maxYears) return 0;
  return Math.min(1, maxYears / requiredYears);
}
