import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@Controller("admin")
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("overview")
  async overview() {
    const [users, interviews, resumes, rooms, subscriptions] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.interview.count(),
      this.prisma.resumeAnalysis.count(),
      this.prisma.codingRoom.count(),
      this.prisma.subscription.groupBy({ by: ["status"], _count: true })
    ]);
    return { users, interviews, resumes, rooms, subscriptions };
  }
}
