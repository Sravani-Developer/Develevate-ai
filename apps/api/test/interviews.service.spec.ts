import { InterviewsService } from "../src/modules/interviews/interviews.service";

describe("InterviewsService", () => {
  it("creates role-aware local fallback questions when AI returns the fallback", async () => {
    const prisma = {
      interview: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "interview-1", ...data }))
      }
    };
    const ai = {
      generateJson: jest.fn().mockImplementation((_system, _user, fallback) => Promise.resolve(fallback))
    };
    const service = new InterviewsService(prisma as never, ai as never);

    await service.create("user-1", {
      role: "Full Stack AI Engineer",
      stack: ["TypeScript", "React", "NestJS", "PostgreSQL"],
      difficulty: "HARD",
      type: "MIXED"
    });

    const created = prisma.interview.create.mock.calls[0][0].data;
    expect(created.questions).toHaveLength(3);
    expect(created.questions[0].prompt).toContain("Full Stack AI Engineer");
    expect(created.questions[0].prompt).toContain("TypeScript, React, NestJS, PostgreSQL");
    expect(created.questions[0].expectedSignals).toEqual(expect.arrayContaining(["architecture", "testing", "tradeoffs"]));
  });

  it("scores local answer fallbacks from production-readiness signals", async () => {
    const prisma = {
      interview: {
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: "interview-1", userId: "user-1", questions: [] }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "interview-1", ...data }))
      }
    };
    const ai = {
      generateJson: jest.fn().mockImplementation((_system, _user, fallback) => Promise.resolve(fallback))
    };
    const service = new InterviewsService(prisma as never, ai as never);

    await service.evaluate("user-1", "interview-1", {
      questionId: "q1",
      answer:
        "I would clarify requirements, discuss scale and performance tradeoffs, add tests, define metrics, cover edge failures, and add monitoring and logging."
    });

    const update = prisma.interview.update.mock.calls[0][0].data;
    expect(update.score).toBeGreaterThanOrEqual(85);
    expect(update.strengths).toEqual(expect.arrayContaining(["Covers multiple production-readiness signals"]));
    expect(update.suggestions[0]).toContain("clarify requirements");
  });
});
