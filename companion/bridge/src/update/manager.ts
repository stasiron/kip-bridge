import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { APP_VERSION, DEFAULT_UPDATE_OWNER, DEFAULT_UPDATE_REPO, UPDATE_PUBLIC_KEY_SPKI_B64 } from "./config.ts";
import {
  downloadBytes,
  fetchLatestStableRelease,
  pickWindowsUpdate,
  updateRepoConfigured,
  type AvailableUpdate,
  type GithubFetchOptions,
} from "./github.ts";
import {
  assertPackageMatchesManifest,
  canonicalManifestJson,
  loadUpdatePublicKey,
  parseManifest,
  verifyManifestSignature,
  type ReleaseManifest,
} from "./verify.ts";

export type UpdateState =
  | "idle"
  | "not_configured"
  | "checking"
  | "up_to_date"
  | "available"
  | "deferred"
  | "downloading"
  | "ready"
  | "waiting_for_sessions"
  | "installing"
  | "error";

export interface UpdateStatus {
  currentVersion: string;
  state: UpdateState;
  availableVersion?: string;
  releaseNotes?: string;
  progressPercent?: number;
  sessionsActive?: boolean;
  error?: string;
  repo?: string;
}

export interface UpdateManagerOptions {
  currentVersion?: string;
  owner?: string;
  repo?: string;
  publicKeySpkiB64?: string;
  installDir?: string;
  stagingDir?: string;
  github?: GithubFetchOptions;
  activeSessions?: () => number;
  /** Invoked when install is armed; default writes pending file and spawns apply. */
  requestRestart?: (pendingPath: string) => void;
}

export class UpdateManager {
  readonly currentVersion: string;
  private readonly owner: string;
  private readonly repo: string;
  private readonly publicKeySpkiB64: string;
  private readonly installDir: string;
  private readonly stagingDir: string;
  private readonly github: GithubFetchOptions;
  private readonly activeSessions: () => number;
  private readonly requestRestart: (pendingPath: string) => void;

  private state: UpdateState;
  private available: AvailableUpdate | null = null;
  private manifest: ReleaseManifest | null = null;
  private packagePath: string | null = null;
  private progressPercent = 0;
  private error: string | undefined;
  private busy = false;

  constructor(options: UpdateManagerOptions = {}) {
    this.installDir = options.installDir ?? path.resolve(process.cwd());
    const fileConfig = readUpdateConfigFile(this.installDir);
    this.currentVersion = options.currentVersion ?? APP_VERSION;
    this.owner = options.owner ?? fileConfig.owner ?? DEFAULT_UPDATE_OWNER;
    this.repo = options.repo ?? fileConfig.repo ?? DEFAULT_UPDATE_REPO;
    this.publicKeySpkiB64 =
      options.publicKeySpkiB64 ?? fileConfig.publicKeySpkiB64 ?? UPDATE_PUBLIC_KEY_SPKI_B64;
    this.stagingDir = options.stagingDir ?? path.join(os.tmpdir(), "kip-bridge-update");
    this.github = options.github ?? {};
    this.activeSessions = options.activeSessions ?? (() => 0);
    this.requestRestart = options.requestRestart ?? defaultRequestRestart;
    this.state = updateRepoConfigured(this.owner, this.repo) ? "idle" : "not_configured";
  }

  status(): UpdateStatus {
    const sessionsActive = this.activeSessions() > 0;
    const state =
      this.state === "ready" && sessionsActive
        ? "waiting_for_sessions"
        : this.state;
    return {
      currentVersion: this.currentVersion,
      state,
      availableVersion: this.available?.version,
      releaseNotes: this.available?.releaseNotes,
      progressPercent: this.state === "downloading" ? this.progressPercent : undefined,
      sessionsActive,
      error: this.error,
      repo: this.owner && this.repo ? `${this.owner}/${this.repo}` : undefined,
    };
  }

  /** Background check at startup. Never downloads. Failures stay non-fatal. */
  async checkInBackground(): Promise<void> {
    try {
      await this.check();
    } catch {
      // Startup must continue offline.
    }
  }

  async check(): Promise<UpdateStatus> {
    if (this.busy) return this.status();
    if (!updateRepoConfigured(this.owner, this.repo)) {
      this.state = "not_configured";
      this.error = "Set KIP_UPDATE_OWNER and KIP_UPDATE_REPO to a public GitHub repo that publishes signed releases.";
      return this.status();
    }
    this.busy = true;
    this.state = "checking";
    this.error = undefined;
    try {
      const release = await fetchLatestStableRelease({
        ...this.github,
        owner: this.owner,
        repo: this.repo,
      });
      if (!release) {
        this.state = "up_to_date";
        this.available = null;
        return this.status();
      }
      const update = pickWindowsUpdate(release, this.currentVersion);
      if (!update) {
        this.state = "up_to_date";
        this.available = null;
        return this.status();
      }
      this.available = update;
      this.state = "available";
      return this.status();
    } catch (error) {
      this.state = "error";
      this.error = error instanceof Error ? error.message : String(error);
      return this.status();
    } finally {
      this.busy = false;
    }
  }

  later(): UpdateStatus {
    if (this.state === "available" || this.state === "ready" || this.state === "waiting_for_sessions") {
      this.state = "deferred";
      this.packagePath = null;
      this.manifest = null;
      this.progressPercent = 0;
    }
    return this.status();
  }

  async download(confirm: boolean): Promise<UpdateStatus> {
    if (!confirm) {
      this.error = "Update download requires explicit confirmation.";
      return this.status();
    }
    if (this.busy) return this.status();
    if (!this.available || (this.state !== "available" && this.state !== "deferred" && this.state !== "error")) {
      this.error = "No update selected. Check for updates first.";
      return this.status();
    }
    this.busy = true;
    this.state = "downloading";
    this.progressPercent = 0;
    this.error = undefined;
    try {
      fs.mkdirSync(this.stagingDir, { recursive: true });
      const manifestBytes = await downloadBytes(this.available.manifestUrl, {
        ...this.github,
        onProgress: () => undefined,
      });
      const signatureText = (await downloadBytes(this.available.signatureUrl, { ...this.github })).toString("utf8");
      const publicKey = loadUpdatePublicKey(this.publicKeySpkiB64);
      if (!verifyManifestSignature(manifestBytes, signatureText, publicKey)) {
        throw new Error("manifest signature verification failed");
      }
      const manifest = parseManifest(manifestBytes.toString("utf8"));
      if (manifest.version !== this.available.version) {
        throw new Error(`manifest version ${manifest.version} does not match release ${this.available.version}`);
      }
      if (manifest.asset !== this.available.zipName) {
        throw new Error(`manifest asset ${manifest.asset} does not match ${this.available.zipName}`);
      }
      const canonical = Buffer.from(canonicalManifestJson(manifest), "utf8");
      // Publishers sign the canonical JSON. Accept the raw download only if it already is canonical.
      const signedOk =
        verifyManifestSignature(canonical, signatureText, publicKey) ||
        verifyManifestSignature(manifestBytes, signatureText, publicKey);
      if (!signedOk) {
        throw new Error("manifest signature verification failed");
      }
      const zipBytes = await downloadBytes(this.available.zipUrl, {
        ...this.github,
        timeoutMs: 120_000,
        onProgress: (received, total) => {
          this.progressPercent = total && total > 0 ? Math.min(99, Math.floor((received / total) * 100)) : 0;
        },
      });
      assertPackageMatchesManifest(zipBytes, manifest);
      const packagePath = path.join(this.stagingDir, manifest.asset);
      fs.writeFileSync(packagePath, zipBytes);
      fs.writeFileSync(path.join(this.stagingDir, "manifest.json"), canonicalManifestJson(manifest));
      this.manifest = manifest;
      this.packagePath = packagePath;
      this.progressPercent = 100;
      this.state = "ready";
      return this.status();
    } catch (error) {
      this.state = "error";
      this.error = error instanceof Error ? error.message : String(error);
      this.packagePath = null;
      this.manifest = null;
      return this.status();
    } finally {
      this.busy = false;
    }
  }

  async install(confirm: boolean): Promise<UpdateStatus> {
    if (!confirm) {
      this.error = "Install requires explicit confirmation.";
      return this.status();
    }
    if (this.busy) return this.status();
    if (this.state !== "ready" && this.state !== "waiting_for_sessions") {
      this.error = "No verified package ready to install.";
      return this.status();
    }
    if (this.activeSessions() > 0) {
      this.state = "waiting_for_sessions";
      this.error = "PlayLink sessions are active. Finish the game, then install.";
      return this.status();
    }
    if (!this.packagePath || !this.manifest) {
      this.error = "Missing staged package.";
      this.state = "error";
      return this.status();
    }
    this.busy = true;
    this.state = "installing";
    this.error = undefined;
    try {
      const pendingPath = path.join(this.installDir, "update-pending.json");
      const pending = {
        version: this.manifest.version,
        packagePath: this.packagePath,
        installDir: this.installDir,
        createdAt: new Date().toISOString(),
        pid: process.pid,
      };
      fs.writeFileSync(pendingPath, `${JSON.stringify(pending, null, 2)}\n`);
      this.requestRestart(pendingPath);
      return this.status();
    } catch (error) {
      this.state = "error";
      this.error = error instanceof Error ? error.message : String(error);
      return this.status();
    } finally {
      this.busy = false;
    }
  }
}

function readUpdateConfigFile(installDir: string): {
  owner?: string;
  repo?: string;
  publicKeySpkiB64?: string;
} {
  const configPath = path.join(installDir, "update-config.json");
  if (!fs.existsSync(configPath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as Record<string, unknown>;
    return {
      owner: typeof parsed.owner === "string" ? parsed.owner : undefined,
      repo: typeof parsed.repo === "string" ? parsed.repo : undefined,
      publicKeySpkiB64: typeof parsed.publicKeySpkiB64 === "string" ? parsed.publicKeySpkiB64 : undefined,
    };
  } catch {
    return {};
  }
}

function defaultRequestRestart(pendingPath: string): void {
  const applyJs = path.join(path.dirname(pendingPath), "update-apply.cjs");
  const nodePath = process.execPath;
  if (fs.existsSync(applyJs)) {
    const child = spawn(nodePath, [applyJs, pendingPath], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      cwd: path.dirname(pendingPath),
    });
    child.unref();
  }
  console.log(`[update] install armed (${pendingPath}). Restarting to apply.`);
  setTimeout(() => process.exit(42), 250);
}
