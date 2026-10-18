# Verification report

Independent QA pass for the Knowledge Is Power browser companion.  
Date of automated run: **2026-10-18** (local Windows).  
Reference commit: `e9543047cd73cd93e1cbc59313a91f0f2c0f68cc`.

**Real PlayStation integration: UNVERIFIED.** Nothing in this report is a PASS for PS4/PS5 hardware.

---

## Commands executed

```text
cd companion
npm install
npm run verify
```

`npm run verify` runs, in order (fail-fast):

1. `npm run typecheck` (web + bridge)
2. `npm run lint` (web: `tsc --noEmit` — no separate ESLint rule set in tree)
3. `npm test` (bridge unit + protocol fixtures + session/simulator)
4. `npm run build` (Next.js static export → `web/out`)
5. `npx playwright test` (Chromium + WebKit against bridge + `ConsoleSimulator`)
6. `scripts/bridge-smoke.mjs` (cold start, `/api/status`, static index)

Also used during audit/fix loops: targeted `npx playwright test`, `npm test`.

---

## Automated results (this run)

| Step | Result |
| --- | --- |
| Typecheck | PASS |
| Lint (tsc stand-in) | PASS |
| Bridge unit / protocol / session tests | PASS (25 tests) |
| Production frontend build | PASS |
| Playwright Chromium + WebKit | PASS (18 tests) |
| Bridge cold-start smoke | PASS |
| **`npm run verify`** | **PASS** |

Physical Android + Safari + PS console: **UNVERIFIED** / **BLOCKED** (no console in this environment). See `docs/real-device-test.md`.

---

## Major bugs found and fixed (this audit)

| Severity | Issue | Fix |
| --- | --- | --- |
| CRITICAL | Category override sent offer `DurationSeconds` + immediate Stop response (≠ Android `PowerPickFragment`) | Elapsed wall time on tap; Stop response only on `ServerStopCategorySelectOverride` |
| CRITICAL | Linking/sorting/etc. had no timeout answer when Safari suspended | Bridge `armPhaseTimeout` empty answers; UI `onExpire` submit for linking/sorting |
| HIGH | Power-play inventing targets when `PowerPlayTargets` empty; wrong `TargetCount > 1` flow | Everyone confirm echoes server list; single-target picks from `PowerPlayTargets` only |
| MEDIUM | E2E multiplayer / override / disconnect / connect_timeout gaps | `e2e/scenarios.spec.ts` + 2-endpoint harness |
| LOW | Stale docs claiming Phase C not started | Docs + README updated |

Remaining known gaps (not silently “fixed”):

- Trivia paint/ice/bomb overlay clearing not mirrored (defaults 0/false).
- Decades minigames encoded + timed out by bridge; console acceptance UNVERIFIED.
- Mid-game power-play reconnect sticky failure remains an upstream risk.
- Dedicated ESLint config not added (lint step = TypeScript check).

---

## Actual limitations

- One host IPv4 + UDP **9060** = one browser player (`endpoint_exhausted` otherwise).
- Public HTTPS (Vercel) cannot open LAN `ws://` (mixed content) — launcher only.
- Portrait path: file/`capture` + JPEG; no `getUserMedia` on plain HTTP.
- No Sony/Wish assets, masks, or audio.
- Quiz actions 15 / 29 / 30: no UI branch (same as Android).
- Holding type 8: unnamed; shown as notice only.
- DeviceInfo model string `KIP Browser Bridge` not proven on console.

---

## Multiplayer status

| Arrangement | Status |
| --- | --- |
| Two browsers on `127.0.0.1` + `127.0.0.2` via simulator | PASS (automated) — isolated events + distinct player ids |
| Two browsers, one host IP | Rejected by design (`endpoint_exhausted`) — PASS in unit tests |
| Two secondary IPv4 on one PC vs real console | UNVERIFIED |
| Safari + Android RoP same console | UNVERIFIED |

---

## Safari compatibility status

| Item | Status |
| --- | --- |
| Same-origin `http://LAN:8787` + `ws://` design | Documented; matches WebKit mixed-content constraints |
| Playwright WebKit / iPhone 13 project | PASS (automated) |
| Physical iPhone Safari + screen lock mid-question | UNVERIFIED |
| Wake Lock / getUserMedia on LAN HTTP | Not available — by design |

---

## Real PlayStation test status

| Item | Status |
| --- | --- |
| Any live PS4/PS5 session through this bridge | **UNVERIFIED** |
| Complete real game | **UNVERIFIED** |
| Mid-game reconnect on console | **UNVERIFIED** |

Checklist for operators: `docs/real-device-test.md`.

---

## Remaining blockers before claiming “works on PS4/PS5”

1. Execute `docs/real-device-test.md` section 1–2 and record PASS/FAIL.
2. Confirm DeviceInfo / FactCount / Decades (if used) against a live title.
3. Optional: second host IPv4 capture if multi-iPhone required.
4. Optional: mixed Android RoP + Safari session.

Until those exist, marketing or README must not claim full console readiness.

---

## Deliverable map

| Deliverable | Location |
| --- | --- |
| Application source | `companion/web`, `companion/bridge` |
| Local bridge | `npm start` / `scripts/start-bridge.cmd` |
| Automated suite | `npm test`, `npx playwright test` |
| Single gate | `npm run verify` |
| Windows instructions | `companion/README.md`, `scripts/start-bridge.*` |
| Vercel launcher | `web/` static export + `web/vercel.json` |
| Real-device checklist | `docs/real-device-test.md` |
| This report | `docs/verification-report.md` |
| CI | `.github/workflows/companion-verify.yml` |
