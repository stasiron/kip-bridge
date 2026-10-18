import http from "node:http";
import os from "node:os";
import path from "node:path";
import { HTTP_HOST, HTTP_PORT } from "./config.ts";
import { createBridge } from "./server.ts";
import { runBridge } from "./startup.ts";

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

if (invokedDirectly || process.env.KIP_BRIDGE_LAUNCH === "1") {
  void runBridge(createBridge(), HTTP_HOST, HTTP_PORT);
}
