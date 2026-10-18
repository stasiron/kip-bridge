import assert from "node:assert/strict";
import dgram from "node:dgram";
import type http from "node:http";
import test, { describe } from "node:test";
import { DDP_PS4_VERSION } from "../config.ts";
import { isLocalNetworkAddress } from "./access.ts";
import { playerIpv4Addresses } from "./pool.ts";
import { discoverConsoles, discoverySearch, parseDiscoveryResponse } from "./discovery.ts";
import { ConsoleSimulator } from "./simulator.ts";
import { createBridge } from "../server.ts";

const UID_A = "a".repeat(32);
const UID_B = "b".repeat(32);

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("no port");
      resolve(address.port);
    });
  });
}

function framesOf(ws: WebSocket): Record<string, unknown>[] {
  const frames: Record<string, unknown>[] = [];
  ws.addEventListener("message", (event) => {
    frames.push(JSON.parse(String(event.data)) as Record<string, unknown>);
  });
  return frames;
}

async function waitFor(check: () => boolean | Promise<boolean>, label: string, timeoutMs = 2000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error(`timed out waiting for ${label}`);
}

function openSocket(port: number): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve(ws), { once: true });
    ws.addEventListener("error", () => reject(new Error("websocket failed")), { once: true });
  });
}

async function join(port: number, uid: string, consolePort: number): Promise<{ ws: WebSocket; frames: Record<string, unknown>[] }> {
  const ws = await openSocket(port);
  const frames = framesOf(ws);
  ws.send(JSON.stringify({ type: "bridge.join", code: "TABLE01", uid, consoleHost: "127.0.0.1", consolePort }));
  await waitFor(
    () => frames.some((frame) => frame.type === "bridge.state" && frame.connection === "assigned"),
    `assignment for ${uid}`,
  );
  return { ws, frames };
}

function bridgeOptions(endpoints: string[], extra: Record<string, unknown> = {}) {
  return {
    endpoints,
    joinCode: "TABLE01",
    probeIntervalMs: 40,
    connectTimeoutMs: 1200,
    ackTimeoutMs: 300,
    detachGraceMs: 250,
    ...extra,
  };
}

test("player addresses skip loopback, public, and CGNAT ranges", () => {
  assert.deepEqual(
    playerIpv4Addresses([
      { family: "IPv4", internal: true, address: "127.0.0.1" },
      { family: "IPv4", internal: false, address: "100.76.200.123" },
      { family: "IPv4", internal: false, address: "8.8.8.8" },
      { family: "IPv4", internal: false, address: "192.168.0.18" },
      { family: "IPv4", internal: false, address: "172.20.240.1" },
      { family: "IPv6", internal: false, address: "fe80::1" },
    ]),
    ["192.168.0.18", "172.20.240.1"],
  );
});

test("private-network checks reject public addresses", () => {
  assert.equal(isLocalNetworkAddress("8.8.8.8"), false);
  assert.equal(isLocalNetworkAddress("172.32.0.1"), false);
  assert.equal(isLocalNetworkAddress("192.168.1.5"), true);
  assert.equal(isLocalNetworkAddress("10.1.2.3"), true);
  assert.equal(isLocalNetworkAddress("172.16.0.1"), true);
  assert.equal(isLocalNetworkAddress("127.0.0.2"), true);
  assert.equal(isLocalNetworkAddress("::ffff:192.168.0.8"), true);
  assert.equal(isLocalNetworkAddress("::1"), true);
  assert.equal(isLocalNetworkAddress("169.254.1.1"), true);
});

test("discovery search bytes and response parsing match DdpDiscovery", () => {
  assert.equal(
    discoverySearch(DDP_PS4_VERSION).toString("utf8"),
    "SRCH * HTTP/1.1\ndevice-discovery-protocol-version:00020020\n",
  );
  const parsed = parseDiscoveryResponse(
    "HTTP/1.1 200 Ok\nhost-id:ABC\nhost-type:PS4\nhost-name:Living Room\nsystem-version:1\nhost-request-port:997\n",
    "192.168.1.20",
  );
  assert.equal(parsed?.hostId, "ABC");
  assert.equal(parsed?.awake, true);
  assert.equal(parsed?.gamePort, 9066);
  assert.equal(parsed?.hostRequestPort, 997);
  assert.equal(parseDiscoveryResponse("HTTP/1.1 620 Asleep\nhost-id:ABC\n", "192.168.1.20")?.awake, false);
  assert.equal(parseDiscoveryResponse("HTTP/1.1 200 Ok\nhost-type:PS4\n", "192.168.1.20"), null);
});

test("discovery unicast finds an awake console and keeps the game port", async () => {
  const responder = dgram.createSocket({ type: "udp4" });
  await new Promise<void>((resolve) => responder.bind(0, "127.0.0.1", () => resolve()));
  const port = responder.address().port;
  responder.on("message", (payload, rinfo) => {
    assert.match(payload.toString("utf8"), /^SRCH \* HTTP\/1\.1\n/);
    responder.send(
      "HTTP/1.1 200 Ok\nhost-id:PS4-1\nhost-type:PS4\nhost-name:Den\nhost-request-port:997\n",
      rinfo.port,
      rinfo.address,
    );
  });
  try {
    const found = await discoverConsoles({
      broadcast: false,
      timeoutMs: 400,
      targets: [{ host: "127.0.0.1", port }],
    });
    assert.equal(found.length, 1);
    assert.equal(found[0]?.host, "127.0.0.1");
    assert.equal(found[0]?.gamePort, 9066);
    assert.equal(found[0]?.hostRequestPort, 997);
  } finally {
    await new Promise<void>((resolve) => responder.close(() => resolve()));
  }
});

describe("playlink sessions", { concurrency: false }, () => {
  test("handshake assigns a player and a wrong join code binds nothing", async () => {
    const sim = await ConsoleSimulator.listen();
    const bridge = createBridge(bridgeOptions(["127.0.0.1"]));
    const port = await listen(bridge.server);
    try {
      const body = await (await fetch(`http://127.0.0.1:${port}/api/status`)).text();
      assert.equal(body.includes("TABLE01"), false);
      assert.equal(JSON.parse(body).playlink.bound, false);
      const rejected = await openSocket(port);
      const rejectedFrames = framesOf(rejected);
      rejected.send(JSON.stringify({ type: "bridge.join", code: "WRONG", uid: UID_A, consoleHost: "127.0.0.1", consolePort: sim.port }));
      await waitFor(() => rejectedFrames.some((frame) => frame.code === "bad_join_code"), "bad join code");
      rejected.close();
      const { frames } = await join(port, UID_A, sim.port);
      const assigned = frames.find((frame) => frame.type === "bridge.state" && frame.connection === "assigned");
      assert.equal(assigned?.playerId, 1);
      assert.equal(assigned?.localAddress, "127.0.0.1");
      const client = sim.client("127.0.0.1");
      assert.ok(client?.messages.some((message) => message.TypeString === "DeviceInfoMessage" && message.Response === 10));
      assert.ok(client?.messages.some((message) => message.TypeString === "AllResourcesReceivedMessage"));
      const live = await (await fetch(`http://127.0.0.1:${port}/api/status`)).json();
      assert.equal(live.playlink.bound, true);
      assert.equal(live.gameplay, true);
      assert.equal(live.controllerUi, true);
    } finally {
      await bridge.close();
      await sim.close();
    }
  });

  test("one address rejects a second player and keeps the first session", async () => {
    const sim = await ConsoleSimulator.listen();
    const bridge = createBridge(bridgeOptions(["127.0.0.1"]));
    const port = await listen(bridge.server);
    try {
      await join(port, UID_A, sim.port);
      const second = await openSocket(port);
      const frames = framesOf(second);
      second.send(JSON.stringify({ type: "bridge.join", code: "TABLE01", uid: UID_B, consoleHost: "127.0.0.1", consolePort: sim.port }));
      await waitFor(() => frames.some((frame) => frame.code === "endpoint_exhausted"), "endpoint exhausted");
      assert.deepEqual(sim.addresses(), ["127.0.0.1"]);
      assert.equal(sim.client("127.0.0.1")?.playerId, 1);
    } finally {
      await bridge.close();
      await sim.close();
    }
  });

  test("distinct loopback addresses isolate two players", async () => {
    const sim = await ConsoleSimulator.listen();
    const bridge = createBridge(bridgeOptions(["127.0.0.1", "127.0.0.2"]));
    const port = await listen(bridge.server);
    try {
      const first = await join(port, UID_A, sim.port);
      const second = await join(port, UID_B, sim.port);
      assert.equal(first.frames.find((frame) => frame.connection === "assigned")?.localAddress, "127.0.0.1");
      assert.equal(second.frames.find((frame) => frame.connection === "assigned")?.localAddress, "127.0.0.2");
      assert.equal(sim.client("127.0.0.1")?.playerId, 1);
      assert.equal(sim.client("127.0.0.2")?.playerId, 2);
      sim.sendMessage("127.0.0.1", { TypeString: "PlayerJoinedMessage", CurrentPlayerID: 9, OldPlayerID: 9, SlotID: 0 });
      await waitFor(
        () => first.frames.some((frame) => frame.type === "bridge.event" && (frame.message as { CurrentPlayerID?: number })?.CurrentPlayerID === 9),
        "player joined on first session",
      );
      assert.equal(
        second.frames.some((frame) => (frame.message as { CurrentPlayerID?: number } | undefined)?.CurrentPlayerID === 9),
        false,
      );
      second.ws.send(JSON.stringify({
        type: "bridge.command",
        message: { TypeString: "KnowledgeIsPower.ClientCategorySelectChoice", ChosenCategoryIndex: 2 },
      }));
      await waitFor(
        () => sim.client("127.0.0.2")?.messages.some((message) => message.ChosenCategoryIndex === 2) === true,
        "category choice on second session",
      );
      assert.equal(sim.client("127.0.0.1")?.messages.some((message) => message.ChosenCategoryIndex === 2) ?? false, false);
    } finally {
      await bridge.close();
      await sim.close();
    }
  });

  test("commands, power play, trivia timeout, resources, and images follow the client", async () => {
    const sim = await ConsoleSimulator.listen();
    const bridge = createBridge(bridgeOptions(["127.0.0.1"]));
    const port = await listen(bridge.server);
    try {
      const { ws, frames } = await join(port, UID_A, sim.port);
      ws.send(JSON.stringify({ type: "bridge.command", message: { TypeString: "InterfaceVersionMessage", InterfaceVersion: "nope" } }));
      await waitFor(() => frames.some((frame) => frame.code === "server_message"), "server message rejected");
      ws.send(JSON.stringify({ type: "bridge.command", message: { TypeString: "NotARealMessage" } }));
      await waitFor(() => frames.some((frame) => frame.code === "unknown_type"), "unknown command");
      sim.sendJsonText("127.0.0.1", '{"TypeString":"MadeUpMessage","value":1}');
      await waitFor(() => frames.some((frame) => frame.type === "bridge.notice" && frame.detail === "MadeUpMessage"), "unknown console type");

      ws.send(JSON.stringify({
        type: "bridge.command",
        message: { TypeString: "KnowledgeIsPower.ClientTriviaAnswer", ChosenAnswerDisplayIndex: 1, AnswerTime: 1.25 },
      }));
      await waitFor(
        () => sim.client("127.0.0.1")?.messages.some((message) => message.ChosenAnswerDisplayIndex === 1 && message.PaintCleared === false) === true,
        "trivia command",
      );

      sim.sendMessage("127.0.0.1", {
        TypeString: "KnowledgeIsPower.ServerBeginPowerPlayPhase",
        PowerPlays: [{ DisplayIndex: 0, PowerType: 4, PowerTypes: [4], PowerTarget: 2, PowerPlayTargets: [1], New: true, TargetCount: 1 }],
        PowerPlayPlayers: [],
        RoundType: 0,
      });
      await waitFor(
        () => frames.some((frame) => (frame.message as { TypeString?: string } | undefined)?.TypeString === "KnowledgeIsPower.ServerBeginPowerPlayPhase"),
        "power play phase",
      );
      ws.send(JSON.stringify({
        type: "bridge.command",
        message: { TypeString: "KnowledgeIsPower.ClientPowerPlayChoice", PowerPlaySlotIndex: 0, TargetSlotIndex: [1] },
      }));
      await waitFor(
        () => sim.client("127.0.0.1")?.messages.some((message) => message.PowerPlaySlotIndex === 0) === true,
        "power play choice",
      );
      sim.sendMessage("127.0.0.1", { TypeString: "KnowledgeIsPower.ServerRequestPowerPlayChoice" });
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.equal(sim.client("127.0.0.1")?.messages.filter((message) => message.PowerPlaySlotIndex === -1).length, 0);
      sim.sendMessage("127.0.0.1", {
        TypeString: "KnowledgeIsPower.ServerBeginPowerPlayPhase",
        PowerPlays: [{ DisplayIndex: 1, PowerType: 5, PowerTypes: [5], PowerTarget: 2, PowerPlayTargets: [1], New: true, TargetCount: 1 }],
        PowerPlayPlayers: [],
        RoundType: 0,
      });
      await waitFor(
        () => frames.filter((frame) => (frame.message as { TypeString?: string } | undefined)?.TypeString === "KnowledgeIsPower.ServerBeginPowerPlayPhase").length >= 2,
        "second power play phase",
      );
      sim.sendMessage("127.0.0.1", { TypeString: "KnowledgeIsPower.ServerRequestPowerPlayChoice" });
      await waitFor(
        () => sim.client("127.0.0.1")?.messages.some((message) => message.PowerPlaySlotIndex === -1) === true,
        "empty power play choice",
      );

      sim.sendMessage("127.0.0.1", {
        TypeString: "KnowledgeIsPower.ServerBeginTriviaAnsweringPhase",
        QuestionID: "q",
        QuestionText: "Which?",
        QuestionDuration: 0.15,
        Answers: [{ DisplayIndex: 0, DisplayText: "A", IsCorrect: true }],
        PowerPlays: [],
        PowerPlayPlayers: [],
        RoundType: 0,
      });
      await waitFor(
        () => sim.client("127.0.0.1")?.messages.some((message) => message.ChosenAnswerDisplayIndex === -1 && message.AnswerTime === 0.15) === true,
        "trivia timeout",
        1500,
      );

      sim.sendMessage("127.0.0.1", {
        TypeString: "KnowledgeIsPower.ServerBeginLinkingAnsweringPhase",
        QuestionID: "link-timeout",
        QuestionText: "Link?",
        QuestionDuration: 0.12,
        LinkingAnswers: [],
      });
      await waitFor(
        () =>
          sim.client("127.0.0.1")?.messages.some(
            (message) =>
              message.TypeString === "KnowledgeIsPower.ClientLinkingAnswer" &&
              message.ClientLinkingCorrectAnswerCount === 0,
          ) === true,
        "linking timeout empty answer",
        1500,
      );

      sim.sendMessage("127.0.0.1", { TypeString: "ResourceRequirementsMessage", Requirements: [{ GUID: "missing-guid", Rqrmnt: 0 }] });
      await waitFor(() => sim.client("127.0.0.1")?.messages.some((message) => message.ResourceGUID === "missing-guid") === true, "resource request");
      sim.sendMessage("127.0.0.1", { TypeString: "KnowledgeIsPower.ServerRequestEndOfGameFactCount" });
      await waitFor(() => sim.client("127.0.0.1")?.messages.some((message) => message.FactCount === 63) === true, "fact count");

      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
      sim.sendJpeg("127.0.0.1", 7, jpeg);
      sim.sendMessage("127.0.0.1", {
        TypeString: "ImageResourceContentTransferMessage",
        TransferID: 7,
        ImageGUID: "22222222-2222-2222-2222-222222222222",
        Acknowledge: true,
      });
      await waitFor(
        () => frames.some((frame) => frame.type === "bridge.image" && frame.guid === "22222222-2222-2222-2222-222222222222"),
        "console image",
      );

      ws.send(JSON.stringify({
        type: "bridge.command",
        message: {
          TypeString: "KnowledgeIsPower.ClientRequestAvatarMessage",
          RequestID: "11111111-1111-1111-1111-111111111111",
          AvatarID: "COWGIRL",
          Request: true,
        },
      }));
      ws.send(JSON.stringify({
        type: "bridge.portrait",
        playerName: "Ada",
        imageGuid: "33333333-3333-3333-3333-333333333333",
        imageBase64: jpeg.toString("base64"),
      }));
      await waitFor(() => (sim.client("127.0.0.1")?.jpegs.length ?? 0) >= 1, "portrait jpeg");
      await waitFor(
        () => sim.client("127.0.0.1")?.messages.some((message) => message.playerName === "Ada" && message.playerCardId === "COWGIRL") === true,
        "portrait profile",
      );
    } finally {
      await bridge.close();
      await sim.close();
    }
  });

  test("a missing acknowledgement is reported and the command is not sent again", async () => {
    const sim = await ConsoleSimulator.listen();
    const bridge = createBridge(bridgeOptions(["127.0.0.1"]));
    const port = await listen(bridge.server);
    try {
      const { ws, frames } = await join(port, UID_A, sim.port);
      await waitFor(
        () => sim.client("127.0.0.1")?.messages.some((message) => message.TypeString === "AllResourcesReceivedMessage") === true,
        "handshake settled",
      );
      sim.suppressNextAcks = 1;
      ws.send(JSON.stringify({
        type: "bridge.command",
        message: { TypeString: "KnowledgeIsPower.ClientCategorySelectChoice", ChosenCategoryIndex: 1 },
      }));
      await waitFor(
        () => frames.some((frame) => frame.code === "ack_timeout" && String(frame.detail).includes("ClientCategorySelectChoice")),
        "ack timeout",
        1500,
      );
      await new Promise((resolve) => setTimeout(resolve, 350));
      assert.equal(sim.client("127.0.0.1")?.messages.filter((message) => message.ChosenCategoryIndex === 1).length, 1);
      assert.equal(frames.some((frame) => frame.connection === "closed"), false);
    } finally {
      await bridge.close();
      await sim.close();
    }
  });

  test("a nack is surfaced and does not close the session", async () => {
    const sim = await ConsoleSimulator.listen();
    const bridge = createBridge(bridgeOptions(["127.0.0.1"]));
    const port = await listen(bridge.server);
    try {
      const { ws, frames } = await join(port, UID_A, sim.port);
      await waitFor(
        () => sim.client("127.0.0.1")?.messages.some((message) => message.TypeString === "AllResourcesReceivedMessage") === true,
        "handshake settled",
      );
      sim.nackNextData = true;
      ws.send(JSON.stringify({
        type: "bridge.command",
        message: { TypeString: "KnowledgeIsPower.ClientCategorySelectChoice", ChosenCategoryIndex: 0 },
      }));
      await waitFor(() => frames.some((frame) => frame.code === "nack"), "nack");
      assert.match(String(frames.find((frame) => frame.code === "nack")?.detail), /01/);
      assert.equal(frames.some((frame) => frame.connection === "closed"), false);
    } finally {
      await bridge.close();
      await sim.close();
    }
  });

  test("dropped probes are repeated until the console answers", async () => {
    const sim = await ConsoleSimulator.listen();
    sim.dropInbound = 3;
    const bridge = createBridge(bridgeOptions(["127.0.0.1"]));
    const port = await listen(bridge.server);
    try {
      await join(port, UID_A, sim.port);
      assert.ok((sim.client("127.0.0.1")?.probes ?? 0) >= 4);
    } finally {
      await bridge.close();
      await sim.close();
    }
  });

  test("a silent console times out and releases UDP 9060", async () => {
    const sim = await ConsoleSimulator.listen();
    sim.dropInbound = 100;
    const bridge = createBridge(bridgeOptions(["127.0.0.1"], { connectTimeoutMs: 250 }));
    const port = await listen(bridge.server);
    try {
      const ws = await openSocket(port);
      const frames = framesOf(ws);
      ws.send(JSON.stringify({ type: "bridge.join", code: "TABLE01", uid: UID_A, consoleHost: "127.0.0.1", consolePort: sim.port }));
      await waitFor(() => frames.some((frame) => frame.code === "connect_timeout"), "connect timeout", 1500);
      await waitFor(async () => {
        const body = await (await fetch(`http://127.0.0.1:${port}/api/status`)).json();
        return body.playlink.bound === false;
      }, "released endpoint");
    } finally {
      await bridge.close();
      await sim.close();
    }
  });

  test("the same browser uid reattaches without a second handshake", async () => {
    const sim = await ConsoleSimulator.listen();
    const bridge = createBridge(bridgeOptions(["127.0.0.1"], { detachGraceMs: 500 }));
    const port = await listen(bridge.server);
    try {
      const first = await join(port, UID_A, sim.port);
      const playerId = first.frames.find((frame) => frame.connection === "assigned")?.playerId;
      first.ws.close();
      await new Promise((resolve) => setTimeout(resolve, 40));
      const second = await openSocket(port);
      const frames = framesOf(second);
      second.send(JSON.stringify({ type: "bridge.join", code: "TABLE01", uid: UID_A, consoleHost: "127.0.0.1", consolePort: sim.port }));
      await waitFor(() => frames.some((frame) => frame.type === "bridge.snapshot" && frame.playerId === playerId), "snapshot");
      assert.equal(
        sim.client("127.0.0.1")?.messages.filter((message) => message.TypeString === "ClientRequestPlayerIDMessage").length,
        1,
      );
    } finally {
      await bridge.close();
      await sim.close();
    }
  });

  test("a new handshake with the same uid rejoins the stored player", async () => {
    const sim = await ConsoleSimulator.listen();
    const bridge = createBridge(bridgeOptions(["127.0.0.1"], { detachGraceMs: 40 }));
    const port = await listen(bridge.server);
    try {
      const first = await join(port, UID_A, sim.port);
      first.ws.send(JSON.stringify({
        type: "bridge.command",
        message: {
          TypeString: "ClientPlayerProfileMessage",
          playerName: "Ada",
          uppercasePlayerName: "ADA",
          deviceCultureName: "en-US",
          playerCardId: "COWGIRL",
        },
      }));
      await waitFor(() => sim.client("127.0.0.1")?.messages.some((message) => message.playerName === "Ada") === true, "profile stored");
      first.ws.send(JSON.stringify({ type: "bridge.disconnect" }));
      await waitFor(() => first.frames.some((frame) => frame.connection === "closed"), "disconnect");
      await new Promise((resolve) => setTimeout(resolve, 80));
      const second = await join(port, UID_A, sim.port);
      await waitFor(
        () => second.frames.some((frame) => (frame.message as { TypeString?: string } | undefined)?.TypeString === "RejoiningClientOwnProfileMessage"),
        "rejoin profile",
      );
      assert.equal(second.frames.find((frame) => frame.connection === "assigned")?.playerId, 1);
    } finally {
      await bridge.close();
      await sim.close();
    }
  });
});
