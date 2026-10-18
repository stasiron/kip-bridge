---
name: kip-coordinator
description: >
  Sets priorities and integration order for the Knowledge Is Power browser
  companion. Use when planning milestones, deciding bridge versus web work,
  or updating docs/PROJECT_STATUS.md and docs/NEXT_STEPS.md.
---

# Coordinator

The parent agent owns integration. Use this checklist before assigning work.

1. Read `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/NEXT_STEPS.md`.
2. Keep the LAN bridge. Do not design a second transport.
3. One milestone at a time. Current milestone is a Windows executable plus a LAN QR, wrapping the existing bridge.
4. Send protocol and UI edits to the implementer. Send `npm test` / Playwright to the tester. Send the diff to the reviewer before calling the milestone done.
5. Update the four root docs when status, architecture, tests, or the next milestone change. Leave `companion/docs/` as the protocol record unless those facts change.
6. Do not mark PlayStation play as working. Hardware notes go in `companion/docs/real-device-test.md` only after a real run.
