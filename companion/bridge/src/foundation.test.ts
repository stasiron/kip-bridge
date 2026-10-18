import assert from "node:assert/strict";
import dgram from "node:dgram";
import path from "node:path";
import test from "node:test";
import { MESSAGE_CATALOG } from "./protocol/catalog.ts";
import { TypeString } from "./protocol/messages.ts";
import { PLAYLINK_CLIENT_PORT } from "./config.ts";
import { bridgeStatus } from "./status.ts";
import { resolveStatic } from "./static-files.ts";
import { createBridgeServer } from "./index.ts";

test("status reports controller UI ready and UDP unbound until join", () => {
  const status = bridgeStatus();
  assert.equal(status.gameplay, true);
  assert.equal(status.controllerUi, true);
  assert.equal(status.playlink.bound, false);
  assert.equal(status.playlink.clientListenPort, 9060);
  assert.equal(status.playlink.serverPort, 9066);
  assert.equal(status.reference.commit, "e9543047cd73cd93e1cbc59313a91f0f2c0f68cc");
});

test("message catalog matches GameMessages.kt and has no duplicates", () => {
  const declared = Object.values(TypeString);
  assert.equal(declared.length, 58);
  assert.equal(MESSAGE_CATALOG.length, declared.length);
  assert.deepEqual(
    MESSAGE_CATALOG.map((entry) => entry.typeString).sort(),
    [...declared].sort(),
  );
  assert.equal(new Set(declared).size, declared.length);
});

test("static paths cannot escape the export directory", () => {
  const root = path.resolve("web", "out");
  assert.equal(resolveStatic(root, "/"), path.join(root, "index.html"));
  assert.equal(resolveStatic(root, "/index.html"), path.join(root, "index.html"));
  assert.equal(resolveStatic(root, "/../LICENSE"), null);
  assert.equal(resolveStatic(root, "/%2e%2e/LICENSE"), null);
  assert.equal(resolveStatic(root, "/%00"), null);
});

test("bridge serves status, rejects session payloads, and leaves UDP 9060 free", async () => {
  const server = createBridgeServer();
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/status`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    const body = (await response.json()) as { gameplay: boolean; controllerUi: boolean; playlink: { bound: boolean } };
    assert.equal(body.gameplay, true);
    assert.equal(body.controllerUi, true);
    assert.equal(body.playlink.bound, false);

    const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
    const first = await new Promise<string>((resolve, reject) => {
      ws.addEventListener("message", (event) => resolve(String(event.data)), { once: true });
      ws.addEventListener("error", () => reject(new Error("websocket failed")), { once: true });
    });
    const hello = JSON.parse(first) as { type: string; gameplay: boolean; controllerUi: boolean };
    assert.equal(hello.type, "bridge.status");
    assert.equal(hello.gameplay, true);
    assert.equal(hello.controllerUi, true);

    const rejected = new Promise<string>((resolve) => {
      ws.addEventListener("message", (event) => resolve(String(event.data)), { once: true });
    });
    ws.send(JSON.stringify({ TypeString: "ClientTriviaAnswer" }));
    const denial = JSON.parse(await rejected) as { type: string; reason: string };
    assert.equal(denial.type, "bridge.rejected");
    assert.equal(denial.reason, "not_joined");
    ws.close();

    await new Promise<void>((resolve, reject) => {
      const probe = dgram.createSocket("udp4");
      probe.once("error", (error: NodeJS.ErrnoException) => {
        probe.close();
        reject(error);
      });
      probe.bind(PLAYLINK_CLIENT_PORT, "0.0.0.0", () => {
        probe.close();
        resolve();
      });
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
