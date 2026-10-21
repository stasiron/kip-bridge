# Test results

Date: 2026-10-21. Machine: Windows, Node v24.15.0. Commands ran from `companion/` unless noted.

These results use `ConsoleSimulator` or the packaged process talking to itself. None of them is a PlayStation result. Real-console rows stay UNVERIFIED in `companion/docs/real-device-test.md`. No live GitHub Release update was performed; updater tests use mocks.

## Commands

| Command | Result |
| --- | --- |
| `npm run verify` | Exit 0. Typecheck, lint (`tsc`), 39 unit tests, production build, 20 Playwright tests (27.8s), development-server smoke. |
| `npm test` | 39 passed, 0 failed, 0 skipped. |
| `npx playwright test` | Included in verify: 20 passed (10 Chromium, 10 WebKit). |
| `npm run package:win` | Exit 0. Folder `companion/release/KIP-Bridge`. Launcher `KIP-Bridge.exe` 16384 bytes. Zip `companion/release/KIP-Bridge-windows.zip` ~34.8 MB. Includes `update-apply.cjs`, `VERSION.txt`, `update-config.json`. |
| `npm run test:exe` | Exit 0. Start join `RD6H3B97`, restart `K8YJ4PNG`. Simulator player 1 both runs. |

`npm run verify` does not build or start `KIP-Bridge.exe`. The exe smoke is separate.

`./gradlew test` was not run. No `.pcapng` in tree. No hardware PASS.

## What the automated tests cover

- Codec fixtures, fragmentation, ACK, NACK, UID, Decades magics.
- Endpoint pool: RFC1918 only (no APIPA for PlayLink), family `4`/`IPv4`, prefer phone/console subnet, resync, bind-fail retry, disconnect release, empty → `no_lan_address`, full → `endpoint_exhausted`.
- Updater mocks: not configured, up to date, available, Later, Update Now, bad signature, corrupt zip, active sessions block install, repeated checks.
- Playwright and packaged exe smoke as before (simulator only).

## What they do not cover

- A PS4 or PS5 session.
- A real GitHub Release download against the public API.
- Two secondary IPv4 addresses on one PC against a console.
