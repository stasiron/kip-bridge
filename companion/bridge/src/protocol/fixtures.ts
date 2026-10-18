import fs from "node:fs";
import path from "node:path";

function findClose(source: string, openIndex: number): number {
  let depth = 1;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error("unclosed bytes() in fixture file");
}

function stripComments(source: string): string {
  return source.replace(/\/\/[^\n]*/g, " ");
}

export function parseKotlinByteFunctions(source: string): Map<string, Buffer> {
  const packets = new Map<string, Buffer>();
  const stripped = stripComments(source);
  const pattern = /fun\s+(\w+)\s*\([^)]*\)\s*=\s*bytes\s*\(/g;
  for (const match of stripped.matchAll(pattern)) {
    const name = match[1]!;
    const open = match.index! + match[0].length;
    const close = findClose(stripped, open);
    const body = stripped.slice(open, close);
    const values = [...body.matchAll(/0x[0-9a-fA-F]+|\b\d+\b/g)].map((item) => Number(item[0]) & 0xff);
    packets.set(name, Buffer.from(values));
  }
  return packets;
}

export function parseKotlinLists(source: string, packets: Map<string, Buffer>): Map<string, Buffer[]> {
  const lists = new Map<string, Buffer[]>();
  const stripped = stripComments(source);
  const pattern = /fun\s+(\w+)\s*\([^)]*\)\s*=\s*listOf\s*\(/g;
  for (const match of stripped.matchAll(pattern)) {
    const name = match[1]!;
    const open = match.index! + match[0].length;
    const close = findClose(stripped, open);
    const body = stripped.slice(open, close);
    const chunks: Buffer[] = [];
    for (const call of body.matchAll(/(\w+)\s*\(\s*\)/g)) {
      const chunk = packets.get(call[1]!);
      if (!chunk) throw new Error(`${name} references missing ${call[1]}`);
      chunks.push(chunk);
    }
    lists.set(name, chunks);
  }
  return lists;
}

export function loadUdpPacketFixtures(sourcePath?: string): { packets: Map<string, Buffer>; lists: Map<string, Buffer[]> } {
  const candidates = [
    sourcePath,
    path.resolve(import.meta.dirname, "../../../../_reference/reverse-of-power/app/src/test/java/com/game/protocol/UdpPacketFixtures.kt"),
    path.resolve(import.meta.dirname, "../../../../app/src/test/java/com/game/protocol/UdpPacketFixtures.kt"),
  ].filter((item): item is string => Boolean(item));
  const found = candidates.find((item) => fs.existsSync(item));
  if (!found) throw new Error(`UdpPacketFixtures.kt not found. Tried ${candidates.join(", ")}`);
  const source = fs.readFileSync(found, "utf8");
  const packets = parseKotlinByteFunctions(source);
  return { packets, lists: parseKotlinLists(source, packets) };
}
