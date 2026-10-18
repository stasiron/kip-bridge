# Knowledge Is Power browser companion

Local replacement for the discontinued PlayLink phone app. A Windows process on the same LAN as the PlayStation speaks PlayLink UDP. Phones only open the page that process serves.

Read `docs/PROJECT_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/TEST_PLAN.md`, and `docs/NEXT_STEPS.md` before changing behavior. Protocol detail already lives in `companion/docs/`. Do not rewrite those notes from memory.

## Roles

The parent agent is the coordinator. It sets order, integrates, and does not let one role widen scope.

| Role | Does | Does not |
| --- | --- | --- |
| Coordinator | Priorities, integration, status docs | Invent a second transport |
| Implementer | `companion/web` and `companion/bridge` | Edit `_reference/` or claim a console pass |
| Tester | `npm test`, `npm run typecheck`, Playwright, smoke | Change product code to make a red test green |
| Reviewer | Independent diff review | Implement the fix in the same pass |

Delegate with the project subagents in `.cursor/agents/` when the task is large enough for a separate context. Role checklists are `.cursor/skills/`.

## Hard rules

- `_reference/reverse-of-power` is a read-only snapshot of [synchrone/reverse-of-power](https://github.com/synchrone/reverse-of-power) commit `e9543047cd73cd93e1cbc59313a91f0f2c0f68cc`. The `app/` tree is a byte copy of that snapshot. Do not edit either to add browser features.
- GPL-3.0-only. Keep `LICENSE` and `NOTICE`. No proprietary game assets, masks, fonts, or sounds.
- Do not claim PS4 or PS5 compatibility from fixtures, the simulator, or Playwright. Only `companion/docs/real-device-test.md` filled on hardware can say PASS.
- Gameplay stays on `http://<lan-ip>:8787` served by the bridge. A public HTTPS host cannot open the LAN socket. Do not add a database, account service, or cloud relay.
- One local IPv4 plus UDP 9060 is one browser player. Do not multiplex two UIDs on one socket unless a new capture shows a non-zero `UDPPortOffset` and replies on `9060 + offset`.
- Preserve existing work. Do not delete the Vercel launcher, the Android tree, or traces in `docs/` because a later phase prefers a local-only setup.
- A local git repository may exist. Do not push, add a remote, or publish unless the user asks.

## Verify

From `companion/`: `npm test` for protocol and session behavior. `npx playwright test` for the browser. `npm run verify` before calling a milestone done. Node.js 22 or newer.
