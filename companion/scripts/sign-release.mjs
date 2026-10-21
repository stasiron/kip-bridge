/**
 * Build a signed update manifest for a Windows zip.
 *
 * Env:
 *   KIP_UPDATE_PRIVATE_KEY_PKCS8_B64  required (pkcs8 DER base64 ed25519)
 *
 * Usage:
 *   node scripts/sign-release.mjs --zip release/KIP-Bridge-windows.zip --version 1.0.3 --out release/
 *
 * Does not publish. Upload the zip, manifest, and .sig as GitHub Release assets.
 */
import { createHash, createPrivateKey, sign } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const zipPath = path.resolve(arg("--zip") ?? path.join(root, "release", "KIP-Bridge-windows.zip"));
const version = (arg("--version") ?? "").replace(/^v/, "");
const outDir = path.resolve(arg("--out") ?? path.join(root, "release"));
const privateB64 = process.env.KIP_UPDATE_PRIVATE_KEY_PKCS8_B64;

if (!version) {
  console.error("Pass --version X.Y.Z");
  process.exit(1);
}
if (!privateB64) {
  console.error("Set KIP_UPDATE_PRIVATE_KEY_PKCS8_B64 to the publisher private key (never commit it).");
  process.exit(1);
}
if (!fs.existsSync(zipPath)) {
  console.error(`Zip not found: ${zipPath}`);
  process.exit(1);
}

const zipBytes = fs.readFileSync(zipPath);
const sha256 = createHash("sha256").update(zipBytes).digest("hex");
const asset = `KIP-Bridge-windows-v${version}.zip`;
const manifest = {
  version,
  asset,
  sha256,
  releasedAt: new Date().toISOString(),
};
const canonical = `${JSON.stringify({
  version: manifest.version,
  asset: manifest.asset,
  sha256: manifest.sha256,
  releasedAt: manifest.releasedAt,
})}\n`;

const key = createPrivateKey({
  key: Buffer.from(privateB64, "base64"),
  format: "der",
  type: "pkcs8",
});
const signature = sign(null, Buffer.from(canonical, "utf8"), key).toString("base64");

fs.mkdirSync(outDir, { recursive: true });
const versionedZip = path.join(outDir, asset);
if (path.resolve(zipPath) !== path.resolve(versionedZip)) {
  fs.copyFileSync(zipPath, versionedZip);
}
const manifestPath = path.join(outDir, `KIP-Bridge-v${version}.manifest.json`);
const sigPath = `${manifestPath}.sig`;
fs.writeFileSync(manifestPath, canonical);
fs.writeFileSync(sigPath, `${signature}\n`);

console.log(`Wrote ${versionedZip}`);
console.log(`Wrote ${manifestPath}`);
console.log(`Wrote ${sigPath}`);
console.log("Upload all three as GitHub Release assets. Do not publish the private key.");
