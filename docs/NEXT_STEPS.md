# Next steps

Do not start a second protocol stack. The simulator path for one browser player is already implemented.

## Milestone: Windows launcher a nontechnical person can start

Package the existing bridge and the static `web/out` export as a Windows executable. On start it must:

1. Listen on TCP 8787 and print the join code.
2. Print each `http://<lan-ipv4>:8787/` URL.
3. Show a QR code for that URL on the console, or in a window opened on the PC. The QR must be the LAN HTTP origin, not a public HTTPS URL.
4. Leave UDP 9060 unbound until a phone submits the join code.
5. Run without a separate Node.js install and without Vercel.

Keep the current codec and `PlayLinkSession`. Prefer Node's built-in single-executable support over a new language. If a QR library is required, read its license and source first and keep the result GPL-3.0-only. Add the executable smoke test from `docs/TEST_PLAN.md` in the same change.

Firewall prompt for Private networks (TCP 8787, UDP 9060) stays a manual Windows step. Document it next to the exe. Do not claim the prompt is solved.

## After that executable exists

Run `companion/docs/real-device-test.md` on a PS4 or PS5. Record PASS or FAIL in that file. Until then, README text must keep the UNVERIFIED line.

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

- No PlayStation in this environment.
- No git repository in this folder, so `.github/workflows/companion-verify.yml` has not run here.
- Guest Wi-Fi and client isolation will hide the PC from the phone even when the PC can see the console.
