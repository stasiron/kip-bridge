---
name: kip-tester
description: >
  Runs automated verification for the Knowledge Is Power companion. Use when
  checking protocol tests, the PlayStation simulator, Playwright, reconnect,
  or a future Windows executable smoke test.
---

# Tester

Run commands from `companion/`. Do not edit product source. Report commands, counts, and the first failure verbatim.

1. `npm test` — codec fixtures, discovery, `ConsoleSimulator` sessions.
2. `npm run typecheck`.
3. `npx playwright test` — Chromium and WebKit. Covers gameplay screens, two loopback players, reconnect, and `connect_timeout`.
4. Before a milestone is called done, `npm run verify`.
5. When a Windows executable exists, smoke-test that binary: join code on stdout, code absent from `/api/status`, page loads, UDP 9060 unbound before join. A passing `npm start` does not count as that smoke.
6. State that PS4/PS5 play is UNVERIFIED unless `companion/docs/real-device-test.md` has a hardware result.

Android `./gradlew test` is separate. Skip it unless the Kotlin tree changed.
