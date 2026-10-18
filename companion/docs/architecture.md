# Architecture

The iPhone never speaks PlayLink. A computer on the same LAN as the PlayStation runs a Node bridge. Safari loads the controller from that bridge, and the bridge is the only UDP endpoint the console sees for that player.

Reference: [synchrone/reverse-of-power](https://github.com/synchrone/reverse-of-power) commit `e9543047cd73cd93e1cbc59313a91f0f2c0f68cc`. Snapshot: `../_reference/reverse-of-power` (read-only). Record: `../_reference/COMMIT`.

## What is running today

The bridge serves the static page and a same-origin WebSocket at `/session`. Idle, it does not bind UDP. A join with the code printed at startup binds one local IPv4 address to UDP 9060 and opens a PlayLink session to the console on port 9066.

`GET /api/status` reports `gameplay: true` and `controllerUi: true` when the static export draws the controller. `protocol` is true. `playlink.bound` is true only while a session holds 9060. The join code is printed on the console and is not included in the status JSON.

The browser API is `docs/api.md`. What the fixtures, the simulator, and a real console each prove is `docs/verification.md`.

## Layout

```
iPhone Safari  --http + ws, same origin-->  bridge :8787
                                              |
                                              |  one session per local IPv4
                                              UDP send  <address>:ephemeral -> console :9066
                                              UDP listen <address>:9060 <- console

Android Reverse of Power  --its own IPv4:9060-->  console :9066

Vercel  hosts the same static page as instructions.
        It does not open a socket to the LAN or the console.
```

One PlayLink session is one source IPv4 address plus a socket bound to port 9060 on that address. The bridge’s HTTP port (8787) is unrelated to 9060.

## Why the page and the socket share an origin

Safari will not give a page raw UDP, WebTransport to port 9066, or a WebRTC peer that is a PlayStation. The browser can open a WebSocket, or plain HTTP, to the origin that served the page.

A Vercel HTTPS page cannot be that origin:

- `https://` to `ws://192.168.x.x` is mixed content. Safari blocks it.
- WebKit does not treat a LAN address as a safe exception to that rule. Localhost exceptions do not help, because the iPhone’s localhost is the phone.
- iOS 26 still reports WebSocket failures against certificates the user has merely tapped through. A self-signed `wss://` bridge would ask the phone to trust a certificate. That is an install, which this design refuses.
- A public tunnel would put a party-game socket on the internet. It is not required.

The bridge therefore serves `web/out` itself. The phone opens `http://<lan-ip>:8787/`. The WebSocket is `ws://<same host>:8787/session`. No certificate, no App Store app, no profile.

Vercel may host the same export as the landing page. On that host `/api/status` is absent, and the page says so. It must not be given a hardcoded LAN address.

There is no database, account service, or paid component. `ws` is the MIT WebSocket library used by the bridge. Session state, when gameplay exists, stays in the bridge process. The player id string lives in the phone’s `localStorage` and is sent to the bridge so a reconnect can reuse the device UID.

## Why one IP and port 9060 cannot hold two players

`GameProtocolClient.startListening` sends from a socket bound to port 0 and receives only on port 9060. `PcapReplay` classifies a datagram as server-to-client when its destination port is 9060. The console does not reply to the source port of the client’s send socket. It writes to the client’s IPv4 address, port 9060.

The 22-byte header (`ProtocolEncoder.buildPacket`) is magic, message id, fragment count, fragment index, length, and byte offset. It has no player, session, or device field. These server messages also have no player id: `SessionStateMessage`, `ServerRequestCategorySelectChoice`, `ServerRequestPowerPlayChoice`, `ServerRequestEndOfGameFactCount`. Fragment reassembly and the client’s ACK cursor are keyed only by message id (`ProtocolDecoder.handleFragment`, `GameProtocolClient.lastRcvMessageId`).

The device UID is how the console picks a player record after the datagram has already been delivered to that IP. It is not a demultiplexing key inside the header. Every captured `AssignPlayerIDAndSlotMessage` has `UDPPortOffset=0`, and the Android client never rebinds using that field.

Two Android phones work because each has its own LAN address, so each has its own `:9060`. A bridge with one address and one 9060 socket is one phone, as far as the console’s reply path is concerned. Sharing it across browsers collides ACK state, fragment buffers, and untagged prompts.

Several iPhones on one computer require one extra IPv4 address per player, each with its own 9060 socket and its own protocol state. That is host configuration (`netsh interface ipv4 add address` or equivalent), not software on the phone. It is the same shape as two physical phones. It is not proven by a capture yet. Do not implement “second UID on the same socket” unless a capture shows a non-zero `UDPPortOffset` and datagrams arriving on `9060 + offset`.

One iPhone through the bridge plus Android phones on their own addresses is the arrangement the protocol already supports.

## Browser session versus console session

iOS suspends a Safari tab when the screen locks or the user leaves Safari. Timers stop and the WebSocket drops. The console still expects a client ACK about once a second (`GameProtocolClient.connect` sleep of 1000 ms).

The bridge, not the page, owns that ACK loop and the UDP sockets. When the WebSocket returns with the same UID and join code, the bridge sends a `bridge.snapshot` and keeps the UDP session. If a trivia timer expires while the phone is suspended, the bridge sends `ClientTriviaAnswer` with `ChosenAnswerDisplayIndex = -1`, which is what `TriviaAnsweringFragment` does on its `CountDownTimer`. If the page has not chosen a power play when `ServerRequestPowerPlayChoice` arrives, the bridge sends slot `-1` and an empty target list.

`navigator.wakeLock` and `getUserMedia` need a secure context. `http://192.168.x.x` is not one. The portrait path for a future page is an `<input type="file" accept="image/*" capture="user">`, then a canvas JPEG. The bridge accepts that JPEG on `bridge.portrait` after an avatar has been requested. Wake Lock is not part of the design.

If a WebSocket cannot be opened, the fallback on the same origin would be a `POST` for commands and a long-lived `GET` for events. That fallback is not implemented. WebRTC and WebTransport are not used.

## CORS

The bridge does not send `Access-Control-Allow-Origin`. A public page is not a client of the LAN server.

## Module boundaries

| Module | Responsibility |
| --- | --- |
| `bridge/src/protocol/messages.ts` | Field names and `TypeString` values from `GameMessages.kt`. |
| `bridge/src/protocol/catalog.ts` | Which side sends each message, and the upstream source. |
| `bridge/src/protocol/schema.ts` | JSON field order and double formatting. |
| `bridge/src/protocol/codec.ts` | Encode, decode, fragmentation, ACK, NACK, UID, JPEG. |
| `bridge/src/playlink/session.ts` | One session: one local address, one UID, one message counter, one fragment map, one ACK cursor. |
| `bridge/src/playlink/simulator.ts` | Deterministic UDP console used by tests. |
| `bridge/src/server.ts` | HTTP, WebSocket, join code, endpoint pool. |
| `web/` | Mobile controller and Vercel landing. Commands go through the bridge WebSocket API. |

`sendMessage` in the Kotlin client is outside `sendLock`, while ACK, UID, and image sends are inside it. The bridge should hold one mutex for every datagram of a session.

## Explicit non-goals

- No modification of `../_reference/reverse-of-power`.
- No Sony or Wish Studios image, mask, font, or sound assets.
- No claim that the public Vercel landing page can play. Open the bridge LAN URL instead.
