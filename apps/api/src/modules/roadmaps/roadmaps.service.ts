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
    const fallback = createLocalRoadmap(input);
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

function createLocalRoadmap(input: { targetRole: string; currentSkills: string[]; timelineWeeks: number }) {
  const skills = input.currentSkills.length ? input.currentSkills.slice(0, 5).join(", ") : "current stack";
  const midpoint = Math.max(2, Math.floor(input.timelineWeeks / 2));
  const finalPrep = Math.max(midpoint + 1, input.timelineWeeks - 2);

  return {
    milestones: [
      {
        week: 1,
        focus: `Baseline ${input.targetRole} readiness using ${skills}`,
        deliverables: ["Skill-gap checklist", "Portfolio backlog", "Interview baseline score"],
        metrics: ["Complete one timed mock interview", "Identify top 5 missing keywords"]
      },
      {
        week: Math.max(2, Math.floor(input.timelineWeeks / 4)),
        focus: "Build proof through one production-style feature",
        deliverables: ["Backend API", "Frontend workflow", "Database persistence", "Automated tests"],
        metrics: ["One deployed or locally runnable feature", "Typecheck, tests, and build passing"]
      },
      {
        week: midpoint,
        focus: "Deepen system design and debugging readiness",
        deliverables: ["Architecture notes", "Failure-mode checklist", "Observability plan"],
        metrics: ["Explain tradeoffs in under 5 minutes", "Document rollback and monitoring strategy"]
      },
      {
        week: finalPrep,
        focus: "Interview loop and resume targeting",
        deliverables: ["Role-specific resume", "Mock interview feedback log", "Project demo script"],
        metrics: ["ATS score above 85", "Three polished STAR stories"]
      },
      {
        week: input.timelineWeeks,
        focus: `Launch applications for ${input.targetRole}`,
        deliverables: ["Final portfolio walkthrough", "Recruiter pipeline", "Application tracker"],
        metrics: ["Apply to 20 targeted roles", "Follow up with measurable project outcomes"]
      }
    ]
  };
}
