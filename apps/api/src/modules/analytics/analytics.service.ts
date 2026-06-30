import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(userId: string) {
    const [interviews, resumes, roadmaps] = await Promise.all([
      this.prisma.interview.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      this.prisma.resumeAnalysis.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5 }),
      this.prisma.roadmap.count({ where: { userId } })
    ]);
    const scores = interviews.map((item) => item.score).filter((score): score is number => score !== null);
    const averageScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
    const weakAreas = interviews.flatMap((item) => item.weaknesses).reduce<Record<string, number>>((acc, item) => {
      acc[item] = (acc[item] ?? 0) + 1;
      return acc;
    }, {});
    const heatmap = interviews.reduce<Record<string, number>>((acc, item) => {
      const key = item.createdAt.toISOString().slice(0, 10);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    return {
      totalInterviews: interviews.length,
      averageScore,
      scoreSeries: interviews.map((item) => ({ date: item.createdAt, score: item.score ?? 0 })),
      weakAreas,
      heatmap,
      latestResumeScore: resumes[0]?.atsScore ?? null,
      roadmaps
    };
  }
}
