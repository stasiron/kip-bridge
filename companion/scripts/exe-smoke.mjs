/**
 * Smoke the packaged Windows launcher. A passing `npm start` does not count.
 * The launcher is started with a PATH that cannot find a system Node.
 */
import { spawn } from "node:child_process";
import dgram from "node:dgram";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isLocalNetworkAddress } from "../bridge/src/playlink/access.ts";
import { ConsoleSimulator } from "../bridge/src/playlink/simulator.ts";
import { qrSvg } from "../bridge/src/qr.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const folder = path.join(root, "release", "KIP-Bridge");
const exe = path.join(folder, "KIP-Bridge.exe");
const bundledNode = path.join(folder, "node.exe");
const port = 8787;
const uid = "ab".repeat(16);

function fail(message) {
  throw new Error(message);
}

if (!fs.existsSync(exe)) fail(`Missing ${exe}. Run npm run package:win first.`);
if (!fs.existsSync(bundledNode)) fail(`Missing ${bundledNode}. The folder must carry its own Node runtime.`);

function launch() {
  const child = spawn(exe, [], {
    cwd: folder,
    env: { ...process.env, PATH: "C:\\Windows\\System32" },
  });
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for the join code\n${output}`)), 25_000);
    const onData = (chunk) => {
      output += chunk;
      const match = output.match(/Join code: ([A-Z2-9]{8})/);
      if (match && output.includes("Close this window to stop the bridge.")) {
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

function childNodePath(parentPid) {
  return new Promise((resolve, reject) => {
    const ps = spawn(
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      ["-NoProfile", "-Command", `(Get-CimInstance Win32_Process -Filter "ParentProcessId = ${parentPid}").ExecutablePath`],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    ps.stdout.setEncoding("utf8");
    ps.stderr.setEncoding("utf8");
    ps.stdout.on("data", (chunk) => {
      out += chunk;
    });
    ps.stderr.on("data", (chunk) => {
      out += chunk;
    });
    ps.on("exit", (code) => {
      if (code !== 0) reject(new Error(`could not read the child process\n${out}`));
      else resolve(out.trim());
    });
  });
}

function openSocket() {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
  const frames = [];
  ws.addEventListener("message", (event) => {
    frames.push(JSON.parse(String(event.data)));
  });
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve({ ws, frames }), { once: true });
    ws.addEventListener("error", () => reject(new Error("websocket failed")), { once: true });
  });
}

async function waitFor(check, label, timeoutMs = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function checkOnce(label) {
  const sim = await ConsoleSimulator.listen("0.0.0.0");
  const { child, ready } = launch();
  try {
    const { code, output } = await ready;
    const runtime = await childNodePath(child.pid);
    if (path.resolve(runtime).toLowerCase() !== path.resolve(bundledNode).toLowerCase()) {
      fail(`${label}: bridge runtime is ${runtime || "(none)"}, expected ${bundledNode}`);
    }

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

    const urls = [...output.matchAll(/http:\/\/(\d+\.\d+\.\d+\.\d+):8787\//g)]
      .map((match) => match[0])
      .filter((url) => !url.startsWith("http://127.0.0.1:"));
    if (urls.length === 0) fail(`${label}: no LAN URL in the banner\n${output}`);
    const host = await fetch(`http://127.0.0.1:${port}/host`);
    const hostHtml = await host.text();
    if (host.status !== 200 || !hostHtml.includes(code)) fail(`${label}: loopback host page missing the join code`);
    for (const url of urls) {
      const svg = qrSvg(url);
      if (!hostHtml.includes(svg)) fail(`${label}: host QR does not encode ${url}`);
      if (svg.includes(code)) fail(`${label}: QR svg contains the join code`);
    }

    const consoleHost = urls
      .map((url) => url.slice("http://".length).split(":")[0])
      .find((address) => isLocalNetworkAddress(address));
    if (!consoleHost) fail(`${label}: no private IPv4 in the banner\n${output}`);
    const hidden = await fetch(`http://${consoleHost}:${port}/host`);
    const hiddenText = await hidden.text();
    if (hidden.status !== 404) fail(`${label}: /host on ${consoleHost} returned ${hidden.status}`);
    if (hiddenText.includes(code)) fail(`${label}: join code leaked through the LAN host page`);

    await udp9060IsFree();

    const rejected = await openSocket();
    rejected.ws.send(JSON.stringify({
      type: "bridge.join",
      code: "WRONG",
      uid,
      consoleHost,
      consolePort: sim.port,
    }));
    await waitFor(() => rejected.frames.some((frame) => frame.code === "bad_join_code"), "bad join code");
    rejected.ws.close();
    await udp9060IsFree();

    const joined = await openSocket();
    joined.ws.send(JSON.stringify({
      type: "bridge.join",
      code,
      uid,
      consoleHost,
      consolePort: sim.port,
    }));
    await waitFor(
      () => joined.frames.some((frame) => frame.type === "bridge.state" && frame.connection === "assigned"),
      "player assignment",
    );
    const assigned = joined.frames.find((frame) => frame.type === "bridge.state" && frame.connection === "assigned");
    const localAddress = assigned.localAddress;
    await waitFor(
      () => sim.client(localAddress)?.messages.some((message) => message.TypeString === "DeviceInfoMessage") === true,
      "DeviceInfoMessage on the simulator",
    );

    sim.sendMessage(localAddress, {
      TypeString: "KnowledgeIsPower.ServerBeginTriviaAnsweringPhase",
      QuestionID: "q",
      QuestionText: "Which?",
      QuestionDuration: 30,
      Answers: [{ DisplayIndex: 0, DisplayText: "A", IsCorrect: true }],
      PowerPlays: [],
      PowerPlayPlayers: [],
      RoundType: 0,
    });
    await waitFor(
      () => joined.frames.some((frame) => frame.message?.TypeString === "KnowledgeIsPower.ServerBeginTriviaAnsweringPhase"),
      "trivia question on the websocket",
    );
    joined.ws.send(JSON.stringify({
      type: "bridge.command",
      message: { TypeString: "KnowledgeIsPower.ClientTriviaAnswer", ChosenAnswerDisplayIndex: 1, AnswerTime: 1.25 },
    }));
    await waitFor(
      () => sim.client(localAddress)?.messages.some((message) => message.ChosenAnswerDisplayIndex === 1) === true,
      "trivia answer on the simulator",
    );

    const liveResponse = await fetch(`http://127.0.0.1:${port}/api/status`);
    const liveText = await liveResponse.text();
    const live = JSON.parse(liveText);
    if (liveText.includes(code) || live.playlink.bound !== true) {
      fail(`${label}: status after join was ${liveText}`);
    }
    joined.ws.close();
    console.log(`${label}: runtime ${runtime}, join code ${code}, QR ${urls.length}, simulator player ${assigned.playerId}`);
    return code;
  } finally {
    await stop(child);
    await sim.close();
    const started = Date.now();
    let free = false;
    while (Date.now() - started < 4000) {
      try {
        await udp9060IsFree();
        free = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    if (!free) fail(`${label}: UDP 9060 stayed bound after the launcher stopped`);
  }
}

try {
  const first = await checkOnce("start");
  const second = await checkOnce("restart");
  if (first === second) console.log("restart printed the same join code; that is allowed");
  console.log("packaged executable smoke passed");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
