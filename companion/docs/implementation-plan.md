# Implementation plan

Phase A (codec), phase B (one UDP session, browser API, simulator), and phase C (controller screens) are in `companion/`. UDP 9060 opens only after a join, and only on an address from the endpoint pool.

## Phase A — codec

`bridge/src/protocol/codec.ts` and `schema.ts` follow `ProtocolEncoder`, `ProtocolDecoder`, and kotlinx field order.

Rules that stay in force:

- Little-endian layout from `docs/protocol.md`. No extra header fields.
- JSON field order and defaulted fields match kotlinx `encodeDefaults` for the messages the client sends. Doubles are written with a decimal point (`0.0`).
- Unknown `TypeString` values are surfaced. They are not added to `messages.ts`.
- Decades and classic magics stay selectable from `InterfaceVersionMessage`.
- Fixture bytes are read from `UdpPacketFixtures.kt` in the reference tree. The file is not copied.

`tshark` replay of a local `.pcapng` is still optional. Absence of a pcap is not a failure and not a reason to commit one.

## Phase B — one session

`PlayLinkSession` binds a send socket to port 0 and a receive socket to port 9060, both on one local IPv4.

- UID: 32 hex characters, supplied by the browser.
- Probe loop: connection request plus both UID magics until the first server data message, then an ACK of the last server message id. Data and image datagrams are also ACKed when they arrive.
- Connection probes are repeated. Gameplay JSON is not. A missing ACK becomes `ack_timeout`. A NACK becomes `nack`. Replaying a trivia answer would submit it twice, and the Kotlin client has no replay buffer.
- Auto replies from `GameProtocolClient`, including `FactCount=63`.
- Image matcher by transfer id. Portrait order: control and JPEG at transfer 2, profile, control and JPEG at transfer 3, `ImgType=2`.
- One write chain for every datagram of a session.
- WebSocket envelopes use a `type` that is not a PlayLink `TypeString`. See `docs/api.md`.
- On WebSocket drop, UDP stays up until the detach grace expires. A new socket with the same UID receives `bridge.snapshot`.
- On trivia `QuestionDuration` with no answer, send index `-1`.
- On `ServerRequestPowerPlayChoice` with no choice yet, send slot `-1` and an empty target list.

Discovery follows `DdpDiscovery.kt`. `host-request-port` is not the game port. The game port stays 9066 unless the join names another port for the simulator.

Device info keeps `Response=10`, `DeviceSize=2`, `DeviceOS=1`, `DeviceType="Handheld"`. The model and OS strings name the bridge. A console has not confirmed that it accepts those strings.

## Phase C — screens

Implemented in `web/app/`. Screens follow the Android navigation graph and are driven only from bridge events / snapshots. Playwright covers join, setup, lobby, holding, continue, category, trivia, power play, linking, sorting, end-of-game, reconnect, and mobile viewports against the simulator.

Portrait on the page: file input, canvas JPEG, no `getUserMedia`, no overlay masks.

## Phase D — a second iPhone on a console

The bridge already refuses a second player on the same address and isolates two loopback addresses in the simulator. Shipping that as console multiplayer still needs a capture:

1. Record a second UID from the same address. If `UDPPortOffset` stays 0 and replies stay on 9060, that confirms the shared-socket blocker.
2. Add a second address on the host, bind a second session to `thatAddress:9060`, and capture both flows against a PlayStation.

## Out of scope until a capture requires it

- Retransmission of gameplay datagrams after NACK or `ack_timeout`.
- A scheduled Decades time-sync loop. The message can be sent if a client asks.
- Acting on quiz actions 15, 29, and 30.
- Naming holding-screen type 8.
- Treating the 8-byte pre-ack datagram as a handshake failure.
- Any asset downloaded from Sony or Wish Studios.

## How to verify

From `companion/`, with Node.js 22 or newer:

```
npm install
npm test
npm start
```

`npm test` runs the bridge suite in one process so UDP 9060 is not bound twice. `npm run check` also typechecks and builds the static page.

`npm start` listens on port 8787, prints a join code, and prints LAN URLs. The controller joins with that code. UDP 9060 stays unbound until a client joins. The join code must not appear in `GET /api/status`. A Vercel-hosted copy of the same export is a launcher only.

Hardware still required before calling a controller done:

- One iPhone, classic game, through name, photo, avatar, waiting room, one trivia question, one power play.
- One Android Reverse of Power phone on the same console.
- Lock the iPhone during a question. The console must still receive the timeout answer.
- Return to the tab and confirm the WebSocket restored without a second player slot.
