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
    const fallback = {
      questions: [
        { id: "q1", prompt: `Explain a challenging ${input.stack[0]} problem you solved.`, category: "technical" },
        { id: "q2", prompt: "Describe a time you handled ambiguous requirements.", category: "behavioral" },
        { id: "q3", prompt: "How would you debug a production latency regression?", category: "systems" }
      ]
    };
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
    const fallback = {
      score: 82,
      strengths: ["Clear reasoning", "Good tradeoff awareness"],
      weaknesses: ["Add more measurable impact"],
      suggestions: ["Use STAR structure and cite production metrics"]
    };
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
