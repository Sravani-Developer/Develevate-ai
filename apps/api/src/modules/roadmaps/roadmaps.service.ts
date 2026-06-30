import { Injectable } from "@nestjs/common";
import { roadmapSchemas } from "@develevate/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "../ai/ai.service";

@Injectable()
export class RoadmapsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService
  ) {}

  async create(userId: string, raw: unknown) {
    const input = roadmapSchemas.create.parse(raw);
    const fallback = {
      milestones: [
        { week: 1, focus: "Gap analysis", deliverables: ["Baseline assessment", "Portfolio backlog"] },
        { week: 4, focus: "Core skills", deliverables: ["Two production-style projects", "Interview drills"] },
        { week: input.timelineWeeks, focus: "Launch", deliverables: ["Resume polish", "Mock interview loop"] }
      ]
    };
    const result = await this.ai.generateJson(
      "Create a career roadmap as JSON with milestones array. Include week, focus, deliverables, and metrics.",
      JSON.stringify(input),
      fallback
    );
    return this.prisma.roadmap.create({
      data: {
        userId,
        targetRole: input.targetRole,
        currentSkills: input.currentSkills,
        timelineWeeks: input.timelineWeeks,
        milestones: result.milestones
      }
    });
  }

  list(userId: string) {
    return this.prisma.roadmap.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }
}
