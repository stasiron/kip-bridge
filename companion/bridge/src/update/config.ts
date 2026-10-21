/**
 * GitHub release update settings.
 *
 * Public repos work with anonymous API calls. Private repos need a token on a
 * machine the publisher controls — never ship a personal access token inside
 * the client. Override owner/repo via env or packaged update-config.json.
 */

/** Semver of this build. Bump when packaging a release. */
export const APP_VERSION = "1.0.3";

export const DEFAULT_UPDATE_OWNER = process.env.KIP_UPDATE_OWNER ?? "stasiron";
export const DEFAULT_UPDATE_REPO = process.env.KIP_UPDATE_REPO ?? "kip-bridge";

/**
 * SPKI DER (base64) ed25519 public key that must sign release manifests.
 * Replace when rotating keys. The matching private key stays with the publisher
 * (CI secret). Never embed the private key in the client.
 */
export const UPDATE_PUBLIC_KEY_SPKI_B64 =
  process.env.KIP_UPDATE_PUBLIC_KEY_SPKI_B64 ??
  "MCowBQYDK2VwAyEA9og+hVv0IPxdtjSigTaeUL5m3yEl5wbv36rReh2TySw=";

export const GITHUB_API_BASE = process.env.KIP_GITHUB_API_BASE ?? "https://api.github.com";
export const UPDATE_CHECK_TIMEOUT_MS = Number(process.env.KIP_UPDATE_TIMEOUT_MS ?? 8000);
export const UPDATE_ASSET_NAME_PREFIX = "KIP-Bridge-windows";

export function releaseAssetName(version: string): string {
  const v = version.startsWith("v") ? version.slice(1) : version;
  return `${UPDATE_ASSET_NAME_PREFIX}-v${v}.zip`;
}

export function manifestAssetName(version: string): string {
  const v = version.startsWith("v") ? version.slice(1) : version;
  return `KIP-Bridge-v${v}.manifest.json`;
}

export function manifestSigAssetName(version: string): string {
  return `${manifestAssetName(version)}.sig`;
}
