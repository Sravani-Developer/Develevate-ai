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
  const focus = input.focus?.trim() || `${input.role} interview readiness`;
  const questionSets = {
    EASY: [
      {
        prompt: `Easy fundamentals: for ${focus}, explain the simplest useful ${input.role} feature you would build with ${stack}. Cover user flow, basic state, and one validation rule.`,
        category: "technical",
        expectedSignals: ["user flow", "state", "validation", "basic testing"]
      },
      {
        prompt: `Easy boundaries: for ${focus}, list what belongs in the UI, what belongs in the API, and what data contract you would expect.`,
        category: "architecture",
        expectedSignals: ["component boundaries", "API boundary", "state", "validation"]
      },
      {
        prompt: `Easy testing: describe the happy path and two error cases you would test for ${focus} using ${stack}.`,
        category: "testing",
        expectedSignals: ["unit tests", "integration tests", "happy path", "error path"]
      }
    ],
    MEDIUM: [
      {
        prompt: `Medium implementation: design an authenticated ${focus} workflow for a ${input.role} using ${stack}. Include API boundaries, state ownership, caching, testing, and tradeoffs.`,
        category: "technical",
        expectedSignals: ["auth", "API contract", "state ownership", "caching", "tradeoffs"]
      },
      {
        prompt: `Medium data modeling: how would you model filters, permissions, validation, and persisted user preferences for ${focus}?`,
        category: "systems",
        expectedSignals: ["filters", "permissions", "validation", "preferences"]
      },
      {
        prompt: `Medium debugging: users report intermittent failures in ${focus}. Walk through reproduction, logs, metrics, likely root causes, and a safe fix plan.`,
        category: "debugging",
        expectedSignals: ["reproduction", "logs", "metrics", "rollback"]
      }
    ],
    HARD: [
      {
        prompt: `Hard architecture: design a production-ready ${focus} system for a ${input.role} using ${stack}. Include scaling limits, failure modes, observability, security, and measurable success metrics.`,
        category: "technical",
        expectedSignals: ["architecture", "scaling", "failure modes", "observability", "security", "metrics"]
      },
      {
        prompt: `Hard reliability: how would you handle high traffic, stale permissions, retries, partial failures, and backward-compatible API changes for ${focus}?`,
        category: "systems",
        expectedSignals: ["rate limiting", "permissions", "idempotency", "retries", "compatibility"]
      },
      {
        prompt: `Hard launch strategy: create a phased rollout, alerting, rollback, and incident-response plan for a risky ${focus} release.`,
        category: "production",
        expectedSignals: ["feature flags", "alerts", "rollback", "success metrics"]
      }
    ]
  } satisfies Record<CreateInterviewInput["difficulty"], Array<{ prompt: string; category: string; expectedSignals: string[] }>>;

  return {
    questions: questionSets[input.difficulty].map((question, index) => ({ id: `q${index + 1}`, ...question }))
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
