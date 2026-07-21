import { expect, test } from "@playwright/test";

test("demo mode supports the main product flows", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "DevElevate AI" })).toBeVisible();
  await page.getByRole("button", { name: /start demo mode/i }).click();
  await expect(page.getByText(/demo mode is active/i)).toBeVisible();

  await page.getByRole("button", { name: "Medium" }).click();
  await expect(page.getByRole("button", { name: "Medium" })).toHaveClass(/bg-card/);
  await expect(page.getByText(/demo interview generated locally|backend unavailable, showing demo questions/i)).toBeVisible();
  await page
    .getByPlaceholder("Answer with structure, constraints, tradeoffs, and measurable impact.")
    .fill("I would clarify constraints, choose a scalable design, explain tradeoffs, and include edge-case testing.");
  await page.getByRole("button", { name: /evaluate answer/i }).click();
  await expect(page.getByText(/demo evaluation generated locally/i)).toBeVisible();

  await page.getByRole("button", { name: /create room/i }).click();
  await expect(page.getByText(/Room: demo-room/)).toBeVisible();
  await expect(page.getByText("Two Sum")).toBeVisible();
  await page.getByPlaceholder("stdin for your run").fill("9\n2 7 11 15");
  await page.getByRole("button", { name: /review code/i }).click();
  await expect(page.getByText(/hash map|complement/i).first()).toBeVisible();
  await page.getByRole("button", { name: /^Run$/ }).click();
  await expect(page.getByText(/demo run completed for javascript/i)).toBeVisible();
  await page.getByPlaceholder("Send a room message").fill("Can we optimize this to O(n)?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/Candidate: Can we optimize this to O\(n\)\?/)).toBeVisible();

  await page.getByRole("button", { name: /analyze resume/i }).click();
  await expect(page.getByText(/no file selected, so showing demo resume analysis/i)).toBeVisible();

  await page.getByLabel("Target role").fill("Full Stack AI Engineer");
  await page.getByLabel("Current skills").fill("React, TypeScript, Node.js, NestJS, PostgreSQL");
  await page.getByRole("button", { name: /^Generate$/ }).click();
  await expect(page.getByText(/demo roadmap generated locally|backend unavailable, showing demo roadmap/i)).toBeVisible();

  await page.getByRole("button", { name: /refresh analytics/i }).click();
  await expect(page.getByText(/showing demo analytics|backend unavailable, showing demo analytics/i)).toBeVisible();

  await page.getByRole("button", { name: /load overview/i }).click();
  await expect(page.getByText(/users.*interviews.*resumes.*rooms/i)).toBeVisible();
  await page.getByRole("button", { name: /activate pro/i }).click();
  await expect(page.getByText("pro plan is ACTIVE.")).toBeVisible();
});
