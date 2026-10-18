# Test results

Date: 2026-10-18. Machine: Windows, Node v24.15.0. Commands ran from `companion/` unless noted.

These results use `ConsoleSimulator` or the packaged process talking to itself. None of them is a PlayStation result. Real-console rows stay UNVERIFIED in `companion/docs/real-device-test.md`.

## Commands

| Command | Result |
| --- | --- |
| `npm test` | 29 passed, 0 failed, 0 skipped. Duration 3664.8108 ms. `--test-concurrency=1`. |
| `npm run typecheck` | Passed. `tsc --noEmit` in `kip-browser-web` and `kip-browser-bridge`. |
| `npx playwright test` | 20 passed, 0 failed. 10 Chromium and 10 WebKit (iPhone 13). Duration 27.5s. One worker. |
| `npm run package:win` | Exit 0. Folder `companion/release/KIP-Bridge`. Launcher `KIP-Bridge.exe` is 5120 bytes. Zip `companion/release/KIP-Bridge-windows.zip` is 34823115 bytes. |
| `npm run test:exe` | Exit 0. First start join code `YKESMMP5`. After kill and restart, join code `26KUWY49`. Both times `/` and loopback `/host` returned 200, `/api/status` omitted the code and reported `playlink.bound` false, and a separate socket could bind UDP 9060. |

`npm run verify` passed earlier the same day, before the host page, QR, Decades Playwright case, and Windows package. That run was typecheck, 25 unit tests, the Next.js export, 18 Playwright tests, and the development-server smoke. It was not repeated after those edits. `npm run verify` does not build or start `KIP-Bridge.exe`.

`./gradlew test` was not run. The Android tree was not edited. No `.pcapng` files are in the tree, so `tshark` replay was not run.

## What the automated tests cover

- Codec fixtures, fragmentation, ACK, NACK, UID, and Decades header magics.
- Wrong join code binds nothing. `/api/status` does not contain the join code. UDP 9060 stays bindable until a valid join.
- One address rejects a second UID with `endpoint_exhausted`. `127.0.0.1` and `127.0.0.2` isolate two simulated players. That is not a PlayStation multiplayer result. See `companion/docs/multiplayer.md`.
- Trivia, power play, resources, images, missing ACK, NACK, probe retry, connect timeout, and same-UID reattach.
- Playwright: setup, lobby, classic screens, Decades ordering, eliminating, missing letter, and matching, bad join code, two browsers, disconnect and reconnect, visibility reconnect, connect timeout, and a narrow mobile viewport. Chromium and WebKit.
- Packaged exe startup, static page, loopback host QR, status without the join code, free UDP 9060, and one restart.

## What they do not cover

- A PS4 or PS5 session.
- Device strings `KIP Browser Bridge` and `Node.js <version>` on a console.
- `FactCount` 63, Decades time sync, holding-screen type 8, quiz actions 15/29/30, and the 8-byte pre-ack datagram.
- Two secondary IPv4 addresses on one PC against a console.
- A physical iPhone lock during a question.
- Guest Wi-Fi or client isolation.
- Android Gradle tests.
