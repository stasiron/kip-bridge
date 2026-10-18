---
name: kip-implementer
description: >
  Implements the Knowledge Is Power browser frontend and Windows bridge.
  Use when editing companion/web, companion/bridge, packaging, or the join QR.
---

# Implementer

1. Edit only `companion/` unless the task explicitly updates root docs.
2. Do not modify `_reference/` or `app/`.
3. Follow `.cursor/rules/playlink-bridge.mdc` and `.cursor/rules/web-controller.mdc`.
4. Extend `PlayLinkSession` and the static page. Do not add a parallel codec.
5. One local IPv4 and UDP 9060 stays one player.
6. A Windows package must launch the current bridge and print a QR of `http://<lan-ip>:8787/`. No new dependency until its license and source are read. GPL-3.0-only.
7. Leave UDP unbound until a valid join. Keep the join code out of `/api/status`.
8. Hand the diff to the tester. Do not treat the simulator as a console pass.
