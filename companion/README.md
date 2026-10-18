# Knowledge Is Power browser companion

A Windows program and a mobile web page for the original **Knowledge is Power** PlayLink game. The phone never speaks UDP. The PC bridge does.

**A real PS4 or PS5 has not been tested with this bridge.** Automated tests use captured fixtures and a simulator. Do not treat a green test run as console compatibility.

License: GPL-3.0-only. See `LICENSE` and `NOTICE`. Derived from [Reverse of Power](https://github.com/synchrone/reverse-of-power) commit `e9543047cd73cd93e1cbc59313a91f0f2c0f68cc`. No Sony or Wish Studios assets.

## Play (Windows, no Node.js install)

1. On a PC that has the source, run:

```powershell
cd companion
npm install
npm run package:win
```

2. Unzip `companion/release/KIP-Bridge-windows.zip`, or open the folder `companion/release/KIP-Bridge`.
3. Double-click `KIP-Bridge.exe`.
4. If Windows Firewall asks, allow it on **Private** networks (TCP **8787**, and UDP **9060** after a phone joins).
5. Read the **join code** in the window. Scan a QR code with the phone, or type one of the `http://` addresses into Safari or Chrome.
6. On the phone, enter the join code. Discover the console, or type its IP (Settings, Network). Pick a name and an avatar.
7. Close the bridge window to stop. UDP 9060 stays closed until the join code is accepted.

The QR code contains only the page URL. The join code is printed on the PC and on `http://127.0.0.1:8787/host`. It is not in `GET /api/status`.

One PC IPv4 address can carry one browser player. A second phone needs another address on the PC. This program does not change Windows network settings. Details: `docs/multiplayer.md`.

Guest Wi-Fi and client isolation hide the PC from the phone. Wake a sleeping console, then type its IP if Discover stays empty.

## Developer commands

Requires Node.js 22 or newer. From `companion/`:

| Command | What it does |
| --- | --- |
| `npm test` | Protocol fixtures, simulator sessions, host page, QR |
| `npm run typecheck` | Web and bridge TypeScript |
| `npm run verify` | Typecheck, tests, production build, Playwright (Chromium and WebKit), dev-server smoke |
| `npm run package:win` | Portable Windows folder and zip. Windows only |
| `npm run test:exe` | Starts `KIP-Bridge.exe`, checks the page, the host QR, and that UDP 9060 is still free |
| `npm start` | Dev bridge on port 8787. Needs `npm run build` first |

`npm run verify` does not build the exe. Run `npm run test:exe` after `npm run package:win`.

## Layout

```
companion/
  bridge/     PlayLink UDP, HTTP, WebSocket, host page
  web/        Mobile controller
  e2e/        Playwright against ConsoleSimulator
  scripts/    verify, package-win, exe smoke
  release/    Generated folder and zip (not committed)
```

The public Vercel export is still only a launcher. Gameplay is the LAN URL from the bridge.
