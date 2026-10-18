# Browser API

The bridge listens on `0.0.0.0:8787`. The page and the socket share that origin.

- Page: `http://<lan-ip>:8787/`
- Status: `GET /api/status`
- Socket: `ws://<same-host>:8787/session`

There is no CORS header. A public page is not a client. HTTP and the WebSocket both refuse a remote address that is not loopback, RFC1918, or link-local.

`GET /api/status` reports `gameplay: true` and `controllerUi: true` for the controller export. `protocol` is true. `playlink.bound` is true only while a session holds UDP 9060. The join code is printed at startup and is absent from this JSON.

`GET /host` is the PC screen. It answers only when the request arrives on loopback. The HTML contains the join code and an SVG QR of each LAN URL (`http://<lan-ipv4>:8787/`). The QR does not contain the join code. Any other address gets 404. The page polls `/api/status` and that poll still omits the code. If no LAN address exists, the page says to type the PC address by hand and does not change Windows adapters.

## Join

Startup prints an 8-character code. Each browser sends it with a 32-hex device UID and the console IPv4 address.

```json
{ "type": "bridge.join", "code": "AB12CD34", "uid": "00112233445566778899aabbccddeeff", "consoleHost": "192.168.1.20", "consolePort": 9066 }
```

`consolePort` defaults to 9066. Use another port only for the protocol simulator.

The bridge gives the session one local IPv4 address and binds UDP 9060 on that address. A second UID is refused with `endpoint_exhausted` when every address is in use. That refusal is the multiple-player result: two browsers cannot share one IP and port 9060. Add a host address per extra browser, then start the bridge again so the pool includes it.

The same UID and console, on a new socket, receive `bridge.snapshot` and keep the UDP session. `bridge.disconnect` closes it.

## Client frames

| `type` | Fields | When |
| --- | --- | --- |
| `bridge.join` | `code`, `uid`, `consoleHost`, `consolePort?` | Before any command |
| `bridge.discover` | none | Any time. Awake consoles only. `gamePort` is 9066 |
| `bridge.command` | `message` | After the console has acknowledged the session |
| `bridge.portrait` | `playerName`, `imageBase64`, `imageGuid?` | After `ClientRequestAvatarMessage` with `Request: true` |
| `bridge.requestImage` | `guid` | Reads an image the console already sent |
| `bridge.disconnect` | none | Closes the UDP session |

`bridge.command` accepts client `TypeString` values from `messages.ts`, including `ClientToServerTimeSync`. The bridge does not invent a time-sync schedule. Server `TypeString` values are rejected with `server_message` and are not written to UDP. Unknown names are `unknown_type` and are not written to UDP.

## Bridge frames

| `type` | Meaning |
| --- | --- |
| `bridge.status` | Same body as `/api/status`, sent when the socket opens |
| `bridge.state` | `connection` is `probing`, `handshaking`, `assigned`, or `closed`, plus player id, slot, name, and local address |
| `bridge.snapshot` | Reattach: player, avatars, image ids and lengths, last screen. JPEG bytes are not included |
| `bridge.consoles` | Discovery results |
| `bridge.event` | One decoded console message |
| `bridge.sent` | `{ messageId, message }` after a datagram is queued |
| `bridge.ack` | The console acknowledged `messageId` |
| `bridge.image` | `{ guid, imageBase64 }` |
| `bridge.notice` | `unknown_datagram`, `unknown_type`, `unparsed_message` |
| `bridge.error` | `{ code, detail }` |
| `bridge.rejected` | `{ reason: "not_joined" }` when a command arrives before join |

## Errors

| `code` | Meaning |
| --- | --- |
| `bad_join_code` | Code does not match the process. UDP stays closed |
| `bad_uid` | UID is not 32 hex characters |
| `bad_console_address` | Host is not a private IPv4 address, or the port is out of range |
| `not_private_network` | The TCP peer is not on the local network |
| `no_lan_address` | The process has no private non-loopback IPv4 address. CGNAT addresses such as 100.64.0.0/10 are not used. Tests pass addresses explicitly |
| `endpoint_exhausted` | Every pooled address already has a session |
| `udp_bind_failed` | 9060 is taken on that address. The pool slot is released |
| `connect_timeout` | No connection ack. The session closes and the address is released |
| `not_connected` | A command arrived before the console's connection ack |
| `ack_timeout` | A sent datagram was not acknowledged. It is not sent again. The session stays up |
| `nack` | The console's 38-byte reply had a non-zero tail. The datagram is not sent again |
| `decode_error` | A datagram could not be parsed, including a fragment index gap |
| `unknown_type` | The browser named a type outside the catalog |
| `server_message` | The browser tried to send a console-originated type |
| `encode_error` | The JSON does not match the schema |
| `bad_json` | The WebSocket text is not the expected object |
| `avatar_required` | Portrait sent before an avatar request |
| `not_jpeg` | Portrait bytes do not start with `FF D8` |
| `image_too_large` | Portrait above 400000 bytes |
| `unknown_image` | `bridge.requestImage` named a GUID the session does not have |
| `discover_failed` | The discovery socket failed |
| `session_conflict` | This UID is already on a different console |
| `already_joined` | This socket already joined |

`bridge.notice` codes: `unknown_datagram` (including the 8-byte datagram before the connection ack), `unknown_type` for a console type outside the catalog, `unparsed_message`, `device_uid`.

## What the session sends by itself

After `SessionStateMessage`: `ClientRequestPlayerIDMessage`.

After `AssignPlayerIDAndSlotMessage`: `DeviceInfoMessage` (`Response` 10, `DeviceSize` 2, `DeviceOS` 1, `DeviceType` `Handheld`, model `KIP Browser Bridge`) and `ClientRequestAvatarStatusMessage`.

After `ResourceRequirementsMessage`: `RequestResourceMessage` for each missing GUID, or `AllResourcesReceivedMessage` when none are missing.

After a completed image: `AllResourcesReceivedMessage` for that GUID with `Rqrmnt` 0.

After `ServerRequestEndOfGameFactCount`: `ClientEndOfGameFactCount` with `FactCount` 63.

After `ServerBeginTriviaAnsweringPhase`, if the browser does not answer within `QuestionDuration`: `ClientTriviaAnswer` with index `-1` and `AnswerTime` equal to that duration.

After `ServerRequestPowerPlayChoice`, if the browser has not chosen since `ServerBeginPowerPlayPhase`: `ClientPowerPlayChoice` with slot `-1` and an empty `TargetSlotIndex`.

The bridge does not press start, continue, or a category door.
