import {
  FOOTER_MULTIJSON,
  HEADER_BYTES,
  JPEG_TYPE_MARKER,
  JSON_TYPE_MARKER,
  MAGIC_ACK,
  MAGIC_BODY_DECADES,
  MAGIC_BODY_KIP,
  MAGIC_DATA_DECADES,
  MAGIC_DATA_KIP,
  MAGIC_UID_DECADES,
  MAGIC_UID_KIP,
  MAX_PAYLOAD_BYTES,
  MULTIJSON_TYPE_MARKER,
  TYPE_JSON,
  TYPE_MULTIJSON,
} from "../config.ts";
import { encodeMessageJson, withClientDefaults } from "./schema.ts";

export interface WireMessage {
  TypeString: string;
  [key: string]: unknown;
}

export type DecodedPacket =
  | { kind: "ack"; messageId: number }
  | { kind: "nack"; messageId: number; payload: Buffer }
  | { kind: "connectionInit" }
  | { kind: "deviceUid"; uid: string }
  | { kind: "data"; messageId: number; messages: WireMessage[]; unparsed: unknown[] }
  | { kind: "image"; messageId: number; transferId: number; jpeg: Buffer }
  | { kind: "fragment"; messageId: number; index: number; total: number; size: number }
  | { kind: "unknown"; raw: Buffer }
  | { kind: "tooShort"; raw: Buffer }
  | { kind: "error"; message: string; raw: Buffer };

const MAGIC_UID_KIP_INT = 0x0c89e884;
const MAGIC_UID_DECADES_INT = 0xafe4873d | 0;

function u8(bytes: readonly number[]): Buffer {
  return Buffer.from(bytes);
}

export class ProtocolDecoder {
  private readonly fragments = new Map<number, Map<number, Buffer>>();

  decode(data: Buffer): DecodedPacket {
    if (data.length < 8) return { kind: "tooShort", raw: data };

    if (data.length >= 12) {
      const magic = data.readInt32BE(0);
      if (magic === MAGIC_UID_KIP_INT || magic === MAGIC_UID_DECADES_INT) {
        return this.decodeDeviceUid(data);
      }
    }

    const magic = (data[0]! << 8) | data[1]!;
    if (magic === 0xae7f || magic === 0xc148) {
      try {
        return this.decodeDataPacket(data);
      } catch (error) {
        return { kind: "error", message: error instanceof Error ? error.message : String(error), raw: data };
      }
    }
    if (magic === 0x8a33) {
      const messageId = data.readInt32LE(2);
      if (messageId === -1) return { kind: "connectionInit" };
      const payload = data.subarray(6);
      if (payload.some((byte) => byte !== 0)) return { kind: "nack", messageId, payload: Buffer.from(payload) };
      return { kind: "ack", messageId };
    }
    return { kind: "unknown", raw: data };
  }

  private decodeDeviceUid(data: Buffer): DecodedPacket {
    try {
      const uidLength = data.readInt32LE(8);
      if (uidLength < 0 || 12 + uidLength > data.length) {
        return { kind: "error", message: "DeviceUID length is out of range", raw: data };
      }
      return { kind: "deviceUid", uid: data.subarray(12, 12 + uidLength).toString("utf8") };
    } catch (error) {
      return { kind: "error", message: error instanceof Error ? error.message : String(error), raw: data };
    }
  }

  private decodeDataPacket(data: Buffer): DecodedPacket {
    if (data.length < HEADER_BYTES) return { kind: "error", message: "data packet shorter than 22-byte header", raw: data };
    const messageId = data.readInt32LE(2);
    const packetNum = data.readInt32LE(6);
    const packetIdx = data.readInt32LE(10);
    if (packetNum > 1) {
      return this.handleFragment(messageId, packetIdx, packetNum, Buffer.from(data.subarray(HEADER_BYTES)));
    }
    return this.decodePayload(messageId, Buffer.from(data.subarray(HEADER_BYTES)));
  }

  private handleFragment(messageId: number, packetIdx: number, total: number, fragment: Buffer): DecodedPacket {
    let bucket = this.fragments.get(messageId);
    if (!bucket) {
      bucket = new Map();
      this.fragments.set(messageId, bucket);
    }
    bucket.set(packetIdx, fragment);
    if (bucket.size !== total) {
      return { kind: "fragment", messageId, index: packetIdx, total, size: fragment.length };
    }
    for (let index = 0; index < total; index += 1) {
      if (!bucket.has(index)) {
        this.fragments.delete(messageId);
        return { kind: "error", message: `fragment gap in message ${messageId}`, raw: fragment };
      }
    }
    const complete = Buffer.concat(Array.from({ length: total }, (_, index) => bucket.get(index)!));
    this.fragments.delete(messageId);
    return this.decodePayload(messageId, complete);
  }

  decodePayload(messageId: number, data: Buffer): DecodedPacket {
    if (data.length < 10) return { kind: "error", message: "payload shorter than body header", raw: data };
    let offset = 2;
    let payloadType = data.readInt32LE(offset);
    offset += 4;
    const payloadLength = data.readInt32LE(offset);
    offset += 4;
    let transferId = -1;
    if (payloadType > 0) {
      transferId = payloadType;
      if (offset + 4 > data.length) return { kind: "error", message: "truncated transfer payload", raw: data };
      payloadType = data.readInt32LE(offset);
      offset += 4;
    }

    if (payloadType === JSON_TYPE_MARKER) {
      const parsed = parseJsonPayload(data.subarray(offset));
      return { kind: "data", messageId, messages: parsed.messages, unparsed: parsed.unparsed };
    }
    if (payloadType === MULTIJSON_TYPE_MARKER) {
      return this.decodeMulti(messageId, data, offset, payloadLength);
    }
    if (payloadType === JPEG_TYPE_MARKER) {
      const jpeg = Buffer.from(data.subarray(offset - 4));
      return { kind: "image", messageId, transferId, jpeg };
    }
    return { kind: "error", message: `unknown payload type ${payloadType}`, raw: data };
  }

  /**
   * Copied from `ProtocolDecoder.decodePayload`: `processed` starts at 15 and
   * stops two bytes before `payloadLength`, which is the multi-JSON footer.
   */
  private decodeMulti(messageId: number, data: Buffer, offset: number, payloadLength: number): DecodedPacket {
    const messages: WireMessage[] = [];
    const unparsed: unknown[] = [];
    let processed = 15;
    let cursor = offset;
    while (processed < payloadLength - 2) {
      if (cursor + 8 > data.length) {
        return { kind: "error", message: "truncated multi-json entry", raw: data };
      }
      const docLength = data.readInt32LE(cursor);
      const docType = data.readInt32LE(cursor + 4);
      cursor += 8;
      if (docLength < 0 || cursor + docLength > data.length) {
        return { kind: "error", message: "multi-json document length is out of range", raw: data };
      }
      if (docType === JSON_TYPE_MARKER) {
        const parsed = parseJsonPayload(data.subarray(cursor, cursor + docLength));
        messages.push(...parsed.messages);
        unparsed.push(...parsed.unparsed);
      } else {
        unparsed.push({ skippedDocumentType: docType, length: docLength });
      }
      processed += docLength + 8;
      cursor += docLength;
    }
    return { kind: "data", messageId, messages, unparsed };
  }
}

function parseJsonPayload(data: Buffer): { messages: WireMessage[]; unparsed: unknown[] } {
  const text = data.toString("utf8").replace(/\0+$/, "");
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return { messages: [], unparsed: [value] };
    const record = value as Record<string, unknown>;
    const typeString = record.TypeString;
    if (typeof typeString !== "string") return { messages: [], unparsed: [record] };
    return { messages: [record as WireMessage], unparsed: [] };
  } catch (error) {
    return { messages: [], unparsed: [{ error: error instanceof Error ? error.message : String(error), text }] };
  }
}

export class ProtocolEncoder {
  decades = false;
  messageCounter = 0;

  encodeConnectionRequest(): Buffer {
    const data = Buffer.alloc(38);
    u8(MAGIC_ACK).copy(data, 0);
    data.writeInt32LE(-1, 2);
    return data;
  }

  encodeAck(messageId: number): Buffer {
    const data = Buffer.alloc(38);
    u8(MAGIC_ACK).copy(data, 0);
    data.writeInt32LE(messageId, 2);
    return data;
  }

  /** Documented NACK: same 38-byte header as an ACK with a non-zero tail. */
  encodeNack(messageId: number, marker = 0x01): Buffer {
    const data = this.encodeAck(messageId);
    data[6] = marker;
    return data;
  }

  encodeDeviceUid(uid: string, decades: boolean, flag = 0x63): Buffer {
    const uidBytes = Buffer.from(uid, "utf8");
    const magic = decades ? MAGIC_UID_DECADES : MAGIC_UID_KIP;
    const data = Buffer.alloc(magic.length + 1 + 4 + uidBytes.length);
    u8(magic).copy(data, 0);
    data[magic.length] = flag;
    data.writeInt32LE(uidBytes.length, magic.length + 1);
    uidBytes.copy(data, magic.length + 5);
    return data;
  }

  encodeMessage(message: Record<string, unknown>): { messageId: number; packets: Buffer[] } {
    const json = Buffer.from(encodeMessageJson(withClientDefaults(message)), "utf8");
    return this.frame(this.jsonBody(json));
  }

  /** Frame JSON that already exists, including a console type this client does not send. */
  encodeJsonText(json: string): { messageId: number; packets: Buffer[] } {
    return this.frame(this.jsonBody(Buffer.from(json, "utf8")));
  }

  encodeMulti(messages: Record<string, unknown>[], transferId: number): { messageId: number; packets: Buffer[] } {
    if (transferId <= 0) throw new Error("multi-json transfer id must be positive");
    const jsonParts = messages.map((message) => Buffer.from(encodeMessageJson(withClientDefaults(message)), "utf8"));
    const entriesSize = jsonParts.reduce((sum, part) => sum + 8 + part.length, 0);
    const bodyLength = entriesSize + 6;
    const body = Buffer.alloc(10 + bodyLength);
    this.writeBodyMagic(body);
    body.writeInt32LE(transferId, 2);
    body.writeInt32LE(bodyLength, 6);
    u8(TYPE_MULTIJSON).copy(body, 10);
    let cursor = 14;
    for (const json of jsonParts) {
      body.writeInt32LE(json.length, cursor);
      u8(TYPE_JSON).copy(body, cursor + 4);
      json.copy(body, cursor + 8);
      cursor += 8 + json.length;
    }
    u8(FOOTER_MULTIJSON).copy(body, cursor);
    return this.frame(body);
  }

  encodeImage(jpeg: Buffer, transferId: number): { messageId: number; packets: Buffer[] } {
    if (transferId <= 0) throw new Error("image transfer id must be positive");
    const body = Buffer.alloc(10 + jpeg.length);
    this.writeBodyMagic(body);
    body.writeInt32LE(transferId, 2);
    body.writeInt32LE(jpeg.length, 6);
    jpeg.copy(body, 10);
    return this.frame(body);
  }

  encodeImageTransfer(
    jpeg: Buffer,
    imageGuid: string,
    transferId: number,
    imgType = 2,
  ): { control: { messageId: number; packets: Buffer[] }; image: { messageId: number; packets: Buffer[] } } {
    const control = this.encodeMessage({
      TypeString: "ClientImageResourceContentTransferMessage",
      TransferID: transferId,
      ImageGUID: imageGuid,
      ImgType: imgType,
    });
    const image = this.encodeImage(jpeg, transferId);
    return { control, image };
  }

  private frame(payload: Buffer): { messageId: number; packets: Buffer[] } {
    const messageId = ++this.messageCounter;
    const packets: Buffer[] = [];
    const total = Math.max(1, Math.ceil(payload.length / MAX_PAYLOAD_BYTES));
    let byteOffset = 0;
    for (let index = 0; index < total; index += 1) {
      const fragment = payload.subarray(index * MAX_PAYLOAD_BYTES, Math.min(payload.length, (index + 1) * MAX_PAYLOAD_BYTES));
      packets.push(this.buildPacket(fragment, total, index, messageId, byteOffset));
      byteOffset += fragment.length;
    }
    return { messageId, packets };
  }

  private jsonBody(json: Buffer): Buffer {
    const body = Buffer.alloc(10 + json.length);
    this.writeBodyMagic(body);
    u8(TYPE_JSON).copy(body, 2);
    body.writeInt32LE(json.length, 6);
    json.copy(body, 10);
    return body;
  }

  private writeBodyMagic(body: Buffer): void {
    const magic = this.decades ? MAGIC_BODY_DECADES : MAGIC_BODY_KIP;
    body[0] = magic[0]!;
    body[1] = magic[1]!;
  }

  private buildPacket(payload: Buffer, packetNum: number, packetIdx: number, messageId: number, byteOffset: number): Buffer {
    const packet = Buffer.alloc(HEADER_BYTES + payload.length);
    const magic = this.decades ? MAGIC_DATA_DECADES : MAGIC_DATA_KIP;
    packet[0] = magic[0]!;
    packet[1] = magic[1]!;
    packet.writeInt32LE(messageId, 2);
    packet.writeInt32LE(packetNum, 6);
    packet.writeInt32LE(packetIdx, 10);
    packet.writeInt32LE(payload.length, 14);
    packet.writeInt32LE(byteOffset, 18);
    payload.copy(packet, HEADER_BYTES);
    return packet;
  }
}

export function messageIdOf(packet: Buffer): number | null {
  if (packet.length < 6) return null;
  const magic = (packet[0]! << 8) | packet[1]!;
  if (magic !== 0xae7f && magic !== 0xc148) return null;
  return packet.readInt32LE(2);
}
