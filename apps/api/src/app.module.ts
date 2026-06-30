import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/env";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { AiModule } from "./modules/ai/ai.module";
import { AuthModule } from "./modules/auth/auth.module";
import { InterviewsModule } from "./modules/interviews/interviews.module";
import { CodingModule } from "./modules/coding/coding.module";
import { ResumeModule } from "./modules/resume/resume.module";
import { RoadmapsModule } from "./modules/roadmaps/roadmaps.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AdminModule } from "./modules/admin/admin.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { HealthController } from "./modules/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AiModule,
    AuthModule,
    InterviewsModule,
    CodingModule,
    ResumeModule,
    RoadmapsModule,
    AnalyticsModule,
    AdminModule,
    SubscriptionsModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
