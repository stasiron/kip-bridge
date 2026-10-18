const STORAGE_KEY = "kip.deviceUid";

function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return [...buffer].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Stable 32-hex device UID for reconnect identity. */
export function getOrCreateDeviceUid(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && /^[0-9a-f]{32}$/i.test(existing)) return existing.toLowerCase();
    const created = randomHex(16);
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return randomHex(16);
  }
}

export function rememberPlayerName(name: string): void {
  try {
    localStorage.setItem("kip.playerName", name);
  } catch {
    /* ignore */
  }
}

export function recalledPlayerName(): string {
  try {
    return localStorage.getItem("kip.playerName") ?? "";
  } catch {
    return "";
  }
}
