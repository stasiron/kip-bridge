import assert from "node:assert/strict";
import test from "node:test";
import { ProtocolDecoder, ProtocolEncoder, messageIdOf } from "./codec.ts";
import { loadUdpPacketFixtures } from "./fixtures.ts";
import { encodeMessageJson } from "./schema.ts";
import { MESSAGE_CATALOG } from "./catalog.ts";
import { MESSAGE_FIELDS } from "./schema.ts";

const fixtures = loadUdpPacketFixtures();

function packet(name: string): Buffer {
  const value = fixtures.packets.get(name);
  assert.ok(value, `missing fixture ${name}`);
  return value;
}

function jsonText(bytes: Buffer): string {
  const start = bytes.indexOf(Buffer.from("{"));
  assert.ok(start >= 0);
  return bytes.subarray(start, bytes.lastIndexOf(Buffer.from("}")) + 1).toString("utf8");
}

test("fixture JSON matches the Kotlin field order", () => {
  assert.equal(
    encodeMessageJson({
      TypeString: "ClientRequestPlayerIDMessage",
      UID: "b2f3f8eb0cf4ef4b2359871d35495225",
    }),
    jsonText(packet("singlePacket6")),
  );
  assert.equal(
    encodeMessageJson({ TypeString: "AllResourcesReceivedMessage", Requirements: [] }),
    jsonText(packet("singlePacket9")),
  );
  assert.equal(
    encodeMessageJson({ TypeString: "ClientQuizCommandMessage", action: 31, time: 0 }),
    '{"TypeString":"ClientQuizCommandMessage","action":31,"time":0.0}',
  );
});

test("upstream fixtures decode to the captured messages", () => {
  const decoder = new ProtocolDecoder();
  const player = decoder.decode(packet("singlePacket6"));
  assert.equal(player.kind, "data");
  if (player.kind === "data") {
    assert.equal(player.messages[0]?.TypeString, "ClientRequestPlayerIDMessage");
    assert.equal(player.messages[0]?.UID, "b2f3f8eb0cf4ef4b2359871d35495225");
    assert.deepEqual(player.unparsed, []);
  }

  const resources = decoder.decode(packet("singlePacket9"));
  assert.equal(resources.kind, "data");
  if (resources.kind === "data") assert.deepEqual(resources.messages[0]?.Requirements, []);

  const multi = decoder.decode(packet("multiPacket10"));
  assert.equal(multi.kind, "data");
  if (multi.kind === "data") {
    assert.deepEqual(
      multi.messages.map((message) => message.TypeString),
      ["KnowledgeIsPower.ClientRequestAvatarStatusMessage", "DeviceInfoMessage"],
    );
    assert.equal(multi.messages[1]?.DeviceModel, "Genymobile Pixel 9");
  }

  for (const name of ["singlePacket18", "singlePacket21", "singlePacket22", "multiPacket27"]) {
    const decoded = decoder.decode(packet(name));
    assert.notEqual(decoded.kind, "error", name);
    assert.notEqual(decoded.kind, "unknown", name);
  }
});

test("fragmented fixtures reassemble in order and out of order", () => {
  const ordered = new ProtocolDecoder();
  const chunks = fixtures.lists.get("chunkedMutlipacket") ?? [
    packet("chunkedMutlipacket_chunk1"),
    packet("chunkedMutlipacket_chunk2"),
  ];
  assert.equal(chunks.length, 2);
  const first = ordered.decode(chunks[0]!);
  assert.equal(first.kind, "fragment");
  const done = ordered.decode(chunks[1]!);
  assert.equal(done.kind, "data");
  if (done.kind === "data") {
    assert.equal(done.messages[0]?.TypeString, "ResourceRequirementsMessage");
    assert.equal(done.messages[1]?.action, 31);
    assert.ok(done.messages.some((message) => message.AvatarID === "COWGIRL"));
    assert.equal(done.unparsed.length, 0);
  }

  const reversed = new ProtocolDecoder();
  assert.equal(reversed.decode(chunks[1]!).kind, "fragment");
  const recovered = reversed.decode(chunks[0]!);
  assert.equal(recovered.kind, "data");
  if (recovered.kind === "data") assert.equal(recovered.messages.length, done.kind === "data" ? done.messages.length : 0);

  for (const listName of ["chunkedDatagram1", "chunkedDatagram2"]) {
    const list = fixtures.lists.get(listName);
    assert.ok(list && list.length > 1, listName);
    const imageDecoder = new ProtocolDecoder();
    let result = imageDecoder.decode(list[0]!);
    for (let index = 1; index < list.length - 1; index += 1) {
      result = imageDecoder.decode(list[index]!);
      assert.equal(result.kind, "fragment");
    }
    result = imageDecoder.decode(list[list.length - 1]!);
    assert.equal(result.kind, "image", listName);
    if (result.kind === "image") {
      assert.equal(result.jpeg[0], 0xff);
      assert.equal(result.jpeg[1], 0xd8);
    }
  }
});

test("round-trip preserves client commands and fragments above 1002 bytes", () => {
  const encoder = new ProtocolEncoder();
  const decoder = new ProtocolDecoder();
  const trivia = {
    TypeString: "KnowledgeIsPower.ClientTriviaAnswer",
    ChosenAnswerDisplayIndex: -1,
    AnswerTime: 15,
    NumWrongAnswers: 0,
  };
  const encoded = encoder.encodeMessage(trivia);
  assert.equal(encoded.packets.length, 1);
  assert.equal(messageIdOf(encoded.packets[0]!), 1);
  const decoded = decoder.decode(encoded.packets[0]!);
  assert.equal(decoded.kind, "data");
  if (decoded.kind === "data") {
    assert.equal(decoded.messages[0]?.ChosenAnswerDisplayIndex, -1);
    assert.equal(decoded.messages[0]?.AnswerTime, 15);
    assert.equal(decoded.messages[0]?.PaintCleared, false);
  }

  const jpeg = Buffer.alloc(2500, 0);
  jpeg[0] = 0xff;
  jpeg[1] = 0xd8;
  jpeg[2] = 0xff;
  jpeg[3] = 0xe0;
  const image = encoder.encodeImage(jpeg, 2);
  assert.ok(image.packets.length > 1);
  const imageDecoder = new ProtocolDecoder();
  const reversed = [...image.packets].reverse();
  let last = imageDecoder.decode(reversed[0]!);
  for (const part of reversed.slice(1)) last = imageDecoder.decode(part);
  assert.equal(last.kind, "image");
  if (last.kind === "image") {
    assert.equal(last.transferId, 2);
    assert.equal(last.jpeg.length, jpeg.length);
  }
});

test("ACK, NACK, connection init, and device UID keep their wire sizes", () => {
  const encoder = new ProtocolEncoder();
  const decoder = new ProtocolDecoder();
  assert.equal(encoder.encodeConnectionRequest().length, 38);
  assert.equal(decoder.decode(encoder.encodeConnectionRequest()).kind, "connectionInit");
  assert.equal(decoder.decode(encoder.encodeAck(0x0c)).kind, "ack");
  const nack = decoder.decode(encoder.encodeNack(0x55, 0x02));
  assert.equal(nack.kind, "nack");
  if (nack.kind === "nack") assert.equal(nack.payload[0], 0x02);
  const uid = decoder.decode(encoder.encodeDeviceUid("b2f3f8eb0cf4ef4b2359871d35495225", false));
  assert.equal(uid.kind, "deviceUid");
  if (uid.kind === "deviceUid") assert.equal(uid.uid, "b2f3f8eb0cf4ef4b2359871d35495225");
  const capturedUid = decoder.decode(packet("singlePacket3"));
  assert.equal(capturedUid.kind, "deviceUid");
});

test("every catalog type has an encoder schema and unknown fields are rejected", () => {
  for (const entry of MESSAGE_CATALOG) assert.ok(MESSAGE_FIELDS[entry.typeString], entry.typeString);
  assert.throws(() => encodeMessageJson({ TypeString: "NotAMessage" }));
  assert.throws(() =>
    encodeMessageJson({
      TypeString: "ClientRequestPlayerIDMessage",
      UID: "b2f3f8eb0cf4ef4b2359871d35495225",
      Extra: 1,
    }),
  );
});

test("a fragment index gap is reported instead of a partial message", () => {
  const encoder = new ProtocolEncoder();
  const jpeg = Buffer.alloc(2200, 7);
  jpeg[0] = 0xff;
  jpeg[1] = 0xd8;
  const encoded = encoder.encodeImage(jpeg, 9);
  assert.ok(encoded.packets.length > 1);
  const first = Buffer.from(encoded.packets[0]!);
  const skipped = Buffer.from(encoded.packets[0]!);
  first.writeInt32LE(2, 6);
  skipped.writeInt32LE(2, 6);
  skipped.writeInt32LE(2, 10);
  const decoder = new ProtocolDecoder();
  assert.equal(decoder.decode(first).kind, "fragment");
  const gap = decoder.decode(skipped);
  assert.equal(gap.kind, "error");
});

test("Decades magics are selected after the version prefix", () => {
  const encoder = new ProtocolEncoder();
  encoder.decades = true;
  const packetBytes = encoder.encodeMessage({ TypeString: "ClientRequestPlayerIDMessage", UID: "aa" }).packets[0]!;
  assert.equal(packetBytes[0], 0xc1);
  assert.equal(packetBytes[1], 0x48);
  assert.equal(packetBytes[22], 0xa3);
  assert.equal(packetBytes[23], 0xd3);
  const decoded = new ProtocolDecoder().decode(packetBytes);
  assert.equal(decoded.kind, "data");
});
