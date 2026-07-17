import { ResumeService } from "../src/modules/resume/resume.service";

describe("ResumeService", () => {
  it("extracts text resumes and creates local keyword analysis without paid AI", async () => {
    const prisma = {
      resumeAnalysis: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "resume-1", ...data }))
      }
    };
    const ai = {
      generateJson: jest.fn().mockImplementation((_system, _user, fallback) => Promise.resolve(fallback))
    };
    const service = new ResumeService(prisma as never, ai as never);

    await service.analyze(
      "user-1",
      {
        originalname: "resume.txt",
        mimetype: "text/plain",
        buffer: Buffer.from(
          [
            "Full Stack Developer",
            "Skills: TypeScript, React, Next.js, Node.js, NestJS, PostgreSQL, Prisma, Docker, GitHub Actions, Playwright",
            "Project: DevElevate AI platform with API, dashboard, tests, and CI/CD.",
            "Improved project readiness with 12 automated tests."
          ].join("\n")
        )
      } as Express.Multer.File,
      { jobDescription: "TypeScript React NestJS PostgreSQL Docker CI/CD Playwright role" }
    );

    const created = prisma.resumeAnalysis.create.mock.calls[0][0].data;
    expect(created.extractedText).toContain("Full Stack Developer");
    expect(created.skills).toEqual(expect.arrayContaining(["TypeScript", "React", "NestJS", "PostgreSQL", "Docker", "Playwright"]));
    expect(created.matchedKeywords).toEqual(expect.arrayContaining(["TypeScript", "React", "NestJS", "PostgreSQL"]));
    expect(created.atsScore).toBeGreaterThanOrEqual(80);
  });

  it("rejects unsupported resume file types", async () => {
    const service = new ResumeService({} as never, {} as never);

    await expect(
      service.analyze(
        "user-1",
        {
          originalname: "resume.exe",
          mimetype: "application/x-msdownload",
          buffer: Buffer.from("not a resume")
        } as Express.Multer.File,
        {}
      )
    ).rejects.toThrow("Resume upload supports .txt, .md, .pdf, and .docx files.");
  });
});
