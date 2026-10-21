# KIP-Bridge GitHub updates

Updates are optional and never download or install without an explicit click on the loopback host page (`http://127.0.0.1:8787/host`).

## What ships in the client

- Embedded semver (`APP_VERSION` in `bridge/src/update/config.ts`, also `VERSION.txt` in the Windows folder).
- An ed25519 **public** key used to verify release manifests.
- `update-apply.cjs`, run only after the user confirms install and no PlayLink session is active.

The client does **not** contain a GitHub personal access token. Public repositories work with anonymous API calls. Private repositories need a token only on a publisher-controlled machine (or a release proxy you host). Do not embed a PAT in the zip.

## Configure the release repository

This workspace often has no git remote. Set the public repo that will host Releases:

```text
KIP_UPDATE_OWNER=your-github-user
KIP_UPDATE_REPO=your-repo
```

Bake them into a package with the same env vars when running `npm run package:win`. They are written to `update-config.json` for operators. Runtime also reads `KIP_UPDATE_OWNER` / `KIP_UPDATE_REPO`.

Until both are set, the host page reports `not_configured` and continues normally.

## Publisher signing key

Generate an ed25519 key pair once. Keep the private key in CI secrets only.

```bash
node -e "const {generateKeyPairSync}=require('crypto'); const k=generateKeyPairSync('ed25519'); console.log(k.publicKey.export({type:'spki',format:'der'}).toString('base64')); console.log(k.privateKey.export({type:'pkcs8',format:'der'}).toString('base64'));"
```

Put the public SPKI base64 into `UPDATE_PUBLIC_KEY_SPKI_B64` (or `KIP_UPDATE_PUBLIC_KEY_SPKI_B64` at package time). Store the private PKCS8 base64 as `KIP_UPDATE_PRIVATE_KEY_PKCS8_B64` for signing. Never commit the private key.

## Publish a release (manual; do not automate from this agent)

1. Bump `APP_VERSION` in `bridge/src/update/config.ts`.
2. From `companion/`: `npm run package:win` (optionally with `KIP_BRIDGE_VERSION`, `KIP_UPDATE_OWNER`, `KIP_UPDATE_REPO`).
3. Sign the zip:

```bash
set KIP_UPDATE_PRIVATE_KEY_PKCS8_B64=...
node scripts/sign-release.mjs --zip release/KIP-Bridge-windows.zip --version 1.0.3 --out release/
```

4. Create a GitHub **Release** (not a draft, not a prerelease) tagged `v1.0.3`.
5. Upload these three assets with exact names:
   - `KIP-Bridge-windows-v1.0.3.zip`
   - `KIP-Bridge-v1.0.3.manifest.json`
   - `KIP-Bridge-v1.0.3.manifest.json.sig`

A checksum alone next to the zip is not enough. The client requires the ed25519 signature over the canonical manifest, then checks the zip sha256 from that trusted manifest.

## Client behaviour

1. Startup may check GitHub in the background. Failures are silent for play.
2. Newer stable release → host page offers **Update Now** / **Later**.
3. **Later** closes the prompt; no download. Next launch may check again.
4. **Update Now** downloads the manifest, verifies the signature, downloads the zip, verifies sha256.
5. **Install & Restart** runs only when `sessions.active === 0`. Otherwise the UI says the update is waiting.
6. Install writes `update-pending.json`, spawns `update-apply.cjs`, and exits the bridge process so files can be replaced.

## Limits

- Simulator and unit tests are not a real GitHub update proof.
- Downgrade is refused (`isNewerVersion`).
- One PlayLink player still needs one host IPv4 + UDP 9060; updates do not change that.
