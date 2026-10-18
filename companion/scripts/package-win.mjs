/**
 * Build a portable Windows folder and zip. End users do not install Node.js.
 * The folder contains a private node.exe, the bundled bridge, and the static page.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "..");
const outDir = path.join(root, "release", "KIP-Bridge");
const zipPath = path.join(root, "release", "KIP-Bridge-windows.zip");
const csc = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe";

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status}`);
  }
}

function copyTree(from, to) {
  fs.cpSync(from, to, { recursive: true });
}

if (process.platform !== "win32") {
  console.error("package:win produces a Windows folder. Run it on Windows.");
  process.exit(1);
}
if (!fs.existsSync(csc)) {
  console.error(`C# compiler not found at ${csc}. The .NET Framework compiler ships with Windows.`);
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

console.log("Building the static controller...");
run("cmd.exe", ["/d", "/s", "/c", "npm run build"], root);

const webOut = path.join(root, "web", "out");
if (!fs.existsSync(path.join(webOut, "index.html"))) {
  throw new Error("web/out/index.html is missing after the frontend build");
}

console.log("Bundling the bridge...");
await esbuild.build({
  entryPoints: [path.join(root, "bridge", "src", "index.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: path.join(outDir, "bridge.cjs"),
  external: ["bufferutil", "utf-8-validate"],
  legalComments: "eof",
  banner: { js: "/* Knowledge Is Power browser bridge. GPL-3.0-only. */" },
  plugins: [{
    name: "cjs-import-meta",
    setup(build) {
      build.onLoad({ filter: /\.ts$/ }, async (args) => {
        const contents = (await fs.promises.readFile(args.path, "utf8"))
          .replaceAll("import.meta.filename", "__filename")
          .replaceAll("import.meta.dirname", "__dirname");
        return { contents, loader: "ts" };
      });
    },
  }],
});

copyTree(webOut, path.join(outDir, "web"));
fs.copyFileSync(process.execPath, path.join(outDir, "node.exe"));
fs.copyFileSync(path.join(root, "LICENSE"), path.join(outDir, "LICENSE"));
fs.copyFileSync(path.join(root, "NOTICE"), path.join(outDir, "NOTICE"));

const nodeLicense = path.join(path.dirname(process.execPath), "LICENSE");
if (fs.existsSync(nodeLicense)) fs.copyFileSync(nodeLicense, path.join(outDir, "NODE-LICENSE.txt"));

console.log("Compiling KIP-Bridge.exe...");
const launcherExe = path.join(outDir, "KIP-Bridge.exe");
const tempExe = path.join(os.tmpdir(), "KIP-Bridge-launcher.exe");
run(csc, ["/nologo", "/target:exe", `/out:${tempExe}`, path.join(root, "scripts", "launcher.cs")], root);
fs.copyFileSync(tempExe, launcherExe);

const readme = `Knowledge Is Power browser bridge
GPL-3.0-only. Not affiliated with Sony Interactive Entertainment or Wish Studios.

Play on a real PlayStation is UNVERIFIED until you try it yourself.

Start
1. Unzip this folder. Keep every file together.
2. Double-click KIP-Bridge.exe. Do not install Node.js.
3. If Windows Firewall asks, allow it on Private networks.
4. Read the join code in the window. Scan a QR code with the phone, or type the http:// address.
5. On the phone, enter the join code and the PlayStation IP (or press Discover).
6. Close the window to stop. UDP port 9060 opens only after a valid join.

One PC address can carry one browser player. A second phone needs a second IPv4 address on the PC. This program does not change Windows network settings.

Source for this build is the companion directory in the project that created the zip, plus Reverse of Power commit e9543047cd73cd93e1cbc59313a91f0f2c0f68cc (${repoRoot}).
The private node.exe runtime is covered by NODE-LICENSE.txt.
`;
fs.writeFileSync(path.join(outDir, "README.txt"), readme, "utf8");

if (fs.existsSync(zipPath)) fs.rmSync(zipPath);
run("powershell.exe", [
  "-NoProfile",
  "-Command",
  `Compress-Archive -LiteralPath '${outDir}' -DestinationPath '${zipPath}' -Force`,
], root);

const exe = fs.statSync(path.join(outDir, "KIP-Bridge.exe"));
const zip = fs.statSync(zipPath);
console.log(`Folder: ${outDir}`);
console.log(`Launcher: ${exe.size} bytes`);
console.log(`Zip: ${zipPath} (${zip.size} bytes)`);
