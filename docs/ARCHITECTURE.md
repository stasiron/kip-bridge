# Architecture

The bridge that already runs in `companion/` is the architecture to keep. A later packaging step wraps that process. It does not replace the transport.

## Chosen shape

```text
iOS Safari or Android Chrome
    HTTP + WebSocket, same origin
Windows bridge  0.0.0.0:8787
    serves companion/web/out
    one PlayLink session per local IPv4
        send from an ephemeral UDP port to console:9066
        receive on that IPv4, UDP 9060
PlayStation running a purchased Knowledge is Power (or Decades) copy
```

Android Reverse of Power phones keep their own addresses and their own port 9060. They do not go through the bridge.

There is no database. Session state stays in the bridge process. The 32-hex device UID stays in the phone's `localStorage`.

## Why the browser is not the UDP client

Verified from the platform and from the existing client, not from a new theory:

- Safari and Chrome do not offer a raw UDP socket that can send to port 9066 and bind port 9060.
- The console writes replies to the client's IPv4 address, port 9060. Captures and `PcapReplay` classify destination port 9060 as server-to-client. The 22-byte header has no player id. `UDPPortOffset` is 0 in the classic, Decades, and reconnect traces. The Android client never rebinds from that field.
- A public `https://` page cannot open `ws://192.168.x.x` (mixed content). A self-signed `wss://` certificate is an install step this design refuses. A tunnel would put the party socket on the internet.
- `http://<lan-ip>` is not a secure context, so `getUserMedia` and Screen Wake Lock are unavailable. The portrait control is a file input plus canvas JPEG.

The bridge therefore serves the page and owns the ACK heartbeat. iOS may suspend the tab. The UDP session stays up until detach grace expires. A returning socket with the same UID receives `bridge.snapshot`.

## What the code actually does

Sources: `companion/bridge/src/`. Behavior copied from the Kotlin client and checked against fixtures. Field-level notes: `companion/docs/protocol.md`. Browser frames: `companion/docs/api.md`.

| Step | Owner | Verified by |
| --- | --- | --- |
| DDP search, PS4 port 987 / PS5 port 9302, game port stays 9066 | `playlink/discovery.ts` | Unit test against `DdpDiscovery.kt` bytes |
| Join code, private-network check, endpoint pool | `server.ts`, `access.ts`, `pool.ts` | Session tests. Wrong code does not bind 9060 |
| Connection request, both UID magics, ACK of last server id | `PlayLinkSession` | Simulator handshake |
| `SessionState` to player id; assign to device info + avatar status | `PlayLinkSession` | Simulator |
| Resources, images, `FactCount` 63 | `PlayLinkSession` | Simulator. Console acceptance of 63 is not proven |
| Trivia timeout index `-1`; empty power-play choice; empty linking/sorting/ordering/eliminating/missing-letter/matching timeouts | `PlayLinkSession` | Simulator for trivia and power play. Other empty answers are encoded. Console acceptance of Decades paths is not proven |
| Screens | `companion/web/app/controller/screens.tsx` | Playwright against the simulator |

`ConsoleSimulator` is a UDP peer that uses the same codec. It is not a PlayStation.

## Verified versus assumed

Verified means fixtures, Kotlin source, text traces, or the simulator. It does not mean a console accepted the packet.

| Claim | Standing |
| --- | --- |
| Classic and Decades header magics, 22-byte header, 1002-byte chunks, JSON / multi-JSON / JPEG markers | Verified against encoder source and fixtures |
| Handshake order in code: connection request, then UID packets, about once a second | Matches current Kotlin. `docs/fullgame.txt` shows the opposite order on the first datagrams and the console still answered. Order is not proven to matter |
| 8-byte datagram before the connection ack | Observed in traces. Decoder treats it as unknown. Handshake continues |
| NACK is a 38-byte `8A 33` packet with a non-zero tail. No retransmission buffer | Matches Kotlin. One capture tail byte `0x02` has no assigned meaning |
| Numeric device info 10 / 2 / 1 / Handheld | Sent by the working Android client. Whether the console checks them is not stated |
| Strings `KIP Browser Bridge` and `Node.js <version>` | Assumption. No console capture |
| Two secondary IPv4 addresses on one PC are two players | Bridge isolates them. A PlayStation capture does not exist |
| Screen lock on a physical iPhone still gets the timeout answer | Designed. Not run on a phone |
| Decades needs a scheduled time-sync | Not shown. The bridge can forward `ClientToServerTimeSync` if the page sends it. It does not schedule one |

## Packaging

Developers still run `node --experimental-strip-types companion/bridge/src/index.ts`. That process prints the join code, each LAN URL, and an ASCII QR of the URL.

`npm run package:win` (Windows only) writes `companion/release/KIP-Bridge/` and `companion/release/KIP-Bridge-windows.zip`. The folder contains:

- `KIP-Bridge.exe`, a small C# console launcher compiled with the .NET Framework `csc`. It sets `KIP_BRIDGE_LAUNCH=1` and starts `node.exe bridge.cjs` in the same folder.
- `node.exe`, a private copy of the Node binary used at build time. The player does not install Node.
- `bridge.cjs`, an esbuild bundle of the existing TypeScript bridge. The codec is not rewritten. Optional native `ws` addons stay external.
- `web/`, a copy of the Next.js static export.
- `LICENSE`, `NOTICE`, `NODE-LICENSE.txt`, and `README.txt`.

A single Node SEA binary was not used. SEA plus a signed `node.exe` needs extra tooling, and a folder already carries the web assets. The zip is the distribution.

`GET /host` answers only on loopback. It shows the join code and an SVG QR of each LAN URL. The QR encoder is in `bridge/src/qr.ts` (byte mode, ECC level L, versions 1–3). It has no npm dependency. `GET /api/status` still omits the join code.

The player still has to allow the program through the Windows firewall on private networks: TCP 8787, and UDP 9060 after join. The program does not change adapter addresses.
