const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function upsertUser({ email, name, role }) {
  return prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: {
      email,
      name,
      role,
      passwordHash: await bcrypt.hash("Password123!", 12)
    }
  });
}

async function main() {
  const user = await upsertUser({ email: "demo@develevate.ai", name: "Demo Candidate", role: "USER" });
  const admin = await upsertUser({ email: "admin@develevate.ai", name: "Platform Admin", role: "ADMIN" });

  await prisma.subscription.deleteMany({ where: { userId: user.id } });
  await prisma.codingRoom.deleteMany({ where: { ownerId: user.id } });
  await prisma.roadmap.deleteMany({ where: { userId: user.id } });
  await prisma.resumeAnalysis.deleteMany({ where: { userId: user.id } });
  await prisma.interview.deleteMany({ where: { userId: user.id } });

  await prisma.interview.create({
    data: {
      userId: user.id,
      role: "Full-stack developer",
      stack: ["TypeScript", "React", "NestJS", "PostgreSQL"],
      difficulty: "MEDIUM",
      type: "MIXED",
      score: 86,
      strengths: ["Clear system tradeoff discussion", "Good API design reasoning"],
      weaknesses: ["Add more measurable production metrics"],
      suggestions: ["Use a concise STAR structure and quantify reliability impact."],
      questions: [
        { id: "q1", prompt: "Design a rate limiter for a public API.", category: "systems" },
        { id: "q2", prompt: "How would you debug a production latency regression?", category: "technical" }
      ],
      answers: { questionId: "q1", answer: "Use Redis counters, sliding windows, and route-level quotas." }
    }
  });

  await prisma.resumeAnalysis.create({
    data: {
      userId: user.id,
      fileName: "demo-resume.txt",
      extractedText: "Full-stack developer with React, TypeScript, NestJS, PostgreSQL, Redis, CI/CD, and cloud deployment experience.",
      skills: ["React", "TypeScript", "NestJS", "PostgreSQL", "Redis"],
      projects: ["AI-powered developer interview and career platform"],
      atsScore: 88,
      matchedKeywords: ["TypeScript", "React", "NestJS", "PostgreSQL"],
      missingKeywords: ["Observability", "Kubernetes"],
      improvements: ["Add measurable impact, deployment scale, and production monitoring details."]
    }
  });

  await prisma.roadmap.create({
    data: {
      userId: user.id,
      targetRole: "Full-stack AI engineer",
      currentSkills: ["React", "TypeScript", "Node.js"],
      timelineWeeks: 12,
      milestones: [
        { week: 1, focus: "Interview baseline", deliverables: ["Mock interview", "Resume gap review"] },
        { week: 4, focus: "Production project depth", deliverables: ["Tests", "CI", "Database-backed features"] },
        { week: 8, focus: "System design readiness", deliverables: ["Architecture diagram", "Tradeoff notes"] },
        { week: 12, focus: "Launch applications", deliverables: ["Final resume", "Portfolio demo"] }
      ]
    }
  });

  await prisma.codingRoom.create({
    data: {
      ownerId: user.id,
      title: "Two Sum practice",
      language: "javascript",
      code: "function twoSum(nums, target) {\n  const seen = new Map();\n  return [];\n}\n"
    }
  });

  await prisma.subscription.create({
    data: {
      userId: user.id,
      plan: "pro",
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
    }
  });

  console.log("Seeded demo users:");
  console.log("  demo@develevate.ai / Password123!");
  console.log("  admin@develevate.ai / Password123!");
  console.log(`Admin user id: ${admin.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
