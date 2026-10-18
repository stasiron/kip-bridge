import http from "node:http";
import os from "node:os";
import path from "node:path";
import { HTTP_HOST, HTTP_PORT } from "./config.ts";
import { createBridge } from "./server.ts";

export function createBridgeServer(): http.Server {
  return createBridge().server;
}

export function lanHttpUrls(port: number): string[] {
  const urls: string[] = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) urls.push(`http://${entry.address}:${port}/`);
    }
  }
  return urls;
}

const invokedDirectly =
  typeof process.argv[1] === "string" && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);

if (invokedDirectly) {
  const bridge = createBridge();
  bridge.server.listen(HTTP_PORT, HTTP_HOST, () => {
    console.log(`Join code: ${bridge.joinCode}`);
    console.log(
      JSON.stringify(
        {
          openOnThisMachine: `http://127.0.0.1:${HTTP_PORT}/`,
          openOnIphone: lanHttpUrls(HTTP_PORT),
          session: `ws://127.0.0.1:${HTTP_PORT}/session`,
        },
        null,
        2,
      ),
    );
  });
}
