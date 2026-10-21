# Multiple browser players

One host IPv4 address plus UDP port 9060 is one browser player. Two loopback addresses in the simulator do not prove that a PlayStation accepts two addresses on one PC.

## What the protocol shows

Sources: `GameProtocolClient.kt` (`startListening`), `PcapReplay.kt`, `AssignPlayerIDAndSlotMessage.UDPPortOffset` in `GameMessages.kt`, and the text traces in `docs/`.

| Fact | Evidence |
| --- | --- |
| The console sends replies to the client IPv4 address, port 9060 | `PcapReplay` treats destination port 9060 as server-to-client. The Android client binds its receive socket to `listenPort` 9060. |
| The client's send socket uses an ephemeral port | `DatagramSocket(0, ...)`. The bridge does the same (`bind` port 0). The console does not answer that source port. |
| The 22-byte header has no player, session, or device field | `ProtocolEncoder.buildPacket`. Fragment reassembly and the ACK cursor are keyed only by message id. |
| `UDPPortOffset` is 0 in the classic, Decades, and reconnect traces | `docs/fullgame.txt`, `docs/fullgame-decades.txt`, `docs/reconnect-join-after-next-question-up-to-powerplay.txt`. |
| The Android client never reads `UDPPortOffset` | The field exists on `AssignPlayerIDAndSlotMessage` and is not referenced anywhere else in `app/src`. |
| Several server prompts have no player id | `SessionStateMessage`, category choice, power-play choice, end-of-game fact count. They cannot be split after they arrive on one socket. |

A second source port, a second UID on the same socket, or a second WebSocket on the same address does not give the console a second reply path.

## What the bridge does

`PlayLinkSession.open` binds the receive socket to `localAddress:9060` and the send socket to `localAddress:0`. `EndpointPool` gives each session a distinct address from `lanIpv4Addresses()`, refreshed on every join and status poll. That list is non-loopback RFC1918 IPv4 only. Loopback, public addresses, link-local `169.254/16`, and shared CGNAT space such as `100.64.0.0/10` are left out for PlayLink (phones may still open HTTP over link-local). The pool prefers the address the phone already reached and an address on the same /24 as the console. A virtual adapter in RFC1918 space, such as a Hyper-V switch, can still appear; ranking pushes it below `192.168/16` when both exist. If UDP bind fails on one address, the join tries the next free address and releases the failed slot. A second UID, when every playable address is in use, gets `endpoint_exhausted`. An empty playable list is `no_lan_address`, not exhausted. The first session stays up when a later join is refused.

`session.test.ts` covers that refusal, and it covers `127.0.0.1` and `127.0.0.2` receiving different player ids and different console messages. That is isolation inside the simulator. It is not a PlayStation result.

## What a second phone needs

A second browser player needs a second IPv4 address on the Windows host, each with its own UDP 9060 socket. Adding that address is a manual Windows step (`netsh interface ipv4 add address` or the adapter UI). This program does not run that command and does not change adapter settings.

Whether a PlayStation accepts two secondary addresses on one computer is UNVERIFIED. Do not ship that as supported console multiplayer until a capture shows both flows.

One browser through the bridge plus Android Reverse of Power phones on their own addresses matches the layout the protocol already uses. That mix is also UNVERIFIED on hardware.

## Not a workaround

Do not put two UIDs on one 9060 socket. Do not invent a header field. Do not rebind to `9060 + UDPPortOffset` unless a new capture shows a non-zero offset and datagrams arriving on that port.
