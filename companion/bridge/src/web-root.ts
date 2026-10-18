import fs from "node:fs";
import path from "node:path";

/** Static export used by the dev server, or the `web` folder beside a packaged bridge. */
export function resolveWebRoot(): string {
  const override = process.env.KIP_WEB_ROOT;
  if (override && override.length > 0) return path.resolve(override);
  const besideScript = path.join(path.dirname(process.argv[1] ?? ""), "web");
  if (fs.existsSync(path.join(besideScript, "index.html"))) return besideScript;
  const besideRuntime = path.join(path.dirname(process.execPath), "web");
  if (fs.existsSync(path.join(besideRuntime, "index.html"))) return besideRuntime;
  return path.resolve(import.meta.dirname, "../../web/out");
}
