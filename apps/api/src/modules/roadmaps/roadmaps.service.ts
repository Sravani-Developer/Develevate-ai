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
  const skills = input.currentSkills.length ? input.currentSkills.slice(0, 6).join(", ") : "current stack";
  const weeks = Math.max(4, Math.min(16, input.timelineWeeks));
  const baseMilestones = [
    {
      focus: `Baseline ${input.targetRole} readiness using ${skills}`,
      deliverables: ["Skill-gap matrix", "Resume keyword baseline", "Mock interview scorecard"],
      metrics: ["Complete one timed mock interview", "Identify top 5 missing role keywords"]
    },
    {
      focus: `Strengthen core fundamentals for ${input.targetRole}`,
      deliverables: ["Concept review", "Practice problems", "Role-specific notes"],
      metrics: ["Complete one timed practice set", "Explain key concepts without notes"]
    },
    {
      focus: `Build a portfolio feature with ${skills}`,
      deliverables: ["Feature scope", "Implementation plan", "Working demo path"],
      metrics: ["Demo one complete user workflow", "Document tradeoffs and constraints"]
    },
    {
      focus: `Add data, state, or workflow depth for ${input.targetRole}`,
      deliverables: ["Data model or state model", "Validation rules", "Error-state handling"],
      metrics: ["Explain edge cases clearly", "Show realistic sample data"]
    },
    {
      focus: `Add intelligent or automation proof for ${input.targetRole}`,
      deliverables: ["Input contract", "Result-quality rubric", "Fallback behavior"],
      metrics: ["Produce repeatable output", "Show graceful behavior when integrations are missing"]
    },
    {
      focus: `Deepen system design and debugging readiness for ${input.targetRole}`,
      deliverables: ["Architecture diagram", "Failure-mode checklist", "Debugging playbook"],
      metrics: ["Explain tradeoffs in under 5 minutes", "Cover scaling, caching, and retries"]
    },
    {
      focus: `Testing and quality hardening for ${skills}`,
      deliverables: ["Unit tests", "Integration path", "Manual QA checklist"],
      metrics: ["Typecheck, tests, and build pass", "Document known optional integrations"]
    },
    {
      focus: `Production operations story for ${input.targetRole}`,
      deliverables: ["Health or readiness checks", "Logging notes", "Monitoring plan"],
      metrics: ["Explain what gets monitored", "Show recovery or fallback behavior"]
    },
    {
      focus: "Portfolio narrative and resume targeting",
      deliverables: ["Resume project bullets", "Demo script", "GitHub README proof"],
      metrics: ["ATS score above 85", "Use metrics in every major project bullet"]
    },
    {
      focus: "Interview loop execution",
      deliverables: ["DSA practice log", "System design drills", "Behavioral STAR stories"],
      metrics: ["Complete 3 mock interviews", "Prepare 6 strong project stories"]
    },
    {
      focus: "Application pipeline and recruiter readiness",
      deliverables: ["Target-company list", "Referral messages", "Application tracker"],
      metrics: ["Apply to 15 targeted roles", "Follow up within 5 business days"]
    },
    {
      focus: `Launch applications for ${input.targetRole}`,
      deliverables: ["Final portfolio walkthrough", "GitHub pinned repos", "Production demo checklist"],
      metrics: ["Apply to 20 targeted roles", "Demo project end to end in under 7 minutes"]
    }
  ];

  return {
    milestones: baseMilestones.slice(0, weeks).map((milestone, index) => ({ week: index + 1, ...milestone }))
  };
}
