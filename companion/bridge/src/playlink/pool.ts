import os from "node:os";
import { isLocalNetworkAddress } from "./access.ts";

export class EndpointPool {
  private readonly used = new Set<string>();
  private readonly addresses: readonly string[];

  constructor(addresses: readonly string[]) {
    this.addresses = addresses;
  }

  get size(): number {
    return this.addresses.length;
  }

  free(): number {
    return this.addresses.filter((address) => !this.used.has(address)).length;
  }

  acquire(): string | null {
    const next = this.addresses.find((address) => !this.used.has(address));
    if (!next) return null;
    this.used.add(next);
    return next;
  }

  release(address: string): void {
    this.used.delete(address);
  }
}

export interface Ipv4Candidate {
  family: string;
  internal: boolean;
  address: string;
}

/**
 * Non-loopback private IPv4 addresses. A console cannot answer 127.0.0.1.
 * Shared CGNAT space such as 100.64.0.0/10 is omitted: the HTTP guard rejects
 * it, and a PlayStation on the home LAN cannot send replies there.
 */
export function playerIpv4Addresses(entries: readonly Ipv4Candidate[]): string[] {
  const found: string[] = [];
  for (const entry of entries) {
    if (entry.family !== "IPv4" || entry.internal) continue;
    if (!isLocalNetworkAddress(entry.address)) continue;
    found.push(entry.address);
  }
  return found;
}

export function lanIpv4Addresses(): string[] {
  const entries: Ipv4Candidate[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const entry of list ?? []) entries.push(entry);
  }
  return playerIpv4Addresses(entries);
}
