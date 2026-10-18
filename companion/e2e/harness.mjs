/**
 * Serves the static controller through the real bridge + ConsoleSimulator.
 * Control API (loopback only):
 *   GET  /control/runtime
 *   GET  /control/client?address=127.0.0.1
 *   POST /control/send { address?, message }
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBridge } from "../bridge/src/server.ts";
import { ConsoleSimulator } from "../bridge/src/playlink/simulator.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimePath = path.join(root, "e2e", ".runtime.json");
const JOIN_CODE = process.env.KIP_JOIN_CODE ?? "PLAYTEST";
const ENDPOINTS = (process.env.KIP_ENDPOINTS ?? "127.0.0.1,127.0.0.2")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const sim = await ConsoleSimulator.listen();
const bridge = createBridge({
  endpoints: ENDPOINTS,
  joinCode: JOIN_CODE,
  probeIntervalMs: 40,
  connectTimeoutMs: 800,
  ackTimeoutMs: 800,
  detachGraceMs: 8_000,
});

const preferredPort = Number(process.env.KIP_BRIDGE_PORT ?? 0);
const bridgePort = await new Promise((resolve, reject) => {
  bridge.server.once("error", reject);
  bridge.server.listen(preferredPort, "127.0.0.1", () => {
    bridge.server.off("error", reject);
    const address = bridge.server.address();
    if (!address || typeof address === "string") reject(new Error("no port"));
    else resolve(address.port);
  });
});

function readBody(req) {
  return new Promise(async (resolve) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    resolve(Buffer.concat(chunks).toString("utf8"));
  });
}

const control = http.createServer(async (req, res) => {
  const remote = req.socket.remoteAddress ?? "";
  if (remote !== "127.0.0.1" && remote !== "::1" && remote !== "::ffff:127.0.0.1") {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === "/control/runtime") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        joinCode: JOIN_CODE,
        bridgePort,
        simPort: sim.port,
        endpoints: ENDPOINTS,
        localAddress: ENDPOINTS[0],
      }),
    );
    return;
  }
  if (req.method === "POST" && url.pathname === "/control/send") {
    const body = JSON.parse(await readBody(req));
    const address = body.address ?? ENDPOINTS[0];
    sim.sendMessage(address, body.message);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method === "GET" && url.pathname === "/control/client") {
    const address = url.searchParams.get("address") ?? ENDPOINTS[0];
    const client = sim.client(address);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(client ?? null));
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

const controlPort = await new Promise((resolve) => {
  control.listen(0, "127.0.0.1", () => resolve(control.address().port));
});

const runtime = {
  joinCode: JOIN_CODE,
  bridgePort,
  simPort: sim.port,
  controlPort,
  endpoints: ENDPOINTS,
  baseURL: `http://127.0.0.1:${bridgePort}`,
};
fs.writeFileSync(runtimePath, JSON.stringify(runtime, null, 2));
console.log(JSON.stringify(runtime));

const shutdown = async () => {
  control.close();
  await bridge.close();
  await sim.close();
  try {
    fs.unlinkSync(runtimePath);
  } catch {
    /* ignore */
  }
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
