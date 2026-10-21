import { createHash, createPublicKey, verify, type KeyObject } from "node:crypto";
import { UPDATE_PUBLIC_KEY_SPKI_B64 } from "./config.ts";

export interface ReleaseManifest {
  version: string;
  asset: string;
  sha256: string;
  releasedAt?: string;
}

export function loadUpdatePublicKey(spkiB64: string = UPDATE_PUBLIC_KEY_SPKI_B64): KeyObject {
  return createPublicKey({
    key: Buffer.from(spkiB64, "base64"),
    format: "der",
    type: "spki",
  });
}

export function sha256Hex(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function canonicalManifestJson(manifest: ReleaseManifest): string {
  return `${JSON.stringify({
    version: manifest.version,
    asset: manifest.asset,
    sha256: manifest.sha256.toLowerCase(),
    releasedAt: manifest.releasedAt ?? "",
  })}\n`;
}

export function parseManifest(raw: string): ReleaseManifest {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (typeof parsed.version !== "string" || !parsed.version) throw new Error("manifest.version missing");
  if (typeof parsed.asset !== "string" || !parsed.asset) throw new Error("manifest.asset missing");
  if (typeof parsed.sha256 !== "string" || !/^[0-9a-fA-F]{64}$/.test(parsed.sha256)) {
    throw new Error("manifest.sha256 missing or invalid");
  }
  return {
    version: parsed.version,
    asset: parsed.asset,
    sha256: parsed.sha256.toLowerCase(),
    releasedAt: typeof parsed.releasedAt === "string" ? parsed.releasedAt : undefined,
  };
}

export function verifyManifestSignature(
  manifestBytes: Buffer,
  signatureB64: string,
  publicKey: KeyObject = loadUpdatePublicKey(),
): boolean {
  const signature = Buffer.from(signatureB64.trim(), "base64");
  if (signature.length !== 64) return false;
  return verify(null, manifestBytes, publicKey, signature);
}

export function assertPackageMatchesManifest(packageBytes: Buffer, manifest: ReleaseManifest): void {
  const digest = sha256Hex(packageBytes);
  if (digest !== manifest.sha256) {
    throw new Error(`package sha256 mismatch: expected ${manifest.sha256}, got ${digest}`);
  }
}
