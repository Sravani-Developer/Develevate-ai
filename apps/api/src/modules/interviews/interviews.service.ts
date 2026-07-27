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
        prompt: `For ${focus}, explain how you would build a small ${input.role} feature using ${stack}. Focus on clear steps, data flow, and edge cases.`,
        category: "technical",
        expectedSignals: ["requirements", "data flow", "edge cases", "basic testing"]
      },
      {
        prompt: `For ${focus}, what frontend and backend responsibilities would you separate in a ${input.role} feature?`,
        category: "architecture",
        expectedSignals: ["component boundaries", "API boundary", "state", "validation"]
      },
      {
        prompt: `How would you test a simple ${focus} feature built with ${stack}?`,
        category: "testing",
        expectedSignals: ["unit tests", "integration tests", "happy path", "error path"]
      }
    ],
    MEDIUM: [
      {
        prompt: `Design an authenticated ${focus} workflow for a ${input.role} role using ${stack}. Include API boundaries, data flow, testing, and tradeoffs.`,
        category: "technical",
        expectedSignals: ["auth", "API contract", "persistence", "tradeoffs"]
      },
      {
        prompt: `How would you model data and validation for a medium-complexity ${focus} feature?`,
        category: "systems",
        expectedSignals: ["schema", "validation", "relationships", "migration"]
      },
      {
        prompt: `A user reports intermittent failures in a ${focus} workflow built with ${stack}. How would you debug it?`,
        category: "debugging",
        expectedSignals: ["reproduction", "logs", "metrics", "rollback"]
      }
    ],
    HARD: [
      {
        prompt: `Design a production-ready ${focus} feature for a ${input.role} role using ${stack}. Include scaling limits, failure modes, observability, and tradeoffs.`,
        category: "technical",
        expectedSignals: ["architecture", "scaling", "failure modes", "observability"]
      },
      {
        prompt: `How would you handle high traffic, retries, and partial failures in a ${focus} system using ${stack}?`,
        category: "systems",
        expectedSignals: ["rate limiting", "idempotency", "queues", "retries"]
      },
      {
        prompt: `Create a rollout and monitoring plan for a risky ${focus} release.`,
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
