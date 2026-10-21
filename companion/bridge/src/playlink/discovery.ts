import dgram from "node:dgram";
import os from "node:os";
import { DDP_PS4_PORT, DDP_PS4_VERSION, DDP_PS5_PORT, DDP_PS5_VERSION, PLAYLINK_SERVER_PORT } from "../config.ts";
import { isDottedIpv4 } from "./access.ts";

export interface DiscoveredConsole {
  host: string;
  hostId: string;
  hostType: string;
  hostName: string;
  systemVersion: string | null;
  statusCode: number;
  awake: boolean;
  gamePort: number;
  hostRequestPort: number | null;
}

export function discoverySearch(version: string): Buffer {
  return Buffer.from(`SRCH * HTTP/1.1\ndevice-discovery-protocol-version:${version}\n`, "utf8");
}

/** Same header parse as `DdpDiscovery.parseResponse`. `gamePort` stays 9066. */
export function parseDiscoveryResponse(data: string, senderIp: string): DiscoveredConsole | null {
  const lines = data.trim().split("\n").map((line) => line.trim());
  const statusLine = lines[0] ?? "";
  if (!statusLine.startsWith("HTTP/")) return null;
  const statusParts = statusLine.split(" ", 3);
  if (statusParts.length < 2) return null;
  const statusCode = Number(statusParts[1]);
  if (!Number.isInteger(statusCode)) return null;
  const headers = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const colon = line.indexOf(":");
    if (colon > 0) headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }
  const hostId = headers.get("host-id");
  if (!hostId) return null;
  const requestPort = headers.get("host-request-port");
  const parsedPort = requestPort === undefined ? null : Number(requestPort);
  return {
    host: senderIp,
    hostId,
    hostType: headers.get("host-type") ?? "Unknown",
    hostName: headers.get("host-name") ?? headers.get("host-type") ?? "Unknown",
    systemVersion: headers.get("system-version") ?? null,
    statusCode,
    awake: statusCode === 200,
    gamePort: PLAYLINK_SERVER_PORT,
    hostRequestPort: parsedPort !== null && Number.isInteger(parsedPort) ? parsedPort : null,
  };
}

export interface DiscoverOptions {
  timeoutMs?: number;
  targets?: { host: string; port: number }[];
  broadcast?: boolean;
}

export function discoverConsoles(options: DiscoverOptions = {}): Promise<DiscoveredConsole[]> {
  const timeoutMs = options.timeoutMs ?? 1500;
  const broadcast = options.broadcast !== false;
  const socket = dgram.createSocket({ type: "udp4" });
  const found = new Map<string, DiscoveredConsole>();

  return new Promise((resolve, reject) => {
    const finish = () => {
      clearTimeout(timer);
      socket.removeAllListeners("error");
      socket.close();
      resolve([...found.values()]);
    };
    const timer = setTimeout(finish, timeoutMs);
    socket.on("error", (error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });
    socket.on("message", (payload, rinfo) => {
      const parsed = parseDiscoveryResponse(payload.toString("utf8"), rinfo.address.replace(/^::ffff:/, ""));
      if (parsed?.awake) found.set(parsed.hostId, parsed);
    });
    socket.bind(0, () => {
      if (broadcast) {
        try {
          socket.setBroadcast(true);
        } catch (error) {
          clearTimeout(timer);
          socket.close();
          reject(error);
          return;
        }
        for (const target of broadcastTargets()) {
          socket.send(discoverySearch(target.version), target.port, target.host);
        }
      }
      for (const target of options.targets ?? []) {
        if (!isDottedIpv4(target.host)) continue;
        socket.send(discoverySearch(DDP_PS4_VERSION), target.port, target.host);
        socket.send(discoverySearch(DDP_PS5_VERSION), target.port, target.host);
      }
    });
  });
}

function broadcastTargets(): { host: string; port: number; version: string }[] {
  const hosts = new Set<string>(["255.255.255.255"]);
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if ((entry.family !== "IPv4" && (entry.family as string | number) !== 4) || entry.internal || !entry.netmask) continue;
      const broadcast = broadcastAddress(entry.address, entry.netmask);
      if (broadcast) hosts.add(broadcast);
    }
  }
  const targets: { host: string; port: number; version: string }[] = [];
  for (const host of hosts) {
    targets.push({ host, port: DDP_PS4_PORT, version: DDP_PS4_VERSION });
    targets.push({ host, port: DDP_PS5_PORT, version: DDP_PS5_VERSION });
  }
  return targets;
}

function broadcastAddress(address: string, netmask: string): string | null {
  const ip = address.split(".").map(Number);
  const mask = netmask.split(".").map(Number);
  if (ip.length !== 4 || mask.length !== 4) return null;
  return ip.map((part, index) => (part | (~(mask[index] ?? 0) & 0xff)) & 0xff).join(".");
}
