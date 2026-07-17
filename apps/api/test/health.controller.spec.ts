import { ConfigService } from "@nestjs/config";
import { HealthController } from "../src/modules/health.controller";

describe("HealthController", () => {
  it("returns lightweight liveness status", () => {
    const controller = new HealthController({} as never, new ConfigService());

    expect(controller.health()).toEqual(expect.objectContaining({ ok: true, timestamp: expect.any(String) }));
  });

  it("reports readiness with database and integration checks", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) };
    const config = new ConfigService({
      OPENAI_API_KEY: "openai-key",
      JUDGE0_API_KEY: "judge-key",
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
      AWS_S3_BUCKET: "bucket"
    });
    const controller = new HealthController(prisma as never, config);

    await expect(controller.readiness()).resolves.toEqual({
      ok: true,
      timestamp: expect.any(String),
      checks: {
        database: true,
        integrations: {
          openai: true,
          judge0: true,
          googleOAuth: true,
          objectStorage: true
        }
      }
    });
  });

  it("keeps readiness response useful when the database is unavailable", async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error("database down")) };
    const controller = new HealthController(prisma as never, new ConfigService());

    await expect(controller.readiness()).resolves.toEqual({
      ok: false,
      timestamp: expect.any(String),
      checks: {
        database: false,
        integrations: {
          openai: false,
          judge0: false,
          googleOAuth: false,
          objectStorage: false
        }
      }
    });
  });
});
