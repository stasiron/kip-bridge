import os from "node:os";

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

/** Non-loopback IPv4 addresses. A console cannot answer 127.0.0.1. */
export function lanIpv4Addresses(): string[] {
  const found: string[] = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) found.push(entry.address);
    }
  }
  return found;
}
