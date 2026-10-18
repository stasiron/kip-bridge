# Project status

Date: 2026-10-18. This file records what is in the tree. It does not replace `companion/docs/verification.md`.

## What this workspace is

There is no `.git` directory. The Android app at `app/` matches `_reference/reverse-of-power` on every compared file (155 files, zero hash differences). `_reference/COMMIT` says that snapshot is upstream `main` commit `e9543047cd73cd93e1cbc59313a91f0f2c0f68cc` (2026-06-20), taken as a zip because git was not available. Root `README.md`, `CLAUDE.md`, and `LICENSE` match that snapshot.

New work is `companion/`: a Node bridge, a Next.js static controller, Playwright tests, and protocol notes. GitHub workflow files exist (`.github/workflows/companion-verify.yml`, `release.yml`) but cannot run from this folder until a git remote exists. Do not create that remote unless asked.

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
| Windows `.exe` | Not built. Start path is Node 22+ via `companion/scripts/start-bridge.ps1`. |
| QR code | Not generated. README tells the operator to encode the LAN URL elsewhere. |
| Real PS4/PS5 | Not tested. Status is UNVERIFIED. |

`web/vercel.json` can host the same static export as instructions. `HomeClient` shows the controller only when `/api/status` is the bridge. A public page cannot play.

## Automated results this session

Node v24.15.0, from `companion/`:

| Command | Result |
| --- | --- |
| `npm test` | 25 passed, 0 failed (about 3.4s) |
| `npm run typecheck` | Passed (web and bridge) |
| `npx playwright test` | 18 passed, 0 failed (Chromium and WebKit, about 22.5s) |

`npm run verify` (adds lint, production build, and cold-start smoke) was not repeated. `companion/docs/verification-report.md` records a full PASS earlier on 2026-10-18. `companion/test-results/.last-run.json` says `passed`.

## Not done, and not treated as broken tests

- No Windows executable and no in-app QR.
- No hardware pass. Device model `KIP Browser Bridge` and OS `Node.js <version>` are unproven.
- `FactCount` 63, Decades time sync, holding-screen type 8, quiz actions 15/29/30, and the 8-byte pre-ack datagram are documented limits, not silent fixes.
- Two iPhones need two host IPv4 addresses. A console has not confirmed that layout.
- `.pcapng` files are gitignored and are not in this tree. `tshark` replay was not run.
- No ESLint config. `npm run lint` is `tsc --noEmit`.
- Android Gradle tests were not run.
