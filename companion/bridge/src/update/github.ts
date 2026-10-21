import {
  DEFAULT_UPDATE_OWNER,
  DEFAULT_UPDATE_REPO,
  GITHUB_API_BASE,
  UPDATE_CHECK_TIMEOUT_MS,
  manifestAssetName,
  manifestSigAssetName,
  releaseAssetName,
} from "./config.ts";
import { isNewerVersion, normalizeVersion } from "./semver.ts";

export interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface GithubRelease {
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  assets: GithubReleaseAsset[];
}

export interface AvailableUpdate {
  version: string;
  tagName: string;
  releaseNotes: string;
  zipUrl: string;
  manifestUrl: string;
  signatureUrl: string;
  zipName: string;
}

export class UpdateHttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "UpdateHttpError";
    this.status = status;
  }
}

export interface GithubFetchOptions {
  owner?: string;
  repo?: string;
  apiBase?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Optional token for private repos — supply only via env on a secured host, never hardcode. */
  token?: string;
}

export function updateRepoConfigured(owner = DEFAULT_UPDATE_OWNER, repo = DEFAULT_UPDATE_REPO): boolean {
  return Boolean(owner && repo);
}

export async function fetchLatestStableRelease(options: GithubFetchOptions = {}): Promise<GithubRelease | null> {
  const owner = options.owner ?? DEFAULT_UPDATE_OWNER;
  const repo = options.repo ?? DEFAULT_UPDATE_REPO;
  if (!updateRepoConfigured(owner, repo)) return null;
  const apiBase = options.apiBase ?? GITHUB_API_BASE;
  const timeoutMs = options.timeoutMs ?? UPDATE_CHECK_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${apiBase.replace(/\/$/, "")}/repos/${owner}/${repo}/releases?per_page=20`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "KIP-Bridge-Updater",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = options.token ?? process.env.KIP_GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { headers, signal: controller.signal });
    if (response.status === 403 || response.status === 429) {
      throw new UpdateHttpError(`GitHub rate limit or forbidden (${response.status})`, response.status);
    }
    if (response.status === 404) {
      throw new UpdateHttpError("GitHub repository or releases not found", 404);
    }
    if (!response.ok) {
      throw new UpdateHttpError(`GitHub releases failed (${response.status})`, response.status);
    }
    const releases = (await response.json()) as GithubRelease[];
    if (!Array.isArray(releases)) throw new UpdateHttpError("GitHub releases response was not a list", 500);
    return releases.find((release) => !release.draft && !release.prerelease) ?? null;
  } finally {
    clearTimeout(timer);
  }
}

export function pickWindowsUpdate(release: GithubRelease, currentVersion: string): AvailableUpdate | null {
  if (release.draft || release.prerelease) return null;
  const version = normalizeVersion(release.tag_name || release.name);
  if (!version || !isNewerVersion(version, currentVersion)) return null;
  const zipName = releaseAssetName(version);
  const manifestName = manifestAssetName(version);
  const sigName = manifestSigAssetName(version);
  const zip = release.assets.find((asset) => asset.name === zipName);
  const manifest = release.assets.find((asset) => asset.name === manifestName);
  const signature = release.assets.find((asset) => asset.name === sigName);
  if (!zip || !manifest || !signature) return null;
  return {
    version,
    tagName: release.tag_name,
    releaseNotes: release.body?.trim() ?? "",
    zipUrl: zip.browser_download_url,
    manifestUrl: manifest.browser_download_url,
    signatureUrl: signature.browser_download_url,
    zipName,
  };
}

export async function downloadBytes(
  url: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch; token?: string; onProgress?: (received: number, total: number | null) => void } = {},
): Promise<Buffer> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? UPDATE_CHECK_TIMEOUT_MS * 4;
  const headers: Record<string, string> = {
    Accept: "application/octet-stream",
    "User-Agent": "KIP-Bridge-Updater",
  };
  const token = options.token ?? process.env.KIP_GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { headers, signal: controller.signal, redirect: "follow" });
    if (!response.ok) throw new UpdateHttpError(`download failed (${response.status})`, response.status);
    const totalHeader = response.headers.get("content-length");
    const total = totalHeader ? Number(totalHeader) : null;
    if (!response.body || typeof response.body.getReader !== "function") {
      const buffer = Buffer.from(await response.arrayBuffer());
      options.onProgress?.(buffer.length, total);
      return buffer;
    }
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      chunks.push(chunk);
      received += chunk.length;
      options.onProgress?.(received, total);
    }
    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timer);
  }
}
