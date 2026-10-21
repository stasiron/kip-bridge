import assert from "node:assert/strict";
import { createHash, createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { compareSemver, isNewerVersion } from "./semver.ts";
import { UpdateManager } from "./manager.ts";
import {
  assertPackageMatchesManifest,
  canonicalManifestJson,
  loadUpdatePublicKey,
  parseManifest,
  sha256Hex,
  verifyManifestSignature,
} from "./verify.ts";
import { pickWindowsUpdate, type GithubRelease } from "./github.ts";

function keyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicSpkiB64: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    privateKey,
  };
}

function signCanonical(manifest: ReturnType<typeof parseManifest>, privateKey: ReturnType<typeof createPrivateKey>) {
  const canonical = canonicalManifestJson(manifest);
  return { canonical, signature: sign(null, Buffer.from(canonical, "utf8"), privateKey).toString("base64") };
}

test("semver compares stable releases", () => {
  assert.equal(isNewerVersion("1.0.3", "1.0.2"), true);
  assert.equal(isNewerVersion("1.0.2", "1.0.2"), false);
  assert.equal(isNewerVersion("1.0.1", "1.0.2"), false);
  assert.equal(compareSemver("v2.0.0", "1.9.9") > 0, true);
  assert.equal(isNewerVersion("1.0.3-beta", "1.0.3"), false);
});

test("manifest signature and package hash verify", () => {
  const keys = keyPair();
  const zip = Buffer.from("fake-zip-bytes");
  const manifest = parseManifest(
    canonicalManifestJson({
      version: "1.0.3",
      asset: "KIP-Bridge-windows-v1.0.3.zip",
      sha256: sha256Hex(zip),
      releasedAt: "2026-01-01T00:00:00.000Z",
    }),
  );
  const { canonical, signature } = signCanonical(manifest, keys.privateKey);
  assert.equal(verifyManifestSignature(Buffer.from(canonical, "utf8"), signature, loadUpdatePublicKey(keys.publicSpkiB64)), true);
  assert.equal(verifyManifestSignature(Buffer.from(canonical, "utf8"), "AAAA", loadUpdatePublicKey(keys.publicSpkiB64)), false);
  assertPackageMatchesManifest(zip, manifest);
  assert.throws(() => assertPackageMatchesManifest(Buffer.from("tampered"), manifest));
});

test("pickWindowsUpdate ignores drafts, prereleases, and older tags", () => {
  const release: GithubRelease = {
    tag_name: "v1.0.3",
    name: "1.0.3",
    body: "notes",
    draft: false,
    prerelease: false,
    assets: [
      { name: "KIP-Bridge-windows-v1.0.3.zip", browser_download_url: "https://example/zip", size: 1 },
      { name: "KIP-Bridge-v1.0.3.manifest.json", browser_download_url: "https://example/manifest", size: 1 },
      { name: "KIP-Bridge-v1.0.3.manifest.json.sig", browser_download_url: "https://example/sig", size: 1 },
    ],
  };
  assert.equal(pickWindowsUpdate(release, "1.0.3"), null);
  assert.equal(pickWindowsUpdate({ ...release, prerelease: true }, "1.0.2"), null);
  assert.equal(pickWindowsUpdate(release, "1.0.2")?.version, "1.0.3");
});

test("update manager: not configured, up to date, available, later, download, bad signature, sessions block install", async () => {
  const keys = keyPair();
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "kip-upd-"));
  const installDir = fs.mkdtempSync(path.join(os.tmpdir(), "kip-inst-"));
  const zip = Buffer.from("KIP-Bridge-windows-package");
  const manifestObj = {
    version: "1.0.3",
    asset: "KIP-Bridge-windows-v1.0.3.zip",
    sha256: createHash("sha256").update(zip).digest("hex"),
    releasedAt: "2026-01-02T00:00:00.000Z",
  };
  const { canonical, signature } = signCanonical(manifestObj, keys.privateKey);
  let sessions = 0;
  let restartCalls = 0;

  const files = new Map<string, Buffer>([
    ["https://example/manifest", Buffer.from(canonical, "utf8")],
    ["https://example/sig", Buffer.from(`${signature}\n`, "utf8")],
    ["https://example/zip", zip],
  ]);

  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("/releases")) {
      return new Response(
        JSON.stringify([
          {
            tag_name: "v1.0.3",
            name: "1.0.3",
            body: "bug fixes",
            draft: false,
            prerelease: false,
            assets: [
              { name: "KIP-Bridge-windows-v1.0.3.zip", browser_download_url: "https://example/zip", size: zip.length },
              { name: "KIP-Bridge-v1.0.3.manifest.json", browser_download_url: "https://example/manifest", size: 1 },
              { name: "KIP-Bridge-v1.0.3.manifest.json.sig", browser_download_url: "https://example/sig", size: 1 },
            ],
          },
        ]),
        { status: 200 },
      );
    }
    const body = files.get(url);
    if (!body) return new Response("missing", { status: 404 });
    return new Response(new Uint8Array(body), { status: 200, headers: { "content-length": String(body.length) } });
  };

  const blank = new UpdateManager({ owner: "", repo: "" });
  assert.equal((await blank.check()).state, "not_configured");

  const current = new UpdateManager({
    currentVersion: "1.0.3",
    owner: "acme",
    repo: "kip",
    publicKeySpkiB64: keys.publicSpkiB64,
    stagingDir,
    installDir,
    github: { fetchImpl },
    activeSessions: () => sessions,
    requestRestart: () => {
      restartCalls += 1;
    },
  });
  assert.equal((await current.check()).state, "up_to_date");

  const manager = new UpdateManager({
    currentVersion: "1.0.2",
    owner: "acme",
    repo: "kip",
    publicKeySpkiB64: keys.publicSpkiB64,
    stagingDir,
    installDir,
    github: { fetchImpl },
    activeSessions: () => sessions,
    requestRestart: () => {
      restartCalls += 1;
    },
  });

  assert.equal((await manager.check()).state, "available");
  assert.equal(manager.status().availableVersion, "1.0.3");
  assert.equal(manager.later().state, "deferred");

  assert.equal((await manager.download(false)).error?.includes("confirmation"), true);

  const offline = new UpdateManager({
    currentVersion: "1.0.2",
    owner: "acme",
    repo: "kip",
    github: {
      fetchImpl: async () => {
        throw new TypeError("network down");
      },
    },
  });
  assert.equal((await offline.check()).state, "error");

  await manager.check();
  const downloaded = await manager.download(true);
  assert.equal(downloaded.state, "ready");
  assert.equal(fs.existsSync(path.join(stagingDir, "KIP-Bridge-windows-v1.0.3.zip")), true);

  sessions = 1;
  const blocked = await manager.install(true);
  assert.equal(blocked.state, "waiting_for_sessions");
  assert.equal(restartCalls, 0);

  sessions = 0;
  const installed = await manager.install(true);
  assert.equal(installed.state, "installing");
  assert.equal(restartCalls, 1);
  assert.equal(fs.existsSync(path.join(installDir, "update-pending.json")), true);

  // Bad signature path
  const badFiles = new Map(files);
  badFiles.set("https://example/sig", Buffer.from("not-a-signature\n"));
  const bad = new UpdateManager({
    currentVersion: "1.0.2",
    owner: "acme",
    repo: "kip",
    publicKeySpkiB64: keys.publicSpkiB64,
    stagingDir: fs.mkdtempSync(path.join(os.tmpdir(), "kip-bad-")),
    installDir,
    github: {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("/releases")) {
          return fetchImpl(input);
        }
        const body = badFiles.get(url);
        if (!body) return new Response("missing", { status: 404 });
        return new Response(new Uint8Array(body), { status: 200 });
      },
    },
  });
  await bad.check();
  const failed = await bad.download(true);
  assert.equal(failed.state, "error");
  assert.match(String(failed.error), /signature/);

  // Corrupted zip after signed manifest
  const corruptFiles = new Map(files);
  corruptFiles.set("https://example/zip", Buffer.from("corrupted"));
  const corrupt = new UpdateManager({
    currentVersion: "1.0.2",
    owner: "acme",
    repo: "kip",
    publicKeySpkiB64: keys.publicSpkiB64,
    stagingDir: fs.mkdtempSync(path.join(os.tmpdir(), "kip-cor-")),
    installDir,
    github: {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("/releases")) return fetchImpl(input);
        const body = corruptFiles.get(url);
        if (!body) return new Response("missing", { status: 404 });
        return new Response(new Uint8Array(body), { status: 200 });
      },
    },
  });
  await corrupt.check();
  const corruptResult = await corrupt.download(true);
  assert.equal(corruptResult.state, "error");
  assert.match(String(corruptResult.error), /sha256/);
});

test("repeated checks stay stable when already up to date", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify([]), { status: 200 });
  const manager = new UpdateManager({
    currentVersion: "1.0.2",
    owner: "acme",
    repo: "kip",
    github: { fetchImpl },
  });
  assert.equal((await manager.check()).state, "up_to_date");
  assert.equal((await manager.check()).state, "up_to_date");
});
