# Compatibility

## iOS Safari

Checked against WebKit’s mixed-content behavior and the secure-context requirement for `getUserMedia` (Safari since iOS 11, still required on current iOS). The iOS 26 WebSocket report on Apple’s developer forums is the reason a tapped-through certificate is not the plan.

| Capability | On `http://<lan-ip>:8787` served by the bridge | On a Vercel HTTPS page |
| --- | --- | --- |
| WebSocket to the same host | Supported | Cannot reach the bridge. Mixed content blocks `ws://`. `wss://` needs a certificate the phone already trusts |
| Raw UDP to port 9066 | Not available in Safari | Not available |
| WebTransport or WebRTC to the console | Not a transport to an arbitrary UDP port | Same |
| `getUserMedia` | Unavailable. This origin is not a secure context | Available, and still useless for PlayLink |
| `<input capture="user">` plus canvas JPEG | Supported. This is the portrait path | Supported, and still not a console session |
| Screen Wake Lock | Unavailable here | Would not keep the UDP session alive by itself |
| Tab hidden or screen locked | JavaScript and the WebSocket freeze or die | Same |

Safari does not show the native Local Network permission dialog the way an installed app does. Opening a LAN address the user typed is the expected path. Confirm that on a device before calling the controller done. Guest Wi-Fi and client isolation block the phone from reaching the computer even when the computer can reach the PlayStation.

The bridge keeps the console ACK heartbeat while Safari is suspended. The page reconnects with the same UID and receives `bridge.snapshot`. Confirm that on a device before calling the controller done. Guest Wi-Fi and client isolation block the phone from reaching the computer even when the computer can reach the PlayStation.

Recent iOS versions this is aimed at: 17, 18, and 26. The mixed-content and secure-context limits are the ones the design depends on. They are stable across those releases.

## Players

| Arrangement | Verdict | Why |
| --- | --- | --- |
| One iPhone via the bridge, Android phones on Reverse of Power | Supported by the protocol | Distinct source IPv4 addresses, each received on port 9060 |
| Two iPhones through one bridge address and one UDP 9060 | Not supported | Console replies to IP:9060. Header has no client id. Untagged prompts cannot be split. See `protocol.md` |
| Two iPhones, one extra IPv4 each, each bound to `:9060` | Bridge isolates those endpoints. A console has not confirmed it | The simulator on `127.0.0.1` and `127.0.0.2` assigns two player ids and does not cross messages. A PlayStation capture of two secondary addresses is still required |
| Second UID on the same socket, hoping `UDPPortOffset` changes | Do not build | Every capture so far has offset 0, and the Android client ignores the field |

## Feature status

The bridge forwards the catalog. “On the wire” means a session will encode and send a client message, or decode and emit a server message. It does not mean a screen exists, and it does not mean a PlayStation has accepted the packet.

| Area | Status | Source |
| --- | --- | --- |
| Classic handshake, profile, avatar request, resources, images | On the wire. Simulator-tested. Not tried on a console | `GameProtocolClient.kt`, `docs/api.md` |
| Trivia, category, linking, sorting, power play, continue, and the other client commands | Serialized and forwarded. Trivia timeout and the empty power-play choice are simulator-tested | `NetworkManager.kt` |
| Reconnect with the same UID | Browser reattach keeps UDP. A new handshake asks the console again. Mid-game power-play reconnect is still a known upstream failure | reconnect trace, project `CLAUDE.md` |
| Portrait JPEG | Bridge sends transfer ids 2 and 3 after an avatar request | `encodeImageTransfer` |
| Costume masks and sounds | Absent on purpose | Upstream README. Do not add Sony assets |
| Decades rooms, missing letter, matching, elimination, ordering, extra power types | Encoded when the browser sends them. Upstream calls Decades unfinished | `GameProtocol2Client.kt` |
| Decades time sync | The browser may send `ClientToServerTimeSync`. The bridge does not schedule it | `docs/fullgame-decades.txt` |
| Quiz actions 15, 29, 30 | Constants only. No UI branch | `GameMessages.kt` |
| Holding-screen type 8 | Seen on reconnect. Unnamed | reconnect trace |
| 8-byte datagram before connection ack | Surfaced as `unknown_datagram`. Handshake continues | `fullgame.txt` |
| `GameInProgress` decoder variant | Unused | `ProtocolDecoder.kt` |
| `FactCount` | The bridge sends 63 | `GameProtocolClient.kt` |
| NACK and lost gameplay packets | Reported as `nack` and `ack_timeout`. The datagram is not replayed | `GameProtocolClient` has no replay buffer |
| Browser screens | Drawn from bridge events. `gameplay` and `controllerUi` are true | `web/app/` |

## GPL-3.0

Reverse of Power is GPL-3.0. This companion is a derivative: it copies the message model, magics, and client behavior into a new TypeScript program. It is GPL-3.0-only as well.

Obligations when the companion is given to someone else:

- Ship this `LICENSE` and `NOTICE`, and keep the Reverse of Power commit id.
- License the whole companion under GPL-3.0. Do not add a proprietary protocol module.
- Mark it as changed. `NOTICE` does that: new bridge and browser controller, Kotlin tree untouched.
- Offer the corresponding source with any binary or hosted build that a user did not already have. A Vercel landing page of this repository satisfies that if the repository stays public and the page names the source. A modified build needs its own source published.
- Do not strip the Sony non-affiliation notice. It is a trademark statement, not a claim of ownership.

The GPL does not require copying the upstream `.pcapng` files. Those traces are local to whoever recorded them and are gitignored upstream. Tests read the reference tree’s `UdpPacketFixtures.kt` in place.

No photo masks, title art, audio, or other game files are part of this program.
