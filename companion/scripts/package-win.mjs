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
fs.copyFileSync(path.join(root, "scripts", "update-apply.cjs"), path.join(outDir, "update-apply.cjs"));
fs.writeFileSync(
  path.join(outDir, "VERSION.txt"),
  `${process.env.KIP_BRIDGE_VERSION ?? "1.0.2"}\n`,
  "utf8",
);
const updateOwner = process.env.KIP_UPDATE_OWNER ?? "";
const updateRepo = process.env.KIP_UPDATE_REPO ?? "";
fs.writeFileSync(
  path.join(outDir, "update-config.json"),
  `${JSON.stringify({ owner: updateOwner, repo: updateRepo, publicKeySpkiB64: process.env.KIP_UPDATE_PUBLIC_KEY_SPKI_B64 ?? null }, null, 2)}\n`,
  "utf8",
);

const nodeLicense = path.join(path.dirname(process.execPath), "LICENSE");
if (fs.existsSync(nodeLicense)) fs.copyFileSync(nodeLicense, path.join(outDir, "NODE-LICENSE.txt"));

console.log("Compiling KIP-Bridge.exe...");
const launcherExe = path.join(outDir, "KIP-Bridge.exe");
const tempExe = path.join(os.tmpdir(), "KIP-Bridge-launcher.exe");
run(csc, [
  "/nologo",
  "/target:winexe",
  "/r:System.Windows.Forms.dll",
  "/r:System.Drawing.dll",
  `/out:${tempExe}`,
  path.join(root, "scripts", "launcher.cs"),
], root);
fs.copyFileSync(tempExe, launcherExe);

const readme = `Knowledge Is Power — most na PC
GPL-3.0-only. Nie jest powiązany z Sony Interactive Entertainment ani Wish Studios.

Gra na prawdziwej PlayStation jest UNVERIFIED, dopóki sam tego nie sprawdzisz.

Start (bez programowania)
1. Rozpakuj cały folder. Nie wyciągaj samego pliku exe.
2. Kliknij dwukrotnie KIP-Bridge.exe. Nie instaluj Node.js.
3. Okno pokaże kod. Przeglądarka otworzy stronę z QR (http://127.0.0.1:8787/host).
4. Jeśli Windows Firewall zapyta — zezwól na sieci prywatne (Private).
5. Telefon: ten sam Wi‑Fi co konsola. Zeskanuj QR albo wpisz adres http:// z strony hosta.
6. Na telefonie wpisz kod i IP PlayStation (albo Discover).
7. Wyłącz: przycisk Wyłącz albo zamknij okno mostu. Port UDP 9060 otwiera się dopiero po poprawnym dołączeniu.

Jeden adres IPv4 na PC = jeden gracz w przeglądarce. Drugi telefon wymaga drugiego adresu IPv4 na PC. Ten program nie zmienia ustawień sieci Windows.

Aktualizacje: strona hosta (Check for Updates). Pobieranie tylko po Update Now. Wymaga publicznego GitHub Release z podpisanym manifestem — patrz companion/docs/updates.md.

English
Double-click KIP-Bridge.exe. Allow Private networks if Windows asks. Read the join code in the app or on http://127.0.0.1:8787/host. Press Wyłącz (Stop) or close the window to stop.
Updates never download until you confirm on the host page.

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
