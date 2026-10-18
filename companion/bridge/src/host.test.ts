import assert from "node:assert/strict";
import dgram from "node:dgram";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { isLoopbackAddress } from "./playlink/access.ts";
import { qrAscii, qrMatrix } from "./qr.ts";
import { createBridge } from "./server.ts";
import { explainListenError, listenBridge } from "./startup.ts";
import { PLAYLINK_CLIENT_PORT } from "./config.ts";

const JOIN = "ABCD2345";

test("loopback check ignores the IPv4-mapped prefix", () => {
  assert.equal(isLoopbackAddress("127.0.0.1"), true);
  assert.equal(isLoopbackAddress("::ffff:127.0.0.1"), true);
  assert.equal(isLoopbackAddress("::1"), true);
  assert.equal(isLoopbackAddress("192.168.1.20"), false);
});

test("QR matrix has finder cores and a quiet-sized version for a LAN URL", () => {
  const url = "http://192.168.1.20:8787/";
  const matrix = qrMatrix(url);
  assert.equal(matrix.length, 25);
  assert.equal(matrix[0][0], true);
  assert.equal(matrix[3][3], true);
  assert.equal(matrix[0][1], true);
  const picture = qrAscii(url);
  assert.ok(picture.includes("██"));
  assert.equal(qrMatrix(url).length, matrix.length);
});

test("host page shows the join code and status JSON does not", async () => {
  const bridge = createBridge({ endpoints: ["127.0.0.1"], joinCode: JOIN });
  await listenBridge(bridge, "127.0.0.1", 0);
  const port = (bridge.server.address() as AddressInfo).port;
  try {
    const status = await fetch(`http://127.0.0.1:${port}/api/status`);
    const statusText = await status.text();
    assert.equal(status.status, 200);
    assert.equal(statusText.includes(JOIN), false);
    const parsed = JSON.parse(statusText) as { playlink: { bound: boolean } };
    assert.equal(parsed.playlink.bound, false);

    const host = await fetch(`http://127.0.0.1:${port}/host`);
    const html = await host.text();
    assert.equal(host.status, 200);
    assert.equal(html.includes(JOIN), true);
    assert.equal(html.includes("<svg"), true);
    assert.equal(html.includes("UDP 9060 is closed"), true);

    const page = await fetch(`http://127.0.0.1:${port}/`);
    const pageHtml = await page.text();
    assert.equal(page.status, 200);
    assert.match(pageHtml, /<html/i);

    await new Promise<void>((resolve, reject) => {
      const probe = dgram.createSocket("udp4");
      probe.once("error", (error) => {
        probe.close();
        reject(error);
      });
      probe.bind(PLAYLINK_CLIENT_PORT, "127.0.0.1", () => {
        probe.close();
        resolve();
      });
    });
  } finally {
    await bridge.close();
  }
});

test("a taken HTTP port is reported without changing network settings", async () => {
  const first = createBridge({ endpoints: ["127.0.0.1"], joinCode: JOIN });
  await listenBridge(first, "127.0.0.1", 0);
  const port = (first.server.address() as AddressInfo).port;
  const second = createBridge({ endpoints: ["127.0.0.1"], joinCode: "ZZZZZZZZ" });
  try {
    await assert.rejects(() => listenBridge(second, "127.0.0.1", port), (error: NodeJS.ErrnoException) => {
      assert.equal(error.code, "EADDRINUSE");
      assert.match(explainListenError(error, port), /already in use/);
      assert.match(explainListenError(error, port), /were not changed|start this one again/);
      return true;
    });
  } finally {
    await first.close();
    await second.close();
  }
});
