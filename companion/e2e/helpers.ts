import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export function runtime() {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "e2e", ".runtime.json"), "utf8")) as {
    joinCode: string;
    bridgePort: number;
    simPort: number;
    controlPort: number;
    endpoints: string[];
    baseURL: string;
  };
}

export async function waitForFreeEndpoint(minFree = 1) {
  const cfg = runtime();
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    const status = await (await fetch(`${cfg.baseURL}/api/status`)).json();
    if ((status.sessions?.free ?? 0) >= minFree) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`timed out waiting for ${minFree} free endpoint(s)`);
}

export async function sendConsole(message: Record<string, unknown>, address?: string) {
  const { controlPort, endpoints } = runtime();
  const response = await fetch(`http://127.0.0.1:${controlPort}/control/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: address ?? endpoints[0], message }),
  });
  assert.equal(response.status, 200);
}

export async function clientMessages(address?: string) {
  const { controlPort, endpoints } = runtime();
  const host = address ?? endpoints[0];
  const response = await fetch(`http://127.0.0.1:${controlPort}/control/client?address=${encodeURIComponent(host)}`);
  const body = (await response.json()) as { messages?: Record<string, unknown>[]; playerId?: number } | null;
  return body;
}

export async function disconnectIfPossible(page: Page) {
  const button = page.getByTestId("disconnect-button");
  if (await button.count()) {
    await button.click();
    await expect(page.getByTestId("join-code")).toBeVisible({ timeout: 5_000 });
  }
}

/** Fresh 32-hex UID — simulator keeps profiles by UID across Chromium/WebKit in one harness. */
export function freshUid(tag = "t"): string {
  const hex = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const prefix = tag.replace(/[^0-9a-f]/gi, "").toLowerCase().slice(0, 8).padEnd(8, "0");
  return (prefix + hex).slice(0, 32);
}

export async function joinSessionOnly(page: Page, opts?: { uid?: string }) {
  const cfg = runtime();
  const uid = opts?.uid ?? freshUid();
  await page.addInitScript((id) => {
    localStorage.setItem("kip.deviceUid", id);
  }, uid);
  await page.goto("/");
  await expect(page.getByTestId("join-code")).toBeVisible();
  await page.getByTestId("join-code").fill(cfg.joinCode);
  await page.getByTestId("console-host").fill("127.0.0.1");
  await page.getByTestId("console-port").fill(String(cfg.simPort));
  await page.getByTestId("join-button").click();
  return uid;
}

export async function joinPage(page: Page, opts?: { uid?: string; name?: string; avatar?: string }) {
  const uid = await joinSessionOnly(page, { uid: opts?.uid ?? freshUid() });
  // Assigned sessions always show the chrome Disconnect control.
  await expect(page.getByTestId("disconnect-button")).toBeVisible({ timeout: 12_000 });
  const setup = page.getByTestId("player-name");
  if (await setup.isVisible()) {
    await setup.fill(opts?.name ?? "Ada");
    const avatar = opts?.avatar ?? "COWGIRL";
    await expect(page.getByTestId(`avatar-${avatar}`)).toBeVisible({ timeout: 10_000 });
    await page.getByTestId(`avatar-${avatar}`).click();
    await page.getByTestId("join-game-button").click();
    await expect(page.getByTestId("start-button")).toBeVisible({ timeout: 10_000 });
  } else {
    throw new Error(
      `Expected fresh setup for uid ${uid}, but setup form missing (likely simulator rejoin profile). Use freshUid().`,
    );
  }
  return uid;
}

export async function newContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext();
}
