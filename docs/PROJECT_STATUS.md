# Project status

Date: 2026-10-18. This file records what is in the tree. It does not replace `companion/docs/verification.md`. Exact command output is in `docs/TEST_RESULTS.md`.

## What this workspace is

A local git repository exists. It has no remote. Do not push, add a remote, or publish unless asked. The Android app at `app/` matches `_reference/reverse-of-power` on every compared file (155 files, zero hash differences). `_reference/COMMIT` says that snapshot is upstream `main` commit `e9543047cd73cd93e1cbc59313a91f0f2c0f68cc` (2026-06-20), taken as a zip because git was not available. Root `README.md`, `CLAUDE.md`, and `LICENSE` match that snapshot.

New work is `companion/`: a Node bridge, a Next.js static controller, Playwright tests, protocol notes, and a Windows folder build. GitHub workflow files exist (`.github/workflows/companion-verify.yml`, `release.yml`) but have not run here. Do not create a remote unless asked.

## Original Android app

Package `com.game.remoteclient`. Kotlin client for Knowledge is Power and a partial Decades port. It discovers the console with DDP, then uses UDP 9060/9066. Upstream README claims full classic play: trivia, linking, sorting, categories, power plays, profiles, discovery, mid-game reconnect. Known gaps, from upstream `CLAUDE.md` and README:

- Photo overlay masks and sounds are intentionally absent.
- Some Decades power types are generic icons.
- Mid-game reconnect can stick the game, especially around power play.

This phase did not install an Android SDK or run `./gradlew test`. The tree was not modified.

## What has moved to the web

| Area | State |
| --- | --- |
| Packet codec, fragmentation, ACK/NACK, UID, JPEG | Implemented in `companion/bridge/src/protocol/`. Fixture-tested against `UdpPacketFixtures.kt`. |
| One PlayLink session, discovery, simulator | Implemented in `companion/bridge/src/playlink/`. |
| HTTP page + WebSocket `/session` | Implemented. Join code gates UDP. |
| Controller screens | Connect, setup, lobby, holding, continue, category, category override, trivia, power play, linking, ordering, sorting, eliminating, missing letter, matching, end-of-game facts. |
| Reconnect while UDP stays up | Simulator and Playwright. Same UID gets `bridge.snapshot` and does not send a second player-id request. |
| Two browsers on two loopback addresses | Isolated in simulator and Playwright. |
| Windows folder | Built by `npm run package:win`. `KIP-Bridge.exe` starts a private `node.exe` and `bridge.cjs`. No separate Node install. |
| QR code | Drawn by the bridge (`bridge/src/qr.ts`). The console prints an ASCII QR. `GET /host` on loopback shows an SVG QR of the LAN URL and the join code. |
| Real PS4/PS5 | Not tested. Status is UNVERIFIED. |

`web/vercel.json` can host the same static export as instructions. `HomeClient` shows the controller only when `/api/status` is the bridge. A public page cannot play.

## Automated results this session

Node v24.15.0, from `companion/`. Counts are in `docs/TEST_RESULTS.md`.

| Command | Result |
| --- | --- |
| `npm test` | 29 passed, 0 failed |
| `npm run typecheck` | Passed (web and bridge) |
| `npx playwright test` | 20 passed, 0 failed (Chromium and WebKit, 27.5s) |
| `npm run package:win` | Wrote `companion/release/KIP-Bridge/` and `KIP-Bridge-windows.zip` |
| `npm run test:exe` | Packaged exe served `/`, `/host`, and `/api/status`. UDP 9060 stayed free. Restart passed |

`npm run verify` was green before the packaging edits (25 tests, 18 Playwright). It was not repeated after those edits because it does not build the exe. The commands above cover the same checks plus the new host tests, the Decades Playwright case, and the exe smoke.

## Not done, and not treated as broken tests

- No hardware pass. Device model `KIP Browser Bridge` and OS `Node.js <version>` are unproven.
- `FactCount` 63, Decades time sync, holding-screen type 8, quiz actions 15/29/30, and the 8-byte pre-ack datagram are documented limits, not silent fixes.
- Two iPhones need two host IPv4 addresses. A console has not confirmed that layout.
- `.pcapng` files are gitignored and are not in this tree. `tshark` replay was not run.
- No ESLint config. `npm run lint` is `tsc --noEmit`.
- Android Gradle tests were not run.
