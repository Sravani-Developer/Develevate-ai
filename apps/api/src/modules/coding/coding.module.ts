import { Module } from "@nestjs/common";
import { CodingController } from "./coding.controller";
import { CodingGateway } from "./coding.gateway";
import { CodingService } from "./coding.service";

@Module({
  controllers: [CodingController],
  providers: [CodingGateway, CodingService]
})
export class CodingModule {}
