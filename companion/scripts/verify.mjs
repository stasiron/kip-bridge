#!/usr/bin/env node
/**
 * Single gate for automated verification. Fail-fast on any step.
 */
import { spawn } from "node:child_process";
import process from "node:process";

const steps = [
  { name: "typecheck", cmd: "npm", args: ["run", "typecheck"] },
  { name: "lint (next)", cmd: "npm", args: ["run", "lint"] },
  { name: "unit+protocol tests", cmd: "npm", args: ["test"] },
  { name: "production frontend build", cmd: "npm", args: ["run", "build"] },
  { name: "playwright e2e (chromium+webkit)", cmd: "npx", args: ["playwright", "test"] },
  { name: "bridge cold start smoke", cmd: "node", args: ["--experimental-strip-types", "scripts/bridge-smoke.mjs"] },
];

function run(step) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== VERIFY: ${step.name} ===`);
    const child = spawn(step.cmd, step.args, {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, CI: process.env.CI ?? "1" },
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${step.name} failed with exit ${code}`));
    });
  });
}

let failed = null;
for (const step of steps) {
  try {
    await run(step);
  } catch (error) {
    failed = error;
    break;
  }
}

if (failed) {
  console.error(`\nVERIFY FAILED: ${failed.message}`);
  process.exit(1);
}
console.log("\nVERIFY PASSED: typecheck, unit/protocol, build, e2e, bridge smoke");
process.exit(0);
