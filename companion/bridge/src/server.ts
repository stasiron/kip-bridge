import { randomInt, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { PLAYLINK_SERVER_PORT, SESSION_PATH } from "./config.ts";
import { renderHostPage } from "./host-page.ts";
import { isDottedIpv4, isLocalNetworkAddress, isLoopbackAddress } from "./playlink/access.ts";
import { discoverConsoles } from "./playlink/discovery.ts";
import { EndpointPool, lanIpv4Addresses } from "./playlink/pool.ts";
import { PlayLinkSession, type SessionEvent } from "./playlink/session.ts";
import { MESSAGE_CATALOG } from "./protocol/catalog.ts";
import { MESSAGE_FIELDS } from "./protocol/schema.ts";
import { bridgeStatus, type BridgeStatus } from "./status.ts";
import { contentType, resolveStatic } from "./static-files.ts";
import { resolveWebRoot } from "./web-root.ts";

const PORTRAIT_LIMIT = 400_000;
const JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface BridgeOptions {
  endpoints?: string[];
  joinCode?: string;
  probeIntervalMs?: number;
  connectTimeoutMs?: number;
  ackTimeoutMs?: number;
  detachGraceMs?: number;
  discoverTimeoutMs?: number;
  webRoot?: string;
}

export interface BridgeHandle {
  server: http.Server;
  joinCode: string;
  close: () => Promise<void>;
}

interface ManagedSession {
  session: PlayLinkSession;
  sockets: Set<WebSocket>;
  consoleHost: string;
  consolePort: number;
  retired: boolean;
  detachTimer: NodeJS.Timeout | null;
}

export function createJoinCode(): string {
  return Array.from({ length: 8 }, () => JOIN_ALPHABET[randomInt(JOIN_ALPHABET.length)]).join("");
}

export function createBridge(options: BridgeOptions = {}): BridgeHandle {
  const endpoints = options.endpoints ?? lanIpv4Addresses();
  const pool = new EndpointPool(endpoints);
  const webOut = options.webRoot ?? resolveWebRoot();
  const joinCode = options.joinCode ?? createJoinCode();
  const sessions = new Map<string, ManagedSession>();
  const socketSession = new WeakMap<WebSocket, ManagedSession>();
  let joinChain: Promise<void> = Promise.resolve();
  let activeSessions = 0;

  const status = (): BridgeStatus =>
    bridgeStatus({
      activeSessions,
      endpointCount: pool.size,
      freeEndpoints: pool.free(),
    });

  const server = http.createServer((req, res) => {
    const remote = req.socket.remoteAddress ?? "";
    if (!isLocalNetworkAddress(remote)) {
      sendJson(res, 403, { error: "not_private_network" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/api/status") {
      sendJson(res, 200, status());
      return;
    }
    if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/host") {
      if (!isLoopbackAddress(remote)) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
        res.end(req.method === "HEAD" ? undefined : "Not found\n");
        return;
      }
      const port = req.socket.localPort ?? 0;
      const html = renderHostPage({
        joinCode,
        urls: lanIpv4Addresses().map((address) => `http://${address}:${port}/`),
        status: status(),
      });
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : html);
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }
    if (!fs.existsSync(webOut)) {
      res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      res.end("Frontend export is missing. From the companion directory run: npm run build\n");
      return;
    }
    const file = locateFile(webOut, url.pathname);
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found\n");
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentType(file),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(file).pipe(res);
  });

  const sockets = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const remote = req.socket.remoteAddress ?? "";
    if (!isLocalNetworkAddress(remote)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
      socket.destroy();
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== SESSION_PATH) {
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(req, socket, head, (ws) => {
      sockets.emit("connection", ws, req);
    });
  });

  sockets.on("connection", (ws: WebSocket) => {
    send(ws, { type: "bridge.status", ...status() });
    ws.on("message", (data) => {
      void onClientMessage(ws, data.toString());
    });
    ws.on("close", () => detach(ws));
  });

  function enqueue(task: () => Promise<void>): Promise<void> {
    const run = joinChain.then(task, task);
    joinChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function onClientMessage(ws: WebSocket, raw: string): Promise<void> {
    let frame: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("object required");
      frame = parsed as Record<string, unknown>;
    } catch (error) {
      send(ws, { type: "bridge.error", code: "bad_json", detail: error instanceof Error ? error.message : String(error) });
      return;
    }
    switch (frame.type) {
      case "bridge.join":
        await enqueue(() => join(ws, frame));
        return;
      case "bridge.discover":
        await discover(ws);
        return;
      case "bridge.command":
        command(ws, frame.message);
        return;
      case "bridge.portrait":
        portrait(ws, frame);
        return;
      case "bridge.requestImage":
        requestImage(ws, frame.guid);
        return;
      case "bridge.disconnect":
        await enqueue(() => disconnect(ws));
        return;
      default:
        send(ws, { type: "bridge.rejected", reason: "not_joined" });
    }
  }

  async function join(ws: WebSocket, frame: Record<string, unknown>): Promise<void> {
    if (socketSession.has(ws)) {
      send(ws, { type: "bridge.error", code: "already_joined", detail: "this socket already has a session" });
      return;
    }
    if (typeof frame.code !== "string" || !codesMatch(frame.code, joinCode)) {
      send(ws, { type: "bridge.error", code: "bad_join_code", detail: "join code does not match the bridge" });
      return;
    }
    if (typeof frame.uid !== "string" || !/^[0-9a-fA-F]{32}$/.test(frame.uid)) {
      send(ws, { type: "bridge.error", code: "bad_uid", detail: "uid must be 32 hexadecimal characters" });
      return;
    }
    if (typeof frame.consoleHost !== "string" || !isDottedIpv4(frame.consoleHost) || !isLocalNetworkAddress(frame.consoleHost)) {
      send(ws, { type: "bridge.error", code: "bad_console_address", detail: "console host must be a private IPv4 address" });
      return;
    }
    const consolePort = frame.consolePort === undefined ? PLAYLINK_SERVER_PORT : Number(frame.consolePort);
    if (!Number.isInteger(consolePort) || consolePort < 1 || consolePort > 65535) {
      send(ws, { type: "bridge.error", code: "bad_console_address", detail: "console port is out of range" });
      return;
    }
    const uid = frame.uid.toLowerCase();
    const existing = sessions.get(uid);
    if (existing && !existing.retired) {
      if (existing.consoleHost !== frame.consoleHost || existing.consolePort !== consolePort) {
        send(ws, { type: "bridge.error", code: "session_conflict", detail: "this uid is already joined to another console" });
        return;
      }
      if (existing.detachTimer) clearTimeout(existing.detachTimer);
      existing.detachTimer = null;
      existing.sockets.add(ws);
      socketSession.set(ws, existing);
      send(ws, snapshot(existing.session));
      return;
    }
    if (endpoints.length === 0) {
      send(ws, { type: "bridge.error", code: "no_lan_address", detail: "the bridge has no non-loopback IPv4 address" });
      return;
    }
    const localAddress = pool.acquire();
    if (!localAddress) {
      send(ws, {
        type: "bridge.error",
        code: "endpoint_exhausted",
        detail: "every local IPv4 address already has a PlayLink session on UDP 9060",
      });
      return;
    }
    const session = new PlayLinkSession({
      uid,
      localAddress,
      consoleHost: frame.consoleHost,
      consolePort,
      probeIntervalMs: options.probeIntervalMs,
      connectTimeoutMs: options.connectTimeoutMs,
      ackTimeoutMs: options.ackTimeoutMs,
    });
    const managed: ManagedSession = {
      session,
      sockets: new Set([ws]),
      consoleHost: frame.consoleHost,
      consolePort,
      retired: false,
      detachTimer: null,
    };
    session.onEvent = (event) => publish(managed, event);
    sessions.set(uid, managed);
    socketSession.set(ws, managed);
    activeSessions += 1;
    try {
      await session.open();
    } catch (error) {
      await session.close();
      send(ws, {
        type: "bridge.error",
        code: "udp_bind_failed",
        detail: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    if (ws.readyState !== ws.OPEN) {
      await session.close();
    }
  }

  function command(ws: WebSocket, message: unknown): void {
    const managed = socketSession.get(ws);
    if (!managed) {
      send(ws, { type: "bridge.rejected", reason: "not_joined" });
      return;
    }
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      send(ws, { type: "bridge.error", code: "bad_json", detail: "command message must be an object" });
      return;
    }
    const record = message as Record<string, unknown>;
    const typeString = record.TypeString;
    if (typeof typeString !== "string" || !MESSAGE_FIELDS[typeString]) {
      send(ws, { type: "bridge.error", code: "unknown_type", detail: String(typeString) });
      return;
    }
    const origin = MESSAGE_CATALOG.find((entry) => entry.typeString === typeString)?.origin;
    if (origin === "server") {
      send(ws, { type: "bridge.error", code: "server_message", detail: typeString });
      return;
    }
    managed.session.sendCommand(record);
  }

  function portrait(ws: WebSocket, frame: Record<string, unknown>): void {
    const managed = socketSession.get(ws);
    if (!managed) {
      send(ws, { type: "bridge.rejected", reason: "not_joined" });
      return;
    }
    if (typeof frame.playerName !== "string" || frame.playerName.length === 0) {
      send(ws, { type: "bridge.error", code: "bad_json", detail: "portrait requires playerName" });
      return;
    }
    if (typeof frame.imageBase64 !== "string") {
      send(ws, { type: "bridge.error", code: "bad_json", detail: "portrait requires imageBase64" });
      return;
    }
    const jpeg = Buffer.from(frame.imageBase64, "base64");
    if (jpeg.length > PORTRAIT_LIMIT) {
      send(ws, { type: "bridge.error", code: "image_too_large", detail: `${jpeg.length} bytes exceeds ${PORTRAIT_LIMIT}` });
      return;
    }
    const guid = typeof frame.imageGuid === "string" ? frame.imageGuid : undefined;
    managed.session.sendPortrait(jpeg, frame.playerName, guid);
  }

  function requestImage(ws: WebSocket, guid: unknown): void {
    const managed = socketSession.get(ws);
    if (!managed) {
      send(ws, { type: "bridge.rejected", reason: "not_joined" });
      return;
    }
    if (typeof guid !== "string") {
      send(ws, { type: "bridge.error", code: "bad_json", detail: "guid must be a string" });
      return;
    }
    const jpeg = managed.session.images.get(guid);
    if (!jpeg) {
      send(ws, { type: "bridge.error", code: "unknown_image", detail: guid });
      return;
    }
    send(ws, { type: "bridge.image", guid, imageBase64: jpeg.toString("base64") });
  }

  async function discover(ws: WebSocket): Promise<void> {
    try {
      const consoles = await discoverConsoles({ timeoutMs: options.discoverTimeoutMs ?? 1200 });
      send(ws, { type: "bridge.consoles", consoles });
    } catch (error) {
      send(ws, {
        type: "bridge.error",
        code: "discover_failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function disconnect(ws: WebSocket): Promise<void> {
    const managed = socketSession.get(ws);
    if (!managed) {
      send(ws, { type: "bridge.rejected", reason: "not_joined" });
      return;
    }
    if (managed.detachTimer) clearTimeout(managed.detachTimer);
    await managed.session.close();
  }

  function detach(ws: WebSocket): void {
    const managed = socketSession.get(ws);
    if (!managed) return;
    socketSession.delete(ws);
    managed.sockets.delete(ws);
    if (managed.retired || managed.sockets.size > 0) return;
    managed.detachTimer = setTimeout(() => {
      void managed.session.close();
    }, options.detachGraceMs ?? 60_000);
  }

  function publish(managed: ManagedSession, event: SessionEvent): void {
    if (event.type === "closed") retire(managed);
    const frame = toFrame(event);
    if (!frame) return;
    for (const socket of managed.sockets) send(socket, frame);
  }

  function retire(managed: ManagedSession): void {
    if (managed.retired) return;
    managed.retired = true;
    if (managed.detachTimer) clearTimeout(managed.detachTimer);
    pool.release(managed.session.localAddress);
    if (sessions.get(managed.session.uid) === managed) sessions.delete(managed.session.uid);
    activeSessions = Math.max(0, activeSessions - 1);
    for (const socket of managed.sockets) socketSession.delete(socket);
  }

  let socketsClosed = false;
  const closeSockets = () => {
    if (socketsClosed) return;
    socketsClosed = true;
    sockets.close();
  };
  server.on("close", closeSockets);

  return {
    server,
    joinCode,
    close: async () => {
      for (const managed of [...sessions.values()]) {
        if (managed.detachTimer) clearTimeout(managed.detachTimer);
        await managed.session.close();
      }
      for (const client of sockets.clients) client.terminate();
      closeSockets();
      if (server.listening) {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  };
}

function snapshot(session: PlayLinkSession): Record<string, unknown> {
  return {
    type: "bridge.snapshot",
    connection: session.connection,
    playerId: session.playerId,
    slotId: session.slotId,
    displayName: session.displayName,
    localAddress: session.localAddress,
    decades: session.decades,
    gameId: session.gameId,
    selectedAvatarId: session.selectedAvatarId,
    playerName: session.playerName,
    avatars: session.avatars,
    images: [...session.images.entries()].map(([guid, jpeg]) => ({ guid, bytes: jpeg.length })),
    lastScreen: session.lastScreen,
  };
}

function toFrame(event: SessionEvent): Record<string, unknown> | null {
  switch (event.type) {
    case "state":
      return {
        type: "bridge.state",
        connection: event.connection,
        playerId: event.playerId,
        slotId: event.slotId,
        displayName: event.displayName,
        decades: event.decades,
        localAddress: event.localAddress,
      };
    case "event":
      return { type: "bridge.event", message: event.message };
    case "sent":
      return { type: "bridge.sent", messageId: event.messageId, message: event.message };
    case "image":
      return { type: "bridge.image", guid: event.guid, imageBase64: event.jpeg.toString("base64") };
    case "error":
      return { type: "bridge.error", code: event.code, detail: event.detail };
    case "notice":
      return { type: "bridge.notice", code: event.code, detail: event.detail };
    case "ack":
      return { type: "bridge.ack", messageId: event.messageId };
    case "closed":
      return { type: "bridge.state", connection: "closed" };
    default:
      return null;
  }
}

function codesMatch(given: string, expected: string): boolean {
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function send(ws: WebSocket, body: unknown): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(body));
}

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(payload);
}

function locateFile(root: string, urlPath: string): string | null {
  const resolved = resolveStatic(root, urlPath);
  if (!resolved || !fs.existsSync(resolved)) return null;
  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    const index = resolveStatic(root, `${urlPath.replace(/\/?$/, "/")}`);
    if (!index || !fs.existsSync(index) || !fs.statSync(index).isFile()) return null;
    return index;
  }
  if (!stat.isFile()) return null;
  return resolved;
}
