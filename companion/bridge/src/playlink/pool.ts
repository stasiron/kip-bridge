import os from "node:os";
import { isDottedIpv4, isLocalNetworkAddress, normalizeIp } from "./access.ts";

export type IpFamily = string | number;

export interface Ipv4Candidate {
  family: IpFamily;
  internal: boolean;
  address: string;
}

export interface AcquireHints {
  /** Address the phone already reached (WebSocket localAddress). */
  preferred?: string;
  /** Console IPv4; prefer a host address on the same /24. */
  consoleHost?: string;
  /** Skip these for this join attempt (bind failed). */
  exclude?: ReadonlySet<string>;
}

export interface PoolDiagnostics {
  scanned: string[];
  playable: string[];
  used: string[];
  free: string[];
  skippedLinkLocal: string[];
  skippedOther: string[];
}

/** True for IPv4 entries from os.networkInterfaces (string or numeric family). */
export function isIpv4Family(family: IpFamily): boolean {
  return family === "IPv4" || family === 4;
}

/** Link-local APIPA. Phones may use it for HTTP; PlayStation on home Wi-Fi cannot. */
export function isLinkLocalIpv4(address: string): boolean {
  if (!isDottedIpv4(address)) return false;
  const [a, b] = address.split(".").map(Number);
  return a === 169 && b === 254;
}

export function sameIpv4Slash24(left: string, right: string): boolean {
  if (!isDottedIpv4(left) || !isDottedIpv4(right)) return false;
  const a = left.split(".");
  const b = right.split(".");
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/**
 * Non-loopback RFC1918 IPv4 addresses suitable for a PlayLink UDP 9060 socket.
 * Loopback, public, CGNAT (100.64/10), and link-local (169.254/16) are omitted.
 */
export function playerIpv4Addresses(entries: readonly Ipv4Candidate[]): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!isIpv4Family(entry.family) || entry.internal) continue;
    const address = normalizeIp(entry.address);
    if (!isDottedIpv4(address)) continue;
    if (isLinkLocalIpv4(address)) continue;
    // isLocalNetworkAddress allows 169.254 (HTTP peers); PlayLink skips it above.
    // CGNAT 100.64/10 is rejected here.
    if (!isLocalNetworkAddress(address)) continue;
    if (seen.has(address)) continue;
    seen.add(address);
    found.push(address);
  }
  return found;
}

export function enumerateIpv4Candidates(): Ipv4Candidate[] {
  const entries: Ipv4Candidate[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const entry of list ?? []) {
      entries.push({
        family: entry.family,
        internal: entry.internal,
        address: entry.address,
      });
    }
  }
  return entries;
}

export function lanIpv4Addresses(): string[] {
  return playerIpv4Addresses(enumerateIpv4Candidates());
}

export function describeAddressScan(entries: readonly Ipv4Candidate[] = enumerateIpv4Candidates()): PoolDiagnostics {
  const scanned: string[] = [];
  const skippedLinkLocal: string[] = [];
  const skippedOther: string[] = [];
  for (const entry of entries) {
    if (!isIpv4Family(entry.family) || entry.internal) continue;
    const address = normalizeIp(entry.address);
    if (!isDottedIpv4(address)) continue;
    scanned.push(address);
    if (isLinkLocalIpv4(address)) {
      skippedLinkLocal.push(address);
      continue;
    }
    if (!isLocalNetworkAddress(address)) {
      skippedOther.push(address);
    }
  }
  const playable = playerIpv4Addresses(entries);
  return {
    scanned,
    playable,
    used: [],
    free: [...playable],
    skippedLinkLocal,
    skippedOther,
  };
}

function scoreAddress(address: string, hints: AcquireHints): number {
  let score = 0;
  const preferred = hints.preferred ? normalizeIp(hints.preferred) : "";
  const consoleHost = hints.consoleHost ? normalizeIp(hints.consoleHost) : "";
  if (preferred && address === preferred) score += 100;
  if (consoleHost && sameIpv4Slash24(address, consoleHost)) score += 50;
  // Prefer common home LAN ranges over Hyper-V 172.16–31 virtual switches.
  const [a, b] = address.split(".").map(Number);
  if (a === 192 && b === 168) score += 20;
  if (a === 10) score += 15;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) score += 5;
  return score;
}

export class EndpointPool {
  private readonly used = new Set<string>();
  private addresses: string[];

  constructor(addresses: readonly string[] = []) {
    this.addresses = dedupe(addresses);
  }

  get size(): number {
    return this.addresses.length;
  }

  list(): readonly string[] {
    return this.addresses;
  }

  free(): number {
    return this.addresses.filter((address) => !this.used.has(address)).length;
  }

  /**
   * Replace the candidate list with a fresh scan. Keeps occupancy for addresses
   * that still exist. Drops used marks for addresses that disappeared.
   */
  resync(addresses: readonly string[]): void {
    this.addresses = dedupe(addresses);
    for (const address of [...this.used]) {
      if (!this.addresses.includes(address)) this.used.delete(address);
    }
  }

  diagnostics(): PoolDiagnostics {
    const scan = describeAddressScan();
    return {
      ...scan,
      playable: [...this.addresses],
      used: this.addresses.filter((address) => this.used.has(address)),
      free: this.addresses.filter((address) => !this.used.has(address)),
    };
  }

  acquire(hints: AcquireHints = {}): string | null {
    const exclude = hints.exclude ?? new Set<string>();
    const free = this.addresses
      .filter((address) => !this.used.has(address) && !exclude.has(address))
      .sort((left, right) => scoreAddress(right, hints) - scoreAddress(left, hints));
    const next = free[0];
    if (!next) return null;
    this.used.add(next);
    return next;
  }

  release(address: string): void {
    this.used.delete(address);
  }

  /** True when this address is currently reserved for a session. */
  isUsed(address: string): boolean {
    return this.used.has(address);
  }
}

function dedupe(addresses: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of addresses) {
    const address = normalizeIp(raw);
    if (!isDottedIpv4(address) || seen.has(address)) continue;
    seen.add(address);
    out.push(address);
  }
  return out;
}
