import { Body, Controller, Get, Param, Post, Query, Sse, UseGuards } from "@nestjs/common";
import { map, from } from "rxjs";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { InterviewsService } from "./interviews.service";

@UseGuards(JwtAuthGuard)
@Controller("interviews")
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.interviews.create(user.id, body);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("page") page?: string) {
    return this.interviews.list(user.id, page ? Number(page) : 1);
  }

  @Post(":id/answers")
  evaluate(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: unknown) {
    return this.interviews.evaluate(user.id, id, body);
  }

  @Sse(":id/stream")
  stream(@Param("id") id: string) {
    return from(this.interviews.streamPrompt(id)).pipe(map((data) => ({ data })));
  }
}
