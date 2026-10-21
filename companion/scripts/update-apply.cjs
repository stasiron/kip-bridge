/**
 * Detached updater. Waits for the bridge PID to exit, extracts the staged zip
 * into the install folder, then relaunches KIP-Bridge.exe when present.
 *
 * Usage: node update-apply.cjs <update-pending.json>
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");
const os = require("node:os");

const pendingPath = process.argv[2];
if (!pendingPath) {
  console.error("usage: node update-apply.cjs <update-pending.json>");
  process.exit(1);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  if (process.platform === "win32") {
    const ps = `
$ErrorActionPreference = 'Stop'
Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force
`;
    execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], { stdio: "inherit" });
    return;
  }
  execFileSync("tar", ["-xf", zipPath, "-C", destDir], { stdio: "inherit" });
}

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

function findStagedRoot(extractDir) {
  const direct = path.join(extractDir, "KIP-Bridge");
  if (fs.existsSync(path.join(direct, "bridge.cjs"))) return direct;
  if (fs.existsSync(path.join(extractDir, "bridge.cjs"))) return extractDir;
  const kids = fs.readdirSync(extractDir);
  for (const name of kids) {
    const candidate = path.join(extractDir, name);
    if (fs.existsSync(path.join(candidate, "bridge.cjs"))) return candidate;
  }
  throw new Error("staged zip did not contain bridge.cjs");
}

async function main() {
  const pending = JSON.parse(fs.readFileSync(pendingPath, "utf8"));
  const pid = Number(pending.pid);
  const installDir = pending.installDir;
  const packagePath = pending.packagePath;
  const deadline = Date.now() + 60_000;
  while (Number.isInteger(pid) && pid > 0 && pidAlive(pid) && Date.now() < deadline) {
    sleep(200);
  }
  sleep(500);

  const extractDir = path.join(os.tmpdir(), `kip-bridge-extract-${Date.now()}`);
  try {
    extractZip(packagePath, extractDir);
    const staged = findStagedRoot(extractDir);
    const preserve = new Set(["update-pending.json"]);
    for (const name of fs.readdirSync(staged)) {
      if (preserve.has(name)) continue;
      const src = path.join(staged, name);
      const dst = path.join(installDir, name);
      if (fs.statSync(src).isDirectory()) {
        fs.rmSync(dst, { recursive: true, force: true });
        copyTree(src, dst);
      } else {
        // Avoid clobbering the running launcher if Windows still locks it; copy beside then swap.
        const tmp = `${dst}.new`;
        fs.copyFileSync(src, tmp);
        try {
          fs.renameSync(tmp, dst);
        } catch {
          fs.copyFileSync(tmp, dst);
          fs.rmSync(tmp, { force: true });
        }
      }
    }
    fs.rmSync(pendingPath, { force: true });
    const exe = path.join(installDir, "KIP-Bridge.exe");
    if (fs.existsSync(exe)) {
      const child = spawn(exe, [], { detached: true, stdio: "ignore", cwd: installDir, windowsHide: false });
      child.unref();
    }
  } finally {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
