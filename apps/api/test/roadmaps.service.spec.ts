import { RoadmapsService } from "../src/modules/roadmaps/roadmaps.service";

describe("RoadmapsService", () => {
  it("creates detailed local fallback milestones when AI returns the fallback", async () => {
    const prisma = {
      roadmap: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "roadmap-1", ...data }))
      }
    };
    const ai = {
      generateJson: jest.fn().mockImplementation((_system, _user, fallback) => Promise.resolve(fallback))
    };
    const service = new RoadmapsService(prisma as never, ai as never);

    await service.create("user-1", {
      targetRole: "Full Stack AI Engineer",
      currentSkills: ["React", "TypeScript", "NestJS", "PostgreSQL"],
      timelineWeeks: 12
    });

    const created = prisma.roadmap.create.mock.calls[0][0].data;
    expect(created.milestones).toHaveLength(5);
    expect(created.milestones[0].focus).toContain("Full Stack AI Engineer");
    expect(created.milestones[1].deliverables).toEqual(expect.arrayContaining(["Backend API", "Automated tests"]));
    expect(created.milestones[4].metrics).toEqual(expect.arrayContaining(["Apply to 20 targeted roles"]));
  });
});
