import { expect, test } from "@playwright/test";

test.describe("backend-authenticated flows", () => {
  test.skip(process.env.BACKEND_E2E !== "1", "Set BACKEND_E2E=1 or run npm run test:e2e:backend with API, Postgres, and Redis running.");

  test("demo user can sign in and hit saved backend workflows", async ({ page }) => {
    await page.goto("/");

    const signInForm = page.locator("#auth form").first();
    await expect(signInForm.getByPlaceholder("Email")).toHaveValue("demo@develevate.ai");
    await expect(signInForm.getByPlaceholder("Password")).toHaveValue("Password123!");
    await signInForm.getByRole("button", { name: /^Sign in$/ }).click();
    await expect(page.getByText(/backend session active/i)).toBeVisible();

    await page.getByRole("button", { name: "Hard" }).click();
    await expect(page.getByText(/interview generated from backend|backend unavailable/i)).toBeVisible();

    await page
      .getByPlaceholder("Answer with structure, constraints, tradeoffs, and measurable impact.")
      .fill("I would define requirements, design the data flow, add tests, cover failure modes, and track release metrics.");
    await page.getByRole("button", { name: /evaluate answer/i }).click();
    await expect(page.getByText(/evaluation saved to backend|demo evaluation generated locally/i)).toBeVisible();

    await page.getByLabel("Target role").fill("Full Stack AI Engineer");
    await page.getByLabel("Current skills").fill("React, TypeScript, NestJS, PostgreSQL");
    await page.getByRole("button", { name: /^Generate$/ }).click();
    await expect(page.getByText(/roadmap saved to backend|backend unavailable, showing demo roadmap/i)).toBeVisible();
  });
});
