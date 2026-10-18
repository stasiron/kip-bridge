/**
 * Smoke the packaged Windows launcher. A passing `npm start` does not count.
 */
import { spawn } from "node:child_process";
import dgram from "node:dgram";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exe = path.join(root, "release", "KIP-Bridge", "KIP-Bridge.exe");
const port = 8787;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(exe)) fail(`Missing ${exe}. Run npm run package:win first.`);

function launch() {
  const child = spawn(exe, [], { cwd: path.dirname(exe) });
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for the join code\n${output}`)), 25_000);
    const onData = (chunk) => {
      output += chunk;
      const match = output.match(/Join code: ([A-Z2-9]{8})/);
      if (match) {
        clearTimeout(timer);
        resolve({ code: match[1], output });
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`launcher exited ${code} before printing a join code\n${output}`));
    });
  });
  return { child, ready };
}

function stop(child) {
  return new Promise((resolve) => {
    if (!child.pid) {
      resolve();
      return;
    }
    const killer = spawn("taskkill", ["/T", "/F", "/PID", String(child.pid)], { stdio: "ignore" });
    killer.on("exit", () => resolve());
    killer.on("error", () => resolve());
  });
}

function udp9060IsFree() {
  return new Promise((resolve, reject) => {
    const probe = dgram.createSocket("udp4");
    probe.once("error", (error) => {
      probe.close();
      reject(error);
    });
    probe.bind(9060, "0.0.0.0", () => {
      probe.close();
      resolve();
    });
  });
}

async function checkOnce(label) {
  const { child, ready } = launch();
  try {
    const { code } = await ready;
    const statusResponse = await fetch(`http://127.0.0.1:${port}/api/status`);
    const statusText = await statusResponse.text();
    if (statusResponse.status !== 200) fail(`${label}: status HTTP ${statusResponse.status}`);
    if (statusText.includes(code)) fail(`${label}: join code leaked into /api/status`);
    const status = JSON.parse(statusText);
    if (status.service !== "kip-browser-bridge" || status.playlink.bound !== false) {
      fail(`${label}: unexpected status ${statusText}`);
    }

    const page = await fetch(`http://127.0.0.1:${port}/`);
    const html = await page.text();
    if (page.status !== 200 || !html.includes("<html")) fail(`${label}: controller page did not load`);

    const host = await fetch(`http://127.0.0.1:${port}/host`);
    const hostHtml = await host.text();
    if (host.status !== 200 || !hostHtml.includes(code) || !hostHtml.includes("<svg")) {
      fail(`${label}: loopback host page missing the join code or QR`);
    }

    await udp9060IsFree();
    console.log(`${label}: join code ${code}, page served, UDP 9060 free`);
    return code;
  } finally {
    await stop(child);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

const first = await checkOnce("start");
const second = await checkOnce("restart");
if (first === second) console.log("restart printed the same join code; that is allowed");
console.log("packaged executable smoke passed");
