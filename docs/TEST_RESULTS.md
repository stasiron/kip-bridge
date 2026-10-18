# Test results

Date: 2026-10-18. Machine: Windows, Node v24.15.0. Commands ran from `companion/` unless noted.

These results use `ConsoleSimulator` or the packaged process talking to itself. None of them is a PlayStation result. Real-console rows stay UNVERIFIED in `companion/docs/real-device-test.md`.

## Commands

| Command | Result |
| --- | --- |
| `npm run verify` | Exit 0. Typecheck, lint (`tsc`), 30 unit tests (3721.2083 ms), production build, 20 Playwright tests (27.1s), and development-server smoke on port 49237. |
| `npm test` | Included above: 30 passed, 0 failed, 0 skipped. |
| `npx playwright test` | Included above: 20 passed, 0 failed. 10 Chromium and 10 WebKit. |
| `npm run package:win` | Exit 0. Folder `companion/release/KIP-Bridge`. Launcher `KIP-Bridge.exe` is 5120 bytes. Zip `companion/release/KIP-Bridge-windows.zip` is 34823154 bytes. |
| `npm run test:exe` | Exit 0. PATH was only `C:\Windows\System32`. Child runtime was `companion/release/KIP-Bridge/node.exe`. Start join code `8TQR4EDZ`, restart join code `K2S2P7DT`. Each run checked HTTP `/`, loopback `/host` QR for 2 private URLs, LAN `/host` 404 without the code, a rejected join code with UDP 9060 still free, then a valid join against `ConsoleSimulator`: player 1, a trivia question on the WebSocket, and the answer back on UDP. |

`npm run verify` does not build or start `KIP-Bridge.exe`. The exe smoke is the separate Windows command above.

`./gradlew test` was not run. The Android tree was not edited. No `.pcapng` files are in the tree, so `tshark` replay was not run.

## What the automated tests cover

- Codec fixtures, fragmentation, ACK, NACK, UID, and Decades header magics.
- Wrong join code binds nothing. `/api/status` does not contain the join code. UDP 9060 stays bindable until a valid join.
- One address rejects a second UID with `endpoint_exhausted`. `127.0.0.1` and `127.0.0.2` isolate two simulated players. That is not a PlayStation multiplayer result. See `companion/docs/multiplayer.md`.
- Trivia, power play, resources, images, missing ACK, NACK, probe retry, connect timeout, and same-UID reattach.
- Playwright: setup, lobby, classic screens, Decades ordering, eliminating, missing letter, and matching, bad join code, two browsers, disconnect and reconnect, visibility reconnect, connect timeout, and a narrow mobile viewport. Chromium and WebKit.
- Packaged exe with no Node on PATH: private `node.exe`, HTTP page, loopback QR, join code hidden from LAN `/host` and `/api/status`, rejected join, simulator assignment, trivia question and answer, UDP 9060 free before join and after exit, and one restart.

## What they do not cover

- A PS4 or PS5 session.
- Device strings `KIP Browser Bridge` and `Node.js <version>` on a console.
- `FactCount` 63, Decades time sync, holding-screen type 8, quiz actions 15/29/30, and the 8-byte pre-ack datagram.
- Two secondary IPv4 addresses on one PC against a console.
- A physical iPhone lock during a question.
- Guest Wi-Fi or client isolation.
- Android Gradle tests.
