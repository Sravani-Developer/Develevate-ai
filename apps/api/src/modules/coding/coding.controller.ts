import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { CodingService } from "./coding.service";

@UseGuards(JwtAuthGuard)
@Controller("coding")
export class CodingController {
  constructor(private readonly coding: CodingService) {}

  @Post("rooms")
  createRoom(@CurrentUser() user: AuthUser, @Body() body: { title?: string; language?: string }) {
    return this.coding.createRoom(user.id, body.title ?? "Live coding interview", body.language);
  }

  @Post("execute")
  execute(@Body() body: unknown) {
    return this.coding.execute(body);
  }
}
