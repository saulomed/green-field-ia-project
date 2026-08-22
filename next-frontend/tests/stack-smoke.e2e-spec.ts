import { test, expect } from "@playwright/test"

/**
 * Infra smoke check for the Playwright stack itself (SI-02.8) — proves the
 * production build boots under `webServer` and the app is reachable, before
 * any real screen exists to test. Screen SIs replace/extend this coverage.
 */
test("the production build boots and serves the app", async ({ page }) => {
  const response = await page.goto("/")
  expect(response?.ok()).toBe(true)
})
