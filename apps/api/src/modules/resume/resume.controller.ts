import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { ResumeService } from "./resume.service";

@UseGuards(JwtAuthGuard)
@Controller("resume")
export class ResumeController {
  constructor(private readonly resume: ResumeService) {}

  @Post("analyze")
  @UseInterceptors(FileInterceptor("resume", { limits: { fileSize: 5 * 1024 * 1024 } }))
  analyze(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File, @Body() body: unknown) {
    return this.resume.analyze(user.id, file, body);
  }
}
