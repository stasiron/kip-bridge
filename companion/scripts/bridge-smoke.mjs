/**
 * Start the bridge briefly, hit /api/status, confirm controller flags, shut down.
 * Does not bind UDP 9060 (no join).
 */
import { createBridge } from "../bridge/src/server.ts";

const bridge = createBridge({
  endpoints: ["127.0.0.1"],
  joinCode: "SMOKETEST",
});

const port = await new Promise((resolve, reject) => {
  bridge.server.once("error", reject);
  bridge.server.listen(0, "127.0.0.1", () => {
    bridge.server.off("error", reject);
    const address = bridge.server.address();
    if (!address || typeof address === "string") reject(new Error("no port"));
    else resolve(address.port);
  });
});

try {
  const response = await fetch(`http://127.0.0.1:${port}/api/status`);
  if (!response.ok) throw new Error(`status HTTP ${response.status}`);
  const body = await response.json();
  if (body.service !== "kip-browser-bridge") throw new Error("bad service");
  if (body.gameplay !== true || body.controllerUi !== true) throw new Error("controller flags not true");
  if (body.playlink?.bound !== false) throw new Error("UDP should be unbound before join");
  if (JSON.stringify(body).includes("SMOKETEST")) throw new Error("join code leaked in status");
  const page = await fetch(`http://127.0.0.1:${port}/`);
  if (!page.ok) throw new Error(`frontend HTTP ${page.status} — run npm run build first`);
  console.log(`bridge smoke ok on :${port}`);
} finally {
  await bridge.close();
}
