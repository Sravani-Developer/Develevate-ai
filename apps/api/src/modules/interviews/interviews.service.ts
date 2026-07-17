import { Injectable } from "@nestjs/common";
import { interviewSchemas, type AnswerInterviewInput, type CreateInterviewInput } from "@develevate/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "../ai/ai.service";

@Injectable()
export class InterviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService
  ) {}

  async create(userId: string, raw: unknown) {
    const input = interviewSchemas.create.parse(raw);
    const fallback = createLocalInterview(input);
    const generated = await this.ai.generateJson(
      "Return JSON with a questions array. Each question has id, prompt, category, and expectedSignals.",
      JSON.stringify(input),
      fallback
    );
    return this.prisma.interview.create({
      data: {
        userId,
        role: input.role,
        stack: input.stack,
        difficulty: input.difficulty,
        type: input.type,
        questions: generated.questions
      }
    });
  }

  list(userId: string, page = 1) {
    return this.prisma.interview.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      skip: (page - 1) * 20
    });
  }

  async evaluate(userId: string, interviewId: string, raw: unknown) {
    const input: AnswerInterviewInput = interviewSchemas.answer.parse(raw);
    const interview = await this.prisma.interview.findFirstOrThrow({ where: { id: interviewId, userId } });
    const fallback = evaluateLocally(input.answer);
    const evaluation = await this.ai.generateJson(
      "Evaluate the answer and return JSON: score, strengths, weaknesses, suggestions.",
      JSON.stringify({ interview, answer: input }),
      fallback
    );
    return this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        score: Number(evaluation.score),
        strengths: evaluation.strengths as string[],
        weaknesses: evaluation.weaknesses as string[],
        suggestions: evaluation.suggestions as string[],
        answers: input
      }
    });
  }

  streamPrompt(interviewId: string) {
    return this.ai.streamEvaluation(`Stream concise coaching feedback for interview ${interviewId}.`);
  }
}

function createLocalInterview(input: CreateInterviewInput) {
  const stack = input.stack.slice(0, 4).join(", ");
  const depth =
    input.difficulty === "HARD"
      ? "Include scaling limits, failure modes, observability, and tradeoffs."
      : input.difficulty === "MEDIUM"
        ? "Include API boundaries, data flow, testing, and tradeoffs."
        : "Focus on fundamentals, clear steps, and edge cases.";

  const technicalPrompt =
    input.difficulty === "HARD"
      ? `Design a production-ready ${input.role} feature using ${stack}. ${depth}`
      : `Explain how you would build a ${input.role} feature using ${stack}. ${depth}`;

  return {
    questions: [
      {
        id: "q1",
        prompt: technicalPrompt,
        category: "technical",
        expectedSignals: ["architecture", "edge cases", "testing", "tradeoffs"]
      },
      {
        id: "q2",
        prompt: `Describe a time you improved reliability or developer velocity on a ${input.role} project.`,
        category: "behavioral",
        expectedSignals: ["ownership", "impact", "metrics", "reflection"]
      },
      {
        id: "q3",
        prompt: `How would you debug a production issue in a stack that uses ${stack}?`,
        category: "systems",
        expectedSignals: ["triage", "logs", "metrics", "rollback plan"]
      }
    ]
  };
}

function evaluateLocally(answer: string) {
  const normalized = answer.toLowerCase();
  const signals = [
    ["tradeoff", "tradeoffs"],
    ["test", "tests", "testing"],
    ["metric", "metrics", "measure"],
    ["edge", "failure", "fallback"],
    ["scale", "scaling", "performance"],
    ["monitor", "logging", "observability"]
  ];
  const matchedSignals = signals.filter((group) => group.some((word) => normalized.includes(word))).length;
  const lengthScore = Math.min(20, Math.floor(answer.trim().length / 80));
  const score = Math.min(95, 62 + matchedSignals * 5 + lengthScore);

  return {
    score,
    strengths: [
      matchedSignals >= 3 ? "Covers multiple production-readiness signals" : "Gives a clear starting approach",
      answer.length > 350 ? "Provides enough detail for evaluation" : "Keeps the answer concise"
    ],
    weaknesses: [
      normalized.includes("metric") ? "Could add more specific business impact" : "Add measurable impact or success metrics",
      normalized.includes("test") ? "Could describe test coverage in more depth" : "Mention concrete validation and test strategy"
    ],
    suggestions: [
      "Use a structure: clarify requirements, propose design, explain tradeoffs, cover failure modes, and close with metrics.",
      "Add one concrete example from a project to make the answer more credible."
    ]
  };
}
