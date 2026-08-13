import { expect, test } from "@playwright/test";

test("local mode supports the main product flows", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "DevElevate AI" })).toBeVisible();
  await page.getByRole("button", { name: /start local mode/i }).click();
  await expect(page.getByText(/Local intelligence mode is active\. You can test the app without paid API keys\./)).toBeVisible();

  await page.getByLabel("Interview target role").fill("Senior Frontend Developer");
  await page.getByLabel("Interview stack").fill("React, Next.js, TypeScript, Tailwind CSS");
  await page.getByLabel("Interview focus").fill("dashboard filtering and role-based access");
  await page.getByRole("button", { name: "Medium" }).click();
  await page.getByRole("button", { name: /generate questions/i }).click();
  await expect(page.getByRole("button", { name: "Medium" })).toHaveClass(/bg-card/);
  await expect(page.getByText(/local interview generated from your role/i)).toBeVisible();
  await expect(page.getByText(/Senior Frontend Developer/).first()).toBeVisible();
  await page
    .getByPlaceholder("Answer with structure, constraints, tradeoffs, and measurable impact.")
    .fill("I would clarify constraints, choose a scalable design, explain tradeoffs, and include edge-case testing.");
  await page.getByRole("button", { name: /evaluate answer/i }).click();
  await expect(page.getByText(/local rubric evaluation completed/i)).toBeVisible();

  await page.getByLabel("Coding target role").fill("QA Automation Engineer");
  await page.getByLabel("Coding topic").fill("release risk");
  await page.getByLabel("Difficulty").selectOption("MEDIUM");
  await page.getByLabel("Language").selectOption("javascript");
  await page.getByRole("button", { name: /generate challenge/i }).click();
  await page.getByRole("button", { name: /create room/i }).click();
  await expect(page.getByText(/Room: local-room/)).toBeVisible();
  await expect(page.getByText(/For a QA Automation Engineer/)).toBeVisible();
  await page.getByRole("button", { name: /review code/i }).click();
  await expect(page.getByText(/stdin parsing|input handling/i).first()).toBeVisible();
  await page.getByRole("button", { name: /^Run$/ }).click();
  await expect(page.getByText(/Execution finished, but no output was returned/i)).toBeVisible();
  await page.getByPlaceholder("Send a room message").fill("Can we optimize this to O(n)?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/Candidate: Can we optimize this to O\(n\)\?/)).toBeVisible();

  await page.getByRole("button", { name: /analyze resume/i }).click();
  await expect(page.getByText(/choose a resume file before analyzing/i)).toBeVisible();

  await page.getByLabel("Target role", { exact: true }).fill("Full Stack AI Engineer");
  await page.getByLabel("Current skills", { exact: true }).fill("React, TypeScript, Node.js, NestJS, PostgreSQL");
  await page.getByRole("button", { name: /^Generate$/ }).click();
  await expect(page.getByText(/local roadmap generated from your target role/i)).toBeVisible();

  await page.getByRole("button", { name: /refresh analytics/i }).click();
  await expect(page.getByText(/sign in to load saved analytics/i)).toBeVisible();

  await page.getByRole("button", { name: /load overview/i }).click();
  await expect(page.getByText(/sign in as an admin user to load platform overview/i)).toBeVisible();
  await page.getByRole("button", { name: /activate pro/i }).click();
  await expect(page.getByText(/sign in to activate a subscription/i)).toBeVisible();
});
