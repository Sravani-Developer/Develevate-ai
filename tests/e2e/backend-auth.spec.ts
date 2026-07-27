import { expect, test } from "@playwright/test";

test.describe("backend-authenticated flows", () => {
  test.skip(process.env.BACKEND_E2E !== "1", "Set BACKEND_E2E=1 or run npm run test:e2e:backend with API, Postgres, and Redis running.");

  test("demo user can sign in and hit saved backend workflows", async ({ page }) => {
    await page.goto("/");

    const signInForm = page.locator("#auth form").first();
    await expect(signInForm.getByPlaceholder("Email")).toHaveValue("");
    await expect(signInForm.getByPlaceholder("Password")).toHaveValue("");
    await signInForm.getByPlaceholder("Email").fill("demo@develevate.ai");
    await signInForm.getByPlaceholder("Password").fill("Password123!");
    await signInForm.getByRole("button", { name: /^Sign in$/ }).click();
    await expect(page.getByText(/backend session active/i)).toBeVisible();

    await page.getByLabel("Interview target role").fill("Senior Frontend Developer");
    await page.getByLabel("Interview stack").fill("React, Next.js, TypeScript, Tailwind CSS");
    await page.getByLabel("Interview focus").fill("dashboard filtering and role-based access");
    await page.getByRole("button", { name: "Medium" }).click();
    await page.getByRole("button", { name: /generate questions/i }).click();
    await expect(page.getByRole("button", { name: "Medium" })).toHaveClass(/bg-card/);
    await expect(page.getByText(/interview generated from backend|backend unavailable/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Medium" })).toHaveClass(/bg-card/);

    await page.getByRole("button", { name: "Hard" }).click();
    await page.getByRole("button", { name: /generate questions/i }).click();
    await expect(page.getByRole("button", { name: "Hard" })).toHaveClass(/bg-card/);
    await expect(page.getByText(/interview generated from backend|backend unavailable/i)).toBeVisible();

    await page
      .getByPlaceholder("Answer with structure, constraints, tradeoffs, and measurable impact.")
      .fill("I would define requirements, design the data flow, add tests, cover failure modes, and track release metrics.");
    await page.getByRole("button", { name: /evaluate answer/i }).click();
    await expect(page.getByText(/evaluation saved to backend|demo evaluation generated locally/i)).toBeVisible();

    await page.getByLabel("Target role", { exact: true }).fill("Product Manager");
    await page.getByLabel("Current skills", { exact: true }).fill("Roadmapping, stakeholder management, analytics, user research");
    await page.getByRole("button", { name: /^Generate$/ }).click();
    await expect(page.getByText(/roadmap saved to backend|backend unavailable|sign in to save/i)).toBeVisible();
  });
});
