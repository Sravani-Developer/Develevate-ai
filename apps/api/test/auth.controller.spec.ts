import type { Request, Response } from "express";
import { AuthController } from "../src/modules/auth/auth.controller";

describe("AuthController", () => {
  it("rotates refresh cookies through the refresh endpoint", async () => {
    const auth = {
      refresh: jest.fn().mockResolvedValue({ accessToken: "new-access", refreshToken: "new-refresh" })
    };
    const controller = new AuthController(auth as never);
    const response = { cookie: jest.fn() } as unknown as Response;
    const request = { cookies: { refreshToken: "old-refresh" } } as unknown as Request;

    await expect(controller.refresh(request, response)).resolves.toEqual({ accessToken: "new-access" });
    expect(auth.refresh).toHaveBeenCalledWith("old-refresh");
    expect(response.cookie).toHaveBeenCalledWith("refreshToken", "new-refresh", expect.objectContaining({ httpOnly: true }));
  });
});
