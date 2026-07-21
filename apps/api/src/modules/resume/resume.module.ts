import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { ResumeController } from "./resume.controller";
import { ResumeService } from "./resume.service";

@Module({
  imports: [AiModule],
  controllers: [ResumeController],
  providers: [ResumeService]
})
export class ResumeModule {}
