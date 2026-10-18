import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.KIP_BASE_URL ?? "http://127.0.0.1:8790";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts$/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "node --experimental-strip-types e2e/harness.mjs",
    url: "http://127.0.0.1:8790/api/status",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      ...process.env,
      KIP_BRIDGE_PORT: "8790",
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["iPhone 13"] } },
  ],
});
