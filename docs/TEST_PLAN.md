# Test plan

Prefer a failing real behavior over another assertion on a mock. The simulator is allowed to prove the bridge. It is not allowed to prove the console.

Commands run from `companion/` with Node.js 22 or newer.

## Unit

`npm test` runs `node --experimental-strip-types --test --test-concurrency=1` on `bridge/src/**/*.test.ts`. Concurrency stays 1 so two tests do not bind UDP 9060.

Covers status JSON (no join code, UDP unbound before join), catalog equality with `GameMessages.kt`, static path escape, private-address checks, and discovery byte equality with `DdpDiscovery.kt`.

## Protocol integration

`bridge/src/protocol/codec.test.ts` parses `UdpPacketFixtures.kt` from `_reference/reverse-of-power` in place.

Required cases:

- Client JSON field order, including `"time":0.0`.
- Named single-packet and multi-packet fixtures, including eight avatar statuses.
- JPEG reassembly from chunked datagrams, in order and reversed.
- Device UID size, ACK, NACK, and connection-init sizes.
- A missing fragment index is an error.
- Decades magics follow the `KIP2_` version prefix.
- Round-trip of a payload larger than 1002 bytes.

`tshark` replay of a `.pcapng` is optional. Those files are gitignored and are not in this workspace. Absence is not a failure.

## Simulated PlayStation

`ConsoleSimulator` binds UDP and answers the sender on port 9060. `session.test.ts` drives the bridge through its WebSocket.

Required cases:

- Handshake through player assignment, device info, and an empty resource ack.
- Wrong join code binds nothing.
- Second UID on one address returns `endpoint_exhausted`.
- `127.0.0.1` and `127.0.0.2` get distinct player ids and do not see each other's messages.
- Trivia JSON, a chosen power play, a later empty power-play choice, and a silent trivia timeout of index `-1`.
- Missing resource GUID, `FactCount` 63, console JPEG, browser portrait.
- One `ack_timeout` without a second write. NACK does not close the session.
- Dropped probes still complete. A silent console becomes `connect_timeout` and releases 9060.
- Same UID reattach does not send a second `ClientRequestPlayerIDMessage`.
- A new handshake after `bridge.disconnect` can receive `RejoiningClientOwnProfileMessage`.

## Browser end to end

`npx playwright test` builds nothing by itself. `npm run test:e2e` builds first. The harness is `e2e/harness.mjs` on port 8790 with the simulator.

Projects: Desktop Chromium, and WebKit with the iPhone 13 device profile.

Required flows: status flags, join, name, avatar, lobby, holding, continue, category, trivia, power play, linking, sorting, end-of-game, bad join code, portrait and landscape controls, two-browser isolation, disconnect/reconnect, visibility restore, `connect_timeout`.

`npm run verify` is the single gate: typecheck, `tsc` lint, unit tests, production export, Playwright, `scripts/bridge-smoke.mjs`.

## Multiplayer and reconnection

| Case | Where it is proven | Where it is not |
| --- | --- | --- |
| Two browsers, two loopback addresses | Simulator and `e2e/scenarios.spec.ts` | A PlayStation |
| Two browsers, one host IPv4 | `endpoint_exhausted` unit test | Still the intended rejection |
| Same UID, WebSocket drop, UDP stays | Session test and Playwright | A locked physical iPhone |
| Android Reverse of Power plus one Safari phone | Not automated | Needs both devices and a console |

## Windows executable

`npm run test:exe` starts `companion/release/KIP-Bridge/KIP-Bridge.exe` with a PATH that cannot find a system Node. It does not run `npm start`. The smoke checks that the child process is the folder's `node.exe`, reads a join code from stdout, checks that `GET /api/status` omits that code, fetches `/`, and checks that loopback `/host` contains `qrSvg` for each printed LAN URL. A request to `/host` on a LAN address must be 404 and must not contain the code. A wrong join code returns `bad_join_code` and leaves UDP 9060 free. A valid code against `ConsoleSimulator` assigns a player, carries a trivia question to the WebSocket, and carries the answer back to the simulator. The process tree is then killed and the checks run once more. Build the folder with `npm run package:win` first. Both commands are Windows-only. `npm run verify` does not run them, so Ubuntu CI stays unchanged.

## Hardware

`companion/docs/real-device-test.md` is the only checklist that can move a row from UNVERIFIED to PASS or FAIL. This environment has no console, so every hardware row stays UNVERIFIED.

## This session

2026-10-18 packaging pass: see `docs/TEST_RESULTS.md`. `./gradlew test` was not run. The Android tree was not edited.
