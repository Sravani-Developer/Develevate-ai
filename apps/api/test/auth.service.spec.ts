import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../src/modules/auth/auth.service";

describe("AuthService", () => {
  it("rejects duplicate registrations", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "u1" })
      }
    };
    const service = new AuthService(prisma as never, new JwtService(), new ConfigService());
    await expect(
      service.register({ name: "Sravani", email: "test@example.com", password: "Password123!" })
    ).rejects.toThrow("Email is already registered");
  });
});
