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
      { jobDescription: "TypeScript React NextJS NestJS PostgreSQL Docker CI/CD Playwright role" }
    );

    const created = prisma.resumeAnalysis.create.mock.calls[0][0].data;
    expect(created.extractedText).toContain("Full Stack Developer");
    expect(created.skills).toEqual(expect.arrayContaining(["TypeScript", "React", "NestJS", "PostgreSQL", "Docker", "Playwright"]));
    expect(created.matchedKeywords).toEqual(expect.arrayContaining(["TypeScript", "React", "Next.js", "NestJS", "PostgreSQL"]));
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

  it("falls back gracefully when local PDF extraction is unavailable", async () => {
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
        originalname: "resume.pdf",
        mimetype: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\nnot enough local pdf runtime support")
      } as Express.Multer.File,
      { jobDescription: "React NestJS PostgreSQL Docker CI/CD role" }
    );

    const created = prisma.resumeAnalysis.create.mock.calls[0][0].data;
    expect(created.extractedText).toContain("PDF resume uploaded: resume.pdf");
    expect(created.atsScore).toBeGreaterThanOrEqual(45);
    expect(created.atsScore).toBeLessThan(70);
    expect(created.missingKeywords).toEqual(expect.arrayContaining(["React", "NestJS", "PostgreSQL"]));
  });

  it("analyzes non-developer job descriptions from extracted role terms", async () => {
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
            "Operations Coordinator",
            "Managed vendor onboarding, inventory reporting, purchase orders, and cross-functional communication.",
            "Improved weekly reporting accuracy by 18% and reduced order delays by 2 days."
          ].join("\n")
        )
      } as Express.Multer.File,
      {
        jobDescription:
          "Operations Coordinator role requiring vendor management, inventory tracking, purchase orders, reporting, cross-functional communication, process improvement, and stakeholder coordination."
      }
    );

    const created = prisma.resumeAnalysis.create.mock.calls[0][0].data;
    expect(created.matchedKeywords).toEqual(expect.arrayContaining(["purchase orders", "reporting", "cross-functional communication"]));
    expect(created.missingKeywords).toEqual(expect.arrayContaining(["vendor management", "stakeholder coordination"]));
    expect(created.atsScore).toBeGreaterThanOrEqual(65);
  });
});
