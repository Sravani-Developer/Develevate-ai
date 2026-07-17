import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "./prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  @Get()
  health() {
    return { ok: true, timestamp: new Date().toISOString() };
  }

  @Get("ready")
  async readiness() {
    const database = await this.checkDatabase();
    const integrations = {
      openai: Boolean(this.config.get<string>("OPENAI_API_KEY")),
      judge0: Boolean(this.config.get<string>("JUDGE0_API_KEY")),
      googleOAuth: Boolean(this.config.get<string>("GOOGLE_CLIENT_ID") && this.config.get<string>("GOOGLE_CLIENT_SECRET")),
      objectStorage: Boolean(this.config.get<string>("AWS_S3_BUCKET"))
    };

    return {
      ok: database,
      timestamp: new Date().toISOString(),
      checks: {
        database,
        integrations
      }
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
