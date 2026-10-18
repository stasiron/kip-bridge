import path from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
};

export function contentType(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * Map a URL path onto a file inside `root`.
 * Returns null when the path escapes the root or is not a valid encoding.
 * `/` maps to `index.html`. This function does not check that the file exists.
 */
export function resolveStatic(root: string, urlPath: string): string | null {
  const queryStripped = urlPath.split("?")[0] ?? "/";
  let pathname: string;
  try {
    pathname = decodeURIComponent(queryStripped);
  } catch {
    return null;
  }
  if (pathname.includes("\0")) return null;

  const rootResolved = path.resolve(root);
  const trimmed = pathname.replace(/^\/+/, "");
  const wantsIndex = trimmed === "" || trimmed.endsWith("/");
  const relative = wantsIndex ? `${trimmed}index.html` : trimmed;
  const candidate = path.resolve(rootResolved, relative);
  if (!isInside(rootResolved, candidate)) return null;
  return candidate;
}
