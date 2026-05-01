import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 90_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001"
  },
  webServer: {
    command: "npm run dev:simple",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
      USE_MOCK_DB: "true"
    }
  }
});
