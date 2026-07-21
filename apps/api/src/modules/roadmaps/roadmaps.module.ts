import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { RoadmapsController } from "./roadmaps.controller";
import { RoadmapsService } from "./roadmaps.service";

@Module({
  imports: [AiModule],
  controllers: [RoadmapsController],
  providers: [RoadmapsService]
})
export class RoadmapsModule {}
