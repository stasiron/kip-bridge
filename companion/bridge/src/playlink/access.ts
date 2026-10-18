export function isDottedIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && String(Number(part)) === part && Number(part) <= 255);
}

export function normalizeIp(value: string): string {
  return value.startsWith("::ffff:") ? value.slice("::ffff:".length) : value;
}

export function isLoopbackAddress(value: string): boolean {
  const address = normalizeIp(value);
  return address === "127.0.0.1" || address === "::1";
}

/** Loopback, RFC1918, and link-local. Public addresses are rejected. */
export function isLocalNetworkAddress(value: string): boolean {
  const address = normalizeIp(value);
  if (address === "::1") return true;
  if (address.includes(":")) {
    const lower = address.toLowerCase();
    return lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd");
  }
  if (!isDottedIpv4(address)) return false;
  const [a, b] = address.split(".").map(Number);
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}
