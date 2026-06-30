import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { RoadmapsService } from "./roadmaps.service";

@UseGuards(JwtAuthGuard)
@Controller("roadmaps")
export class RoadmapsController {
  constructor(private readonly roadmaps: RoadmapsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.roadmaps.create(user.id, body);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.roadmaps.list(user.id);
  }
}
