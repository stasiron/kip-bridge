# What has been verified

The bridge was not pointed at a PlayStation. The three columns below are the whole of the evidence.

## Fixtures

`bridge/src/protocol/codec.test.ts` reads `UdpPacketFixtures.kt` from the read-only Reverse of Power snapshot. It does not copy the file.

Checked against those bytes:

- `ClientRequestPlayerIDMessage` and empty `AllResourcesReceivedMessage` JSON, including field order.
- `ClientQuizCommandMessage` action 31 encodes `"time":0.0`.
- `singlePacket6`, `singlePacket9`, `multiPacket10` (avatar status plus `DeviceInfoMessage`), `singlePacket18`, `singlePacket21`, `singlePacket22`, `multiPacket27`.
- The two-part multipart fixture, in order and reversed, including the eight avatar statuses and the quiz action.
- `chunkedDatagram1` and `chunkedDatagram2` reassemble to JPEG bytes starting `FF D8`.
- `singlePacket3` decodes as a device UID.
- A missing fragment index is an error, not a partial message.

`tshark` replay of the gitignored `.pcapng` files was not run.

## Simulator

`ConsoleSimulator` is a UDP peer. It uses the same codec, answers the sender's address on port 9060, and does not invent a second player on one address. `bridge/src/playlink/session.test.ts` drives the bridge through the WebSocket.

Checked there:

- Handshake through player assignment, device info, and an empty resource acknowledgement.
- A wrong join code does not bind UDP 9060, and the code is absent from `/api/status`.
- A second UID on one address returns `endpoint_exhausted`. The first player stays assigned.
- `127.0.0.1` and `127.0.0.2` each get a player id. A console message to one address is not delivered to the other. A category choice from one browser is not written from the other address.
- Trivia JSON, including the Kotlin default paint and ice fields.
- A chosen power play is not followed by an automatic slot of `-1`. A later phase with no choice does send `-1`.
- Trivia `QuestionDuration` sends index `-1` when the browser is silent.
- A missing resource GUID produces `RequestResourceMessage`. `FactCount` is 63.
- A console JPEG is delivered to the browser, and a browser portrait is delivered to the console after an avatar request.
- A withheld ACK becomes `ack_timeout` once. The command is not written again. The session stays up.
- A NACK is reported and the session stays up.
- Three dropped probe datagrams are followed by a later probe that completes the handshake.
- A silent console becomes `connect_timeout` and releases 9060.
- Closing the browser socket and joining again with the same UID returns a snapshot and does not send a second `ClientRequestPlayerIDMessage`.
- After `bridge.disconnect`, a new handshake with the same UID receives `RejoiningClientOwnProfileMessage` and the same player id.
- Discovery search bytes match `DdpDiscovery.kt`. A unicast responder is reported with game port 9066, not `host-request-port`.
- Public IP addresses are rejected by the local-network check.

This shows the bridge isolates two endpoints. It does not show that a PlayStation accepts two secondary addresses on one computer.

## Full automated gate

From `companion/`: `npm run verify` (typecheck, lint/tsc, unit+protocol, production build, Playwright Chromium+WebKit, bridge smoke). Details: `docs/verification-report.md`. Real console checklist: `docs/real-device-test.md`.

## Browser controller (Playwright)

`npm run test:e2e` (or `npm run verify`) builds `web/out`, starts the bridge with `ConsoleSimulator`, and drives the real page over Chromium and WebKit.

Checked there:

- `/api/status` reports `gameplay` and `controllerUi` true; join code absent from JSON.
- Join with the printed code, player name, avatar selection, lobby start.
- Holding, continue, category choice, trivia answer, power-play choice, linking, sorting, end-of-game fact screens from simulator events.
- Reload + rejoin with the same `localStorage` UID restores `lastScreen` via `bridge.snapshot`.
- Bad join code surfaces a useful error.
- Portrait / landscape mobile viewports keep primary controls visible.

## Still requires a PlayStation

- Numeric device info with the bridge's model and OS strings.
- Whether Decades play needs the time-sync messages the Android client does not send.
- A non-zero `UDPPortOffset`.
- Holding-screen type 8.
- The meaning of the 8-byte datagram and of a NACK tail (one capture has `0x02`).
- `FactCount` 63 against a console that might expect another value.
- Quiz actions 15, 29, and 30.
- Mid-game reconnect around power play, which the Android client already describes as stuck.
- Two real secondary IPv4 addresses on one host, captured at the console.
- Safari on a physical iPhone, including screen lock during a question, and Wi-Fi client isolation.
