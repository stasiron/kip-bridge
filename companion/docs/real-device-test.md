# Real device acceptance checklist

**Rule:** Never mark real PlayStation integration **PASS** from mocks, fixtures, pcaps, or the `ConsoleSimulator` alone.

Status vocabulary:

| Tag | Meaning |
| --- | --- |
| **PASS** | Executed on real hardware and succeeded |
| **FAIL** | Executed on real hardware and failed |
| **BLOCKED** | Cannot run (missing console / phone / network) |
| **UNVERIFIED** | Not yet attempted on real hardware |

Default for every row below until someone fills results by hand: **UNVERIFIED**.

---

## Prerequisites (Windows)

1. PS4 or PS5 + Knowledge Is Power (or Decades) on the same Wi‑Fi as the PC (not guest / client-isolation SSID).
2. Node.js 22+ on the PC.
3. From `companion/`: `npm install`, `npm run build`, then `scripts\start-bridge.cmd` (or `npm start`).
4. Note the **Join code** and the printed `http://<lan-ip>:8787/` URL.
5. Windows Firewall: allow Node.js on **Private** networks (TCP 8787; UDP 9060 after join).
6. Optional QR: generate a QR of `http://<lan-ip>:8787/` with any local QR tool; phone must open that HTTP origin (not the Vercel HTTPS page) to play.

Vercel hosts the launcher only. Safari blocks `wss`/`ws` to a LAN bridge from a public HTTPS page.

---

## 1. Windows PC + PS4/PS5 same network

| Step | Expected | Result |
| --- | --- | --- |
| Bridge starts; join code printed; `/api/status` has no join code | Smoke OK | UNVERIFIED |
| Discover finds awake console **or** manual IP works | Console listed / join proceeds | UNVERIFIED |
| Join completes to `assigned` | Player id + slot shown | UNVERIFIED |

---

## 2. One iPhone (Safari)

| Step | Expected | Result |
| --- | --- | --- |
| Open bridge LAN URL in Safari | Controller UI (not Vercel launcher) | UNVERIFIED |
| Name + avatar (+ optional selfie file capture) | Profile accepted; lobby | UNVERIFIED |
| Start / continue / category / trivia / power play | TV + phone stay in sync | UNVERIFIED |
| Lock screen mid-trivia | Bridge timeout answer (−1); no double-submit on return | UNVERIFIED |

---

## 3. Multiple iPhones

| Step | Expected | Result |
| --- | --- | --- |
| Second phone, **same** PC IPv4 | `endpoint_exhausted` (by design) | UNVERIFIED |
| Second host IPv4 on PC (`netsh interface ipv4 add address …`), bridge restarted | Two assigned players | UNVERIFIED |
| Isolated prompts (category / trivia) | Each phone sees only its messages | UNVERIFIED |

Simulator already isolates `127.0.0.1` / `127.0.0.2`. Console acceptance of secondary addresses: **UNVERIFIED**.

---

## 4. Mixed iPhone (browser) + Android (Reverse of Power)

| Step | Expected | Result |
| --- | --- | --- |
| Android RoP on its own Wi‑Fi IP + one Safari via bridge | Both play on same console | UNVERIFIED |

If no Android handset available: mark **BLOCKED** / **UNVERIFIED**, not PASS.

---

## 5. Complete real game

| Step | Expected | Result |
| --- | --- | --- |
| Full classic round (lobby → categories → trivia → power plays → continue → end facts) | No stuck phone; console advances | UNVERIFIED |
| Decades-only minigames if title is Decades | Encoded path; may still be unfinished upstream | UNVERIFIED |

---

## 6. Mid-game reconnection

| Step | Expected | Result |
| --- | --- | --- |
| Leave Safari / lock, return, rejoin same UID | Snapshot or rejoin profile; same slot when console allows | UNVERIFIED |
| Mid power-play disconnect | May stick (known upstream Android issue) — record FAIL if stuck | UNVERIFIED |

---

## How to record a run

Copy this file section into a dated note or PR comment:

```
Date:
Operator:
Console: PS4 / PS5  Firmware:
Game: classic / Decades
Bridge commit:
iOS:
Android RoP (y/n):
Results: (PASS/FAIL/BLOCKED/UNVERIFIED per table)
Notes:
```

---

## Related automated evidence (not real console)

See `docs/verification.md` and `docs/verification-report.md`. Those cover fixtures, simulator, and Playwright only.
