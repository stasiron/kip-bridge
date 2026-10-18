import dgram from "node:dgram";
import { ProtocolDecoder, ProtocolEncoder, type WireMessage } from "../protocol/codec.ts";

export interface SimulatorClient {
  address: string;
  probes: number;
  playerId: number | null;
  slotId: number | null;
  uid: string | null;
  messages: WireMessage[];
  jpegs: Buffer[];
  acks: number[];
}

interface ClientRecord extends SimulatorClient {
  decoder: ProtocolDecoder;
  encoder: ProtocolEncoder;
  greeted: boolean;
  profile: { name: string; avatarId: string; portraitGuid: string } | null;
}

/**
 * UDP peer that speaks the documented PlayLink server path.
 * It replies to the sender's address on port 9060. It does not invent a second
 * player on one address.
 */
export class ConsoleSimulator {
  readonly socket: dgram.Socket;
  readonly port: number;
  dropInbound = 0;
  nackNextData = false;
  suppressNextAcks = 0;
  private readonly clients = new Map<string, ClientRecord>();
  private readonly players = new Map<string, { playerId: number; slotId: number; profile: ClientRecord["profile"] }>();
  private nextPlayerId = 1;

  private constructor(socket: dgram.Socket, port: number) {
    this.socket = socket;
    this.port = port;
  }

  static listen(host = "127.0.0.1"): Promise<ConsoleSimulator> {
    const socket = dgram.createSocket({ type: "udp4" });
    return new Promise((resolve, reject) => {
      socket.once("error", reject);
      socket.bind(0, host, () => {
        socket.off("error", reject);
        const address = socket.address();
        const sim = new ConsoleSimulator(socket, address.port);
        socket.on("message", (payload, rinfo) => sim.onDatagram(payload, normalizeAddress(rinfo.address)));
        resolve(sim);
      });
    });
  }

  client(address: string): SimulatorClient | undefined {
    const found = this.clients.get(address);
    if (!found) return undefined;
    return {
      address: found.address,
      probes: found.probes,
      playerId: found.playerId,
      slotId: found.slotId,
      uid: found.uid,
      messages: found.messages,
      jpegs: found.jpegs,
      acks: found.acks,
    };
  }

  addresses(): string[] {
    return [...this.clients.keys()];
  }

  sendMessage(address: string, message: WireMessage): void {
    const client = this.clients.get(address);
    if (!client) throw new Error(`no simulator client at ${address}`);
    const encoded = client.encoder.encodeMessage(message);
    for (const packet of encoded.packets) this.reply(address, packet);
  }

  sendJpeg(address: string, transferId: number, jpeg: Buffer): void {
    const client = this.clients.get(address);
    if (!client) throw new Error(`no simulator client at ${address}`);
    const encoded = client.encoder.encodeImage(jpeg, transferId);
    for (const packet of encoded.packets) this.reply(address, packet);
  }

  sendJsonText(address: string, json: string): void {
    const client = this.clients.get(address);
    if (!client) throw new Error(`no simulator client at ${address}`);
    const encoded = client.encoder.encodeJsonText(json);
    for (const packet of encoded.packets) this.reply(address, packet);
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.socket.close(() => resolve()));
  }

  private onDatagram(payload: Buffer, address: string): void {
    const client = this.clientRecord(address);
    client.probes += 1;
    if (this.dropInbound > 0) {
      this.dropInbound -= 1;
      return;
    }
    const decoded = client.decoder.decode(payload);
    if (decoded.kind === "connectionInit" && client.playerId !== null) {
      client.greeted = false;
      client.decoder = new ProtocolDecoder();
      client.encoder = new ProtocolEncoder();
    }
    if (decoded.kind === "connectionInit" || decoded.kind === "deviceUid") {
      if (decoded.kind === "deviceUid") client.uid = decoded.uid;
      this.greet(client);
      return;
    }
    if (decoded.kind === "ack") {
      client.acks.push(decoded.messageId);
      return;
    }
    if (decoded.kind === "data") {
      if (this.nackNextData) {
        this.nackNextData = false;
        this.reply(address, client.encoder.encodeNack(decoded.messageId, 0x01));
        return;
      }
      if (this.suppressNextAcks > 0) this.suppressNextAcks -= 1;
      else this.reply(address, client.encoder.encodeAck(decoded.messageId));
      for (const message of decoded.messages) this.onClientMessage(client, message);
      return;
    }
    if (decoded.kind === "image") {
      client.jpegs.push(decoded.jpeg);
      if (this.suppressNextAcks > 0) this.suppressNextAcks -= 1;
      else this.reply(address, client.encoder.encodeAck(decoded.messageId));
      return;
    }
    if (decoded.kind === "fragment") return;
    if (decoded.kind === "error") {
      client.messages.push({ TypeString: "decode-error", detail: decoded.message });
    }
  }

  private greet(client: ClientRecord): void {
    if (client.greeted) return;
    client.greeted = true;
    this.reply(client.address, client.encoder.encodeConnectionRequest());
    const version = client.encoder.encodeMessage({
      TypeString: "InterfaceVersionMessage",
      InterfaceVersion: "KIP_2016-11-14-1222",
    });
    for (const packet of version.packets) this.reply(client.address, packet);
    const session = client.encoder.encodeMessage({
      TypeString: "SessionStateMessage",
      SessionID: 627950993,
    });
    for (const packet of session.packets) this.reply(client.address, packet);
  }

  private onClientMessage(client: ClientRecord, message: WireMessage): void {
    client.messages.push(message);
    if (message.TypeString === "ClientRequestPlayerIDMessage" && typeof message.UID === "string") {
      client.uid = message.UID;
      const existing = this.players.get(message.UID);
      const created = existing ?? {
        playerId: this.nextPlayerId++,
        slotId: this.players.size,
        profile: null,
      };
      if (!existing) this.players.set(message.UID, created);
      client.playerId = created.playerId;
      client.slotId = created.slotId;
      client.profile = created.profile;
      this.sendMessage(client.address, {
        TypeString: "AssignPlayerIDAndSlotMessage",
        PlayerID: created.playerId,
        SlotID: created.slotId,
        UDPPortOffset: 0,
        DisplayName: created.profile?.name ?? `Player ${created.playerId}`,
        PSNID: "",
      });
      if (created.profile) {
        this.sendMessage(client.address, {
          TypeString: "RejoiningClientOwnProfileMessage",
          Name: created.profile.name,
          PortraitGUID: created.profile.portraitGuid,
          Colour: { r: 255, g: 255, b: 255, a: 255 },
          AvatarID: created.profile.avatarId,
        });
      } else {
        this.sendMessage(client.address, {
          TypeString: "ResourceRequirementsMessage",
          Requirements: [],
        });
        this.sendMessage(client.address, {
          TypeString: "ClientQuizCommandMessage",
          action: 31,
          time: 0,
        });
        for (const avatarId of ["COWGIRL", "MAGICIAN"]) {
          this.sendMessage(client.address, {
            TypeString: "KnowledgeIsPower.ServerAvatarStatusMessage",
            AvatarID: avatarId,
            Available: true,
          });
        }
      }
      return;
    }
    if (message.TypeString === "ClientPlayerProfileMessage") {
      const stored = client.uid ? this.players.get(client.uid) : undefined;
      const profile = {
        name: String(message.playerName ?? ""),
        avatarId: String(message.playerCardId ?? ""),
        portraitGuid: stored?.profile?.portraitGuid ?? "",
      };
      client.profile = profile;
      if (stored) stored.profile = profile;
    }
    if (message.TypeString === "ClientImageResourceContentTransferMessage" && typeof message.ImageGUID === "string") {
      const stored = client.uid ? this.players.get(client.uid) : undefined;
      if (client.profile) client.profile.portraitGuid = message.ImageGUID;
      if (stored?.profile) stored.profile.portraitGuid = message.ImageGUID;
      else if (stored && client.profile) stored.profile = client.profile;
    }
  }

  private clientRecord(address: string): ClientRecord {
    const existing = this.clients.get(address);
    if (existing) return existing;
    const created: ClientRecord = {
      address,
      probes: 0,
      playerId: null,
      slotId: null,
      uid: null,
      messages: [],
      jpegs: [],
      acks: [],
      decoder: new ProtocolDecoder(),
      encoder: new ProtocolEncoder(),
      greeted: false,
      profile: null,
    };
    this.clients.set(address, created);
    return created;
  }

  private reply(address: string, packet: Buffer): void {
    this.socket.send(packet, 9060, address);
  }
}

function normalizeAddress(address: string): string {
  return address.startsWith("::ffff:") ? address.slice("::ffff:".length) : address;
}
