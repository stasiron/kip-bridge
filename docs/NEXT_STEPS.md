# Next steps

Do not start a second protocol stack. The simulator path for one browser player is already implemented.

## Windows launcher

Done as a portable folder, not a single-file Node SEA. `npm run package:win` writes `companion/release/KIP-Bridge/` and `KIP-Bridge-windows.zip`. `KIP-Bridge.exe` is a WinForms host: Start/Stop, auto-starts the bundled `node.exe` + `bridge.cjs`, shows the join code, and opens loopback `GET /host` (SVG QR + code). Closing the window or pressing Stop kills the process tree. UDP 9060 stays closed until a valid join. `npm run test:exe` covers that smoke.

Firewall prompt for Private networks (TCP 8787, UDP 9060) stays a manual Windows step. `README.txt` in the folder says so (Polish + English). The program does not change adapter addresses.

## Updates (publisher)

Before the first auto-update works for users: create a public GitHub repo (or configure `KIP_UPDATE_OWNER`/`REPO`), generate an ed25519 key pair, embed the public key, store the private key as a CI secret, and publish a signed Release per `companion/docs/updates.md`. Do not embed a PAT in the client.

## After that executable exists

Run `companion/docs/real-device-test.md` on a PS4 or PS5. Record PASS or FAIL in that file. Until then, README text must keep the UNVERIFIED line. Confirm the first phone joins after the endpoint-pool fix (pool resync + APIPA skip + prefer LAN address).

Useful hardware order:

1. One phone, classic game, through name, avatar, one trivia question, one power play.
2. Lock the phone during a question. Confirm a single timeout answer and no second player slot on return.
3. One Android Reverse of Power phone on the same console.
4. Only if two iPhones are required: add a second host IPv4, capture both flows, and check `UDPPortOffset`.

## Explicitly later

- Retransmission after NACK. The Kotlin client has no replay buffer.
- A scheduled Decades time-sync loop.
- Quiz actions 15, 29, and 30.
- A name for holding-screen type 8.
- Photo masks and game audio. Do not download them.
- Deleting `web/vercel.json`. It is unused for play and already shipped as a launcher.

## Blockers that are not code

- No PlayStation in this environment. Simulator passes are not console passes.
- A local git repository exists and has no remote, so `.github/workflows/companion-verify.yml` has not run here.
- Guest Wi-Fi and client isolation will hide the PC from the phone even when the PC can see the console.
- A second browser player needs a second host IPv4, added by hand. See `companion/docs/multiplayer.md`. A PlayStation has not confirmed two addresses on one PC.
