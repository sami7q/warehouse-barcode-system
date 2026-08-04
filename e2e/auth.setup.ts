import { expect, test as setup } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./credentials";

const STATE_PATH = "e2e/.auth/state.json";

setup("login and persist session", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("admin@example.com").fill(ADMIN_EMAIL);
  await page.getByPlaceholder("••••••••").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page.getByText("البحث عن منتج")).toBeVisible({ timeout: 15000 });
  await page.context().storageState({ path: STATE_PATH });
});
