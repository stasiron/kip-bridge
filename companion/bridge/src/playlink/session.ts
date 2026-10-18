import dgram from "node:dgram";
import { randomUUID } from "node:crypto";
import { PLAYLINK_CLIENT_PORT } from "../config.ts";
import { ProtocolDecoder, ProtocolEncoder, type DecodedPacket, type WireMessage } from "../protocol/codec.ts";
import { MESSAGE_FIELDS } from "../protocol/schema.ts";
import { SchemaError } from "../protocol/schema.ts";

export type ConnectionState = "probing" | "handshaking" | "assigned" | "closed";

export type SessionEvent =
  | {
      type: "state";
      connection: ConnectionState;
      playerId: number | null;
      slotId: number | null;
      displayName: string | null;
      decades: boolean;
      localAddress: string;
    }
  | { type: "event"; message: WireMessage }
  | { type: "sent"; messageId: number; message: WireMessage }
  | { type: "image"; guid: string; jpeg: Buffer }
  | { type: "error"; code: string; detail: string }
  | { type: "notice"; code: string; detail: string }
  | { type: "ack"; messageId: number }
  | { type: "closed" };

export interface SessionOptions {
  uid: string;
  localAddress: string;
  consoleHost: string;
  consolePort: number;
  probeIntervalMs?: number;
  connectTimeoutMs?: number;
  ackTimeoutMs?: number;
  listenPort?: number;
  deviceModel?: string;
  deviceOperatingSystem?: string;
}

interface ResourceRequirement {
  GUID: string;
  Rqrmnt: number;
}

function bindSocket(socket: dgram.Socket, port: number, address: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      socket.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      socket.off("error", onError);
      resolve();
    };
    socket.once("error", onError);
    socket.once("listening", onListening);
    socket.bind({ port, address, exclusive: true });
  });
}

function closeSocket(socket: dgram.Socket | null): Promise<void> {
  if (!socket) return Promise.resolve();
  return new Promise((resolve) => {
    socket.close(() => resolve());
  });
}

export class PlayLinkSession {
  readonly uid: string;
  readonly localAddress: string;
  readonly consoleHost: string;
  readonly consolePort: number;
  readonly listenPort: number;
  onEvent: (event: SessionEvent) => void = () => {};

  playerId: number | null = null;
  slotId: number | null = null;
  displayName: string | null = null;
  gameId: string | null = null;
  connection: ConnectionState = "probing";
  readonly avatars: WireMessage[] = [];
  readonly images = new Map<string, Buffer>();
  lastScreen: WireMessage | null = null;
  selectedAvatarId: string | null = null;
  playerName: string | null = null;

  get decades(): boolean {
    return this.encoder.decades;
  }

  private readonly probeIntervalMs: number;
  private readonly connectTimeoutMs: number;
  private readonly ackTimeoutMs: number;
  private readonly deviceModel: string;
  private readonly deviceOperatingSystem: string;
  private readonly decoder = new ProtocolDecoder();
  private readonly encoder = new ProtocolEncoder();
  private receive: dgram.Socket | null = null;
  private sendSocket: dgram.Socket | null = null;
  private chain: Promise<void> = Promise.resolve();
  private probeTimer: NodeJS.Timeout | null = null;
  private connectTimer: NodeJS.Timeout | null = null;
  private triviaTimer: NodeJS.Timeout | null = null;
  private phaseTimer: NodeJS.Timeout | null = null;
  private readonly ackTimers = new Map<number, NodeJS.Timeout>();
  private lastServerMessageId: number | null = null;
  private closed = false;
  private readonly receivedResourceGuids = new Set<string>();
  private readonly pendingImages = new Map<number, Buffer>();
  private readonly pendingImageControls = new Map<number, string>();
  private powerPlayChoiceSent = false;
  private triviaAnswerSent = false;
  private phaseAnswerSent = false;

  constructor(options: SessionOptions) {
    this.uid = options.uid;
    this.localAddress = options.localAddress;
    this.consoleHost = options.consoleHost;
    this.consolePort = options.consolePort;
    this.listenPort = options.listenPort ?? PLAYLINK_CLIENT_PORT;
    this.probeIntervalMs = options.probeIntervalMs ?? 1000;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 5000;
    this.ackTimeoutMs = options.ackTimeoutMs ?? 3000;
    this.deviceModel = options.deviceModel ?? "KIP Browser Bridge";
    this.deviceOperatingSystem = options.deviceOperatingSystem ?? `Node.js ${process.version}`;
  }

  async open(): Promise<void> {
    const receive = dgram.createSocket({ type: "udp4" });
    const sendSocket = dgram.createSocket({ type: "udp4" });
    this.receive = receive;
    this.sendSocket = sendSocket;
    try {
      await bindSocket(receive, this.listenPort, this.localAddress);
      await bindSocket(sendSocket, 0, this.localAddress);
    } catch (error) {
      await closeSocket(receive);
      await closeSocket(sendSocket);
      this.receive = null;
      this.sendSocket = null;
      throw error;
    }
    receive.on("message", (payload) => this.onDatagram(payload));
    receive.on("error", (error) => this.fail("udp_receive_error", error.message));
    sendSocket.on("error", (error) => this.fail("udp_send_error", error.message));
    this.connectTimer = setTimeout(() => {
      if (this.connection === "probing") {
        this.fail("connect_timeout", `no connection ack from ${this.consoleHost}:${this.consolePort}`);
      }
    }, this.connectTimeoutMs);
    this.probeTimer = setInterval(() => this.heartbeat(), this.probeIntervalMs);
    this.heartbeat();
    this.publishState();
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.connection = "closed";
    if (this.probeTimer) clearInterval(this.probeTimer);
    if (this.connectTimer) clearTimeout(this.connectTimer);
    if (this.triviaTimer) clearTimeout(this.triviaTimer);
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    for (const timer of this.ackTimers.values()) clearTimeout(timer);
    this.ackTimers.clear();
    const receive = this.receive;
    const sendSocket = this.sendSocket;
    this.receive = null;
    this.sendSocket = null;
    await closeSocket(receive);
    await closeSocket(sendSocket);
    this.onEvent({ type: "closed" });
  }

  sendCommand(message: Record<string, unknown>): void {
    if (this.connection === "probing" || this.connection === "closed") {
      this.onEvent({ type: "error", code: "not_connected", detail: "the console has not acknowledged this session" });
      return;
    }
    this.noteLocalCommand(message);
    this.transmit(message);
  }

  sendPortrait(jpeg: Buffer, playerName: string, imageGuid: string = randomUUID()): void {
    if (!this.selectedAvatarId) {
      this.onEvent({ type: "error", code: "avatar_required", detail: "select an avatar before sending a portrait" });
      return;
    }
    if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
      this.onEvent({ type: "error", code: "not_jpeg", detail: "portrait payload does not start with a JPEG marker" });
      return;
    }
    this.playerName = playerName;
    const first = this.encoder.encodeImageTransfer(jpeg, imageGuid, 2, 2);
    this.track(first.control.messageId, first.control.packets, "ClientImageResourceContentTransferMessage");
    for (const packet of first.control.packets) this.write(packet);
    this.track(first.image.messageId, first.image.packets, "jpeg");
    for (const packet of first.image.packets) this.write(packet);
    this.onEvent({
      type: "sent",
      messageId: first.control.messageId,
      message: {
        TypeString: "ClientImageResourceContentTransferMessage",
        TransferID: 2,
        ImageGUID: imageGuid,
        ImgType: 2,
      },
    });
    const profile: WireMessage = {
      TypeString: "ClientPlayerProfileMessage",
      playerName,
      uppercasePlayerName: playerName.toUpperCase(),
      deviceCultureName: "en-US",
      playerCardId: this.selectedAvatarId,
    };
    this.transmit(profile);
    const second = this.encoder.encodeImageTransfer(jpeg, imageGuid, 3, 2);
    this.track(second.control.messageId, second.control.packets, "ClientImageResourceContentTransferMessage");
    for (const packet of second.control.packets) this.write(packet);
    this.track(second.image.messageId, second.image.packets, "jpeg");
    for (const packet of second.image.packets) this.write(packet);
  }

  private noteLocalCommand(message: Record<string, unknown>): void {
    if (message.TypeString === "KnowledgeIsPower.ClientRequestAvatarMessage" && message.Request === true) {
      if (typeof message.AvatarID === "string") this.selectedAvatarId = message.AvatarID;
    }
    if (message.TypeString === "KnowledgeIsPower.ClientRequestAvatarMessage" && message.Request === false) {
      if (message.AvatarID === this.selectedAvatarId) this.selectedAvatarId = null;
    }
    if (message.TypeString === "KnowledgeIsPower.ClientPowerPlayChoice") this.powerPlayChoiceSent = true;
    if (message.TypeString === "KnowledgeIsPower.ClientTriviaAnswer") {
      this.triviaAnswerSent = true;
      if (this.triviaTimer) clearTimeout(this.triviaTimer);
    }
    if (
      message.TypeString === "KnowledgeIsPower.ClientLinkingAnswer" ||
      message.TypeString === "KnowledgeIsPower.ClientSortingAnswer" ||
      message.TypeString === "KnowledgeIsPower.ClientToServerOrderingAnswer" ||
      message.TypeString === "KnowledgeIsPower.ClientToServerEliminatingAnswer" ||
      message.TypeString === "KnowledgeIsPower.PrototypeClientToServerMissingLetterAnswer" ||
      message.TypeString === "KnowledgeIsPower.ClientToServerMatchingAnswer"
    ) {
      this.phaseAnswerSent = true;
      if (this.phaseTimer) clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
    if (message.TypeString === "ClientPlayerProfileMessage" && typeof message.playerName === "string") {
      this.playerName = message.playerName;
    }
  }

  private heartbeat(): void {
    if (this.closed) return;
    if (this.lastServerMessageId === null) {
      this.write(this.encoder.encodeConnectionRequest());
      this.write(this.encoder.encodeDeviceUid(this.uid, false));
      this.write(this.encoder.encodeDeviceUid(this.uid, true));
      return;
    }
    this.write(this.encoder.encodeAck(this.lastServerMessageId));
  }

  private onDatagram(payload: Buffer): void {
    if (this.closed) return;
    const decoded = this.decoder.decode(payload);
    this.apply(decoded);
  }

  private apply(decoded: DecodedPacket): void {
    switch (decoded.kind) {
      case "connectionInit":
        if (this.connectTimer) clearTimeout(this.connectTimer);
        if (this.connection === "probing") {
          this.connection = "handshaking";
          this.publishState();
        }
        return;
      case "ack":
        this.clearAck(decoded.messageId);
        this.onEvent({ type: "ack", messageId: decoded.messageId });
        return;
      case "nack":
        this.clearAck(decoded.messageId);
        this.onEvent({
          type: "error",
          code: "nack",
          detail: `console nacked message ${decoded.messageId} payload ${decoded.payload.toString("hex")}`,
        });
        return;
      case "data":
        this.noteServerData(decoded.messageId);
        for (const message of decoded.messages) this.onServerMessage(message);
        for (const item of decoded.unparsed) {
          this.onEvent({ type: "notice", code: "unparsed_message", detail: JSON.stringify(item) });
        }
        return;
      case "image":
        this.noteServerData(decoded.messageId);
        this.onImage(decoded.transferId, decoded.jpeg);
        return;
      case "fragment":
        return;
      case "deviceUid":
        this.onEvent({ type: "notice", code: "device_uid", detail: decoded.uid });
        return;
      case "unknown":
        this.onEvent({
          type: "notice",
          code: "unknown_datagram",
          detail: decoded.raw.subarray(0, 16).toString("hex"),
        });
        return;
      case "tooShort":
        this.onEvent({ type: "error", code: "short_datagram", detail: `${decoded.raw.length} bytes` });
        return;
      case "error":
        this.onEvent({ type: "error", code: "decode_error", detail: decoded.message });
        return;
      default:
        return;
    }
  }

  private noteServerData(messageId: number): void {
    this.lastServerMessageId = messageId;
    this.write(this.encoder.encodeAck(messageId));
  }

  private onServerMessage(message: WireMessage): void {
    this.rememberScreen(message);
    this.onEvent({ type: "event", message });
    if (!MESSAGE_FIELDS[message.TypeString]) {
      this.onEvent({ type: "notice", code: "unknown_type", detail: message.TypeString });
    }
    switch (message.TypeString) {
      case "InterfaceVersionMessage":
        if (typeof message.InterfaceVersion === "string" && message.InterfaceVersion.startsWith("KIP2_")) {
          this.encoder.decades = true;
        }
        this.publishState();
        return;
      case "SessionStateMessage":
        this.transmit({ TypeString: "ClientRequestPlayerIDMessage", UID: this.uid });
        return;
      case "AssignPlayerIDAndSlotMessage":
        this.playerId = numberOrNull(message.PlayerID);
        this.slotId = numberOrNull(message.SlotID);
        this.displayName = typeof message.DisplayName === "string" ? message.DisplayName : null;
        this.connection = "assigned";
        this.publishState();
        this.transmit({
          TypeString: "DeviceInfoMessage",
          Response: 10,
          DeviceSize: 2,
          DeviceOS: 1,
          DeviceModel: this.deviceModel,
          DeviceType: "Handheld",
          DeviceUID: this.uid,
          DeviceOperatingSystem: this.deviceOperatingSystem,
        });
        this.transmit({ TypeString: "KnowledgeIsPower.ClientRequestAvatarStatusMessage" });
        return;
      case "ResourceRequirementsMessage": {
        const requirements = Array.isArray(message.Requirements) ? (message.Requirements as ResourceRequirement[]) : [];
        const missing = requirements.filter((item) => item && typeof item.GUID === "string" && !this.receivedResourceGuids.has(item.GUID));
        if (missing.length === 0) {
          this.transmit({ TypeString: "AllResourcesReceivedMessage", Requirements: requirements });
        } else {
          for (const item of missing) this.transmit({ TypeString: "RequestResourceMessage", ResourceGUID: item.GUID });
        }
        return;
      }
      case "KnowledgeIsPower.ServerRequestEndOfGameFactCount":
        this.transmit({ TypeString: "KnowledgeIsPower.ClientEndOfGameFactCount", FactCount: 63 });
        return;
      case "KnowledgeIsPower.ServerAvatarStatusMessage":
        this.avatars.push(message);
        return;
      case "KnowledgeIsPower.ServerBeginPowerPlayPhase":
        this.powerPlayChoiceSent = false;
        return;
      case "KnowledgeIsPower.ServerRequestPowerPlayChoice":
        if (!this.powerPlayChoiceSent) {
          this.powerPlayChoiceSent = true;
          this.transmit({
            TypeString: "KnowledgeIsPower.ClientPowerPlayChoice",
            PowerPlaySlotIndex: -1,
            TargetSlotIndex: [],
          });
        }
        return;
      case "KnowledgeIsPower.ServerBeginTriviaAnsweringPhase":
        this.armTrivia(message);
        return;
      case "KnowledgeIsPower.ServerBeginLinkingAnsweringPhase":
        this.armPhaseTimeout(message, {
          TypeString: "KnowledgeIsPower.ClientLinkingAnswer",
          ClientLinkingCorrectAnswerCount: 0,
          ClientAnswers: [],
        });
        return;
      case "KnowledgeIsPower.ServerBeginSortingAnsweringPhase":
        this.armPhaseTimeout(message, {
          TypeString: "KnowledgeIsPower.ClientSortingAnswer",
          ClientSortingCorrectAnswerCount: 0,
          SortingAnswers: [],
        });
        return;
      case "KnowledgeIsPower.ServerBeginOrderingAnsweringPhase":
        this.armPhaseTimeout(message, {
          TypeString: "KnowledgeIsPower.ClientToServerOrderingAnswer",
          ClientOrderingCorrectAnswerCount: 0,
        });
        return;
      case "KnowledgeIsPower.ServerBeginEliminatingAnsweringPhase":
        this.armPhaseTimeout(message, {
          TypeString: "KnowledgeIsPower.ClientToServerEliminatingAnswer",
          AnswerCount: 0,
        });
        return;
      case "KnowledgeIsPower.ServerBeginMissingLetterAnsweringPhase":
        this.armPhaseTimeout(message, {
          TypeString: "KnowledgeIsPower.PrototypeClientToServerMissingLetterAnswer",
          ClientMissingLetterCorrectAnswerCount: 0,
        });
        return;
      case "KnowledgeIsPower.ServerBeginMatchingAnsweringPhase":
        this.armPhaseTimeout(message, {
          TypeString: "KnowledgeIsPower.ClientToServerMatchingAnswer",
          ClientMatchingCorrectAnswerCount: 0,
        });
        return;
      case "ClientGameIDMessage":
        if (typeof message.GameID === "string") this.gameId = message.GameID;
        return;
      case "RejoiningClientOwnProfileMessage":
        if (typeof message.Name === "string") this.playerName = message.Name;
        if (typeof message.AvatarID === "string") this.selectedAvatarId = message.AvatarID;
        this.publishState();
        return;
      default:
        return;
    }
  }

  private armTrivia(message: WireMessage): void {
    if (this.triviaTimer) clearTimeout(this.triviaTimer);
    this.triviaAnswerSent = false;
    const duration = typeof message.QuestionDuration === "number" ? message.QuestionDuration : 0;
    if (duration <= 0) return;
    this.triviaTimer = setTimeout(() => {
      if (this.triviaAnswerSent || this.closed) return;
      this.triviaAnswerSent = true;
      this.transmit({
        TypeString: "KnowledgeIsPower.ClientTriviaAnswer",
        ChosenAnswerDisplayIndex: -1,
        AnswerTime: duration,
      });
    }, duration * 1000);
  }

  /**
   * Mirror Android CountDownTimer.onFinish when the browser tab is suspended:
   * send an empty / zero answer so the console can advance the round.
   */
  private armPhaseTimeout(message: WireMessage, emptyAnswer: Record<string, unknown>): void {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseAnswerSent = false;
    const duration = typeof message.QuestionDuration === "number" ? message.QuestionDuration : 0;
    if (duration <= 0) return;
    this.phaseTimer = setTimeout(() => {
      if (this.phaseAnswerSent || this.closed) return;
      this.phaseAnswerSent = true;
      this.transmit(emptyAnswer);
    }, duration * 1000);
  }

  private onImage(transferId: number, jpeg: Buffer): void {
    const guid = this.pendingImageControls.get(transferId);
    if (guid) {
      this.pendingImageControls.delete(transferId);
      this.finishImage(guid, jpeg);
      return;
    }
    this.pendingImages.set(transferId, jpeg);
  }

  private finishImage(guid: string, jpeg: Buffer): void {
    this.images.set(guid, jpeg);
    this.receivedResourceGuids.add(guid);
    this.onEvent({ type: "image", guid, jpeg });
    this.transmit({
      TypeString: "AllResourcesReceivedMessage",
      Requirements: [{ GUID: guid, Rqrmnt: 0 }],
    });
  }

  private rememberScreen(message: WireMessage): void {
    const screenTypes = new Set([
      "ClientHoldingScreenCommandMessage",
      "ClientQuizCommandMessage",
      "KnowledgeIsPower.ServerCategorySelectChoices",
      "KnowledgeIsPower.ServerBeginTriviaAnsweringPhase",
      "KnowledgeIsPower.ServerBeginPowerPlayPhase",
      "KnowledgeIsPower.ServerBeginLinkingAnsweringPhase",
      "KnowledgeIsPower.ServerBeginOrderingAnsweringPhase",
      "KnowledgeIsPower.ServerBeginSortingAnsweringPhase",
      "KnowledgeIsPower.ServerBeginEliminatingAnsweringPhase",
      "KnowledgeIsPower.ServerBeginMissingLetterAnsweringPhase",
      "KnowledgeIsPower.ServerBeginMatchingAnsweringPhase",
      "ClientEndOfGameFactCommandMessage",
      "RejoiningClientOwnProfileMessage",
    ]);
    if (screenTypes.has(message.TypeString)) this.lastScreen = message;
    if (message.TypeString === "ImageResourceContentTransferMessage" && typeof message.ImageGUID === "string") {
      const transferId = numberOrNull(message.TransferID);
      if (transferId === null) return;
      const jpeg = this.pendingImages.get(transferId);
      if (jpeg) {
        this.pendingImages.delete(transferId);
        this.finishImage(message.ImageGUID, jpeg);
      } else {
        this.pendingImageControls.set(transferId, message.ImageGUID);
      }
    }
  }

  private transmit(message: Record<string, unknown>): void {
    try {
      const encoded = this.encoder.encodeMessage(message);
      this.track(encoded.messageId, encoded.packets, String(message.TypeString));
      for (const packet of encoded.packets) this.write(packet);
      this.onEvent({ type: "sent", messageId: encoded.messageId, message: message as WireMessage });
    } catch (error) {
      const detail = error instanceof SchemaError || error instanceof Error ? error.message : String(error);
      this.onEvent({ type: "error", code: "encode_error", detail });
    }
  }

  private track(messageId: number, _packets: Buffer[], typeString: string): void {
    const existing = this.ackTimers.get(messageId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.ackTimers.delete(messageId);
      if (this.closed) return;
      this.onEvent({
        type: "error",
        code: "ack_timeout",
        detail: `${typeString} message ${messageId} was not acknowledged`,
      });
    }, this.ackTimeoutMs);
    this.ackTimers.set(messageId, timer);
  }

  private clearAck(messageId: number): void {
    const timer = this.ackTimers.get(messageId);
    if (!timer) return;
    clearTimeout(timer);
    this.ackTimers.delete(messageId);
  }

  private write(packet: Buffer): void {
    const socket = this.sendSocket;
    if (!socket || this.closed) return;
    this.chain = this.chain
      .then(
        () =>
          new Promise<void>((resolve, reject) => {
            socket.send(packet, this.consolePort, this.consoleHost, (error) => (error ? reject(error) : resolve()));
          }),
      )
      .catch((error: unknown) => {
        if (!this.closed) {
          this.onEvent({
            type: "error",
            code: "udp_send_failed",
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      });
  }

  private publishState(): void {
    this.onEvent({
      type: "state",
      connection: this.connection,
      playerId: this.playerId,
      slotId: this.slotId,
      displayName: this.displayName,
      decades: this.encoder.decades,
      localAddress: this.localAddress,
    });
  }

  private fail(code: string, detail: string): void {
    if (this.closed) return;
    this.onEvent({ type: "error", code, detail });
    void this.close();
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
