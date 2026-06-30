import { Body, Controller, HttpCode, Post, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { authSchemas } from "@develevate/shared";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/auth"
};

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  async register(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.register(authSchemas.register.parse(body));
    response.cookie("refreshToken", result.refreshToken, cookieOptions);
    return { accessToken: result.accessToken };
  }

  @HttpCode(200)
  @Post("login")
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(authSchemas.login.parse(body));
    response.cookie("refreshToken", result.refreshToken, cookieOptions);
    return { accessToken: result.accessToken };
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) response: Response) {
    response.clearCookie("refreshToken", cookieOptions);
    return this.auth.logout(user.id);
  }

  @Post("forgot-password")
  forgotPassword(@Body() body: unknown) {
    const input = authSchemas.forgotPassword.parse(body);
    return this.auth.forgotPassword(input.email);
  }

  @Post("reset-password")
  resetPassword(@Body() body: unknown) {
    const input = authSchemas.resetPassword.parse(body);
    return this.auth.resetPassword(input.token, input.password);
  }
}
