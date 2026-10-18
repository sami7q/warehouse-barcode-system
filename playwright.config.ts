import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/state.json",
      },
      dependencies: ["auth-setup"],
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: BASE_URL,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      TURSO_DATABASE_URL: "file:e2e.db",
      TURSO_AUTH_TOKEN: "",
      AUTH_SECRET: "e2e-secret-not-for-production-0123456789abcdef",
      BARCODE_PREFIX: "628110",
      // Throwaway test-only Web Push keys (production has its own).
      VAPID_PUBLIC_KEY: "BNDEwPiR2o1VEkX9h1ktLlmJz4xOb18bnDzCDiBPKVAJgQ5XmWFTYQp6mYWFtR5DarWDqaC6zJjR4Lq9uXyao8U",
      VAPID_PRIVATE_KEY: "4DSfkIl0JSrM5HYSaT_rcGC9zjes-9Jww4e0jTdX2ao",
    },
  },
});
