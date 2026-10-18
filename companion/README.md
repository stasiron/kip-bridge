# Knowledge Is Power browser companion

Local-network bridge so an iPhone can play the original **Knowledge is Power** from Safari, next to Android phones running [Reverse of Power](https://github.com/synchrone/reverse-of-power).

The bridge speaks PlayLink. The static page it serves is the mobile controller. A join code printed at startup is required before UDP 9060 opens.

**Real PS4/PS5 play is UNVERIFIED until you complete `docs/real-device-test.md`.** Automated tests use fixtures + `ConsoleSimulator` + Playwright only.

## Reference

| | |
| --- | --- |
| Upstream | https://github.com/synchrone/reverse-of-power |
| Commit | `e9543047cd73cd93e1cbc59313a91f0f2c0f68cc` |
| Snapshot | `../_reference/reverse-of-power` (read-only) |
| License | GPL-3.0-only — see `LICENSE`, `NOTICE` |

## Windows quick start

1. Install [Node.js 22+](https://nodejs.org/).
2. Open PowerShell:

```powershell
cd path\to\reverse of power\companion
npm install
npm run build
.\scripts\start-bridge.ps1
```

Or double-click `scripts\start-bridge.cmd`.

3. Copy the **Join code** from the terminal.
4. On the iPhone (same Wi‑Fi as the PC and PlayStation), open one of the printed `http://192.168.x.x:8787/` URLs in **Safari**.
5. Enter the join code, console IP (discover or type), name, avatar. Play.

### Firewall

Allow **Node.js** on Private networks:

- TCP **8787** (page + WebSocket)
- UDP **9060** (PlayLink receive; binds after join)

### Discovery troubleshooting

- Guest Wi‑Fi / client isolation: phone cannot reach PC — use a normal LAN.
- Asleep consoles may not answer discovery — type the PS IP manually (Settings → System → console IP).
- Game port stays **9066** (not `host-request-port` from DDP).
- Vercel HTTPS page **cannot** join — mixed content blocks LAN WebSockets.

### Multiple iPhones

One PC IPv4 + UDP 9060 = **one** browser player. For a second Safari client, add another IPv4 on the host and restart the bridge so the endpoint pool includes it. Android RoP phones keep using their own addresses.

### QR / convenient URL

Encode `http://<pc-lan-ip>:8787/` as a QR. Do not encode the Vercel URL for gameplay.

## Verify (automated)

```powershell
npm run test:e2e:install   # once
npm run verify
```

`npm run verify` runs typecheck, lint (tsc), unit/protocol tests, production build, Playwright (Chromium + WebKit), and a bridge cold-start smoke. It fails on any error.

## Vercel

`web/` is a static export (`output: "export"`). Deploy `companion/web` with `vercel.json` (build → `out`). That site is a **launcher** only — it explains how to open the local bridge. It does not talk to the console.

## Layout

```
companion/
  bridge/     PlayLink UDP + HTTP/WS API
  web/        Next.js static controller + landing
  e2e/        Playwright + simulator harness
  scripts/    verify, bridge smoke, Windows start
  docs/       architecture, protocol, verification, real-device-test
```

## License

GNU GPL version 3 only. Derivative of Reverse of Power. Not affiliated with Sony Interactive Entertainment or Wish Studios. No proprietary game assets.
