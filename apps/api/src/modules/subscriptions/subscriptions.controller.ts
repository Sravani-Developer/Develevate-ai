import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";

@UseGuards(JwtAuthGuard)
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.prisma.subscription.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" }
    });
  }

  @Post("checkout")
  checkout(@CurrentUser() user: AuthUser, @Body() body: { plan?: string }) {
    return this.prisma.subscription.create({
      data: {
        userId: user.id,
        plan: body.plan ?? "pro",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
      }
    });
  }
}
