/**
 * Byte-mode QR, versions 1–3, error correction L.
 * Enough for `http://<ipv4>:8787/` (28 characters). No image library.
 */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

{
  let value = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = value;
    LOG[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
}

function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

/** Level L, one Reed-Solomon block. data = payload codewords, ecc = parity length. */
const LEVEL_L: Record<number, { data: number; ecc: number; align: number[] }> = {
  1: { data: 19, ecc: 7, align: [] },
  2: { data: 34, ecc: 10, align: [6, 18] },
  3: { data: 55, ecc: 15, align: [6, 22] },
};

const REMAINDER_BITS: Record<number, number> = { 1: 0, 2: 7, 3: 7 };

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = mul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = mul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: Uint8Array, degree: number): Uint8Array {
  const divisor = rsDivisor(degree);
  const result = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = (result[0] ^ byte) & 0xff;
    for (let i = 0; i < result.length - 1; i += 1) result[i] = result[i + 1];
    result[result.length - 1] = 0;
    for (let i = 0; i < result.length; i += 1) result[i] ^= mul(divisor[i], factor);
  }
  return Uint8Array.from(result);
}

function byteCapacity(dataCodewords: number): number {
  return Math.floor((dataCodewords * 8 - 12) / 8);
}

function chooseVersion(length: number): number {
  for (const version of [1, 2, 3]) {
    if (length <= byteCapacity(LEVEL_L[version].data)) return version;
  }
  throw new Error(`QR payload is ${length} bytes; this encoder holds up to ${byteCapacity(LEVEL_L[3].data)}`);
}

function encodeData(bytes: Uint8Array, capacity: number): Uint8Array {
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const byte of bytes) push(byte, 8);
  const terminator = Math.min(4, capacity * 8 - bits.length);
  for (let i = 0; i < terminator; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const out = new Uint8Array(capacity);
  let index = 0;
  for (let i = 0; i + 8 <= bits.length && index < capacity; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j];
    out[index] = value;
    index += 1;
  }
  const pads = [0xec, 0x11];
  let pad = 0;
  while (index < capacity) {
    out[index] = pads[pad % 2];
    index += 1;
    pad += 1;
  }
  return out;
}

function bit(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0;
}

/** Error-correction level L is format value 1. */
function formatBits(mask: number): number {
  const data = (1 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

interface Grid {
  modules: boolean[][];
  isFunction: boolean[][];
  size: number;
}

function grid(size: number): Grid {
  return {
    size,
    modules: Array.from({ length: size }, () => Array<boolean>(size).fill(false)),
    isFunction: Array.from({ length: size }, () => Array<boolean>(size).fill(false)),
  };
}

function paint(g: Grid, x: number, y: number, dark: boolean): void {
  g.modules[y][x] = dark;
  g.isFunction[y][x] = true;
}

function drawFinder(g: Grid, ox: number, oy: number): void {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const x = ox + dx;
      const y = oy + dy;
      if (x < 0 || y < 0 || x >= g.size || y >= g.size) continue;
      const inside = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const edge = dx === 0 || dx === 6 || dy === 0 || dy === 6;
      const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      paint(g, x, y, inside && (edge || core));
    }
  }
}

function drawAlignment(g: Grid, cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const x = cx + dx;
      const y = cy + dy;
      if (g.isFunction[y][x]) continue;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      paint(g, x, y, ax === 2 || ay === 2 || (ax === 0 && ay === 0));
    }
  }
}

function drawFunctionPatterns(version: number): Grid {
  const size = 17 + 4 * version;
  const g = grid(size);
  drawFinder(g, 0, 0);
  drawFinder(g, size - 7, 0);
  drawFinder(g, 0, size - 7);
  const centers = LEVEL_L[version].align;
  for (const cx of centers) {
    for (const cy of centers) {
      if (g.isFunction[cy][cx]) continue;
      drawAlignment(g, cx, cy);
    }
  }
  for (let i = 0; i < size; i += 1) {
    if (!g.isFunction[6][i]) paint(g, i, 6, i % 2 === 0);
    if (!g.isFunction[i][6]) paint(g, 6, i, i % 2 === 0);
  }
  paint(g, 8, 4 * version + 9, true);
  for (let i = 0; i <= 8; i += 1) {
    g.isFunction[8][i] = true;
    g.isFunction[i][8] = true;
  }
  for (let i = 0; i < 8; i += 1) g.isFunction[8][size - 1 - i] = true;
  for (let i = 0; i < 7; i += 1) g.isFunction[size - 1 - i][8] = true;
  return g;
}

function placeData(g: Grid, codewords: Uint8Array): void {
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  for (let right = g.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < g.size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? g.size - 1 - vert : vert;
        if (g.isFunction[y][x]) continue;
        let dark = false;
        if (bitIndex < totalBits) {
          dark = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
          bitIndex += 1;
        }
        g.modules[y][x] = dark;
      }
    }
  }
  if (bitIndex !== totalBits) {
    throw new Error(`placed ${bitIndex} bits, expected ${totalBits}`);
  }
}

function maskFlips(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function applyMask(g: Grid, mask: number): boolean[][] {
  const out = g.modules.map((row) => row.slice());
  for (let y = 0; y < g.size; y += 1) {
    for (let x = 0; x < g.size; x += 1) {
      if (!g.isFunction[y][x] && maskFlips(mask, x, y)) out[y][x] = !out[y][x];
    }
  }
  return out;
}

function drawFormat(modules: boolean[][], mask: number): void {
  const bits = formatBits(mask);
  const size = modules.length;
  const set = (x: number, y: number, index: number) => {
    modules[y][x] = bit(bits, index);
  };
  for (let i = 0; i <= 5; i += 1) set(8, i, i);
  set(8, 7, 6);
  set(8, 8, 7);
  set(7, 8, 8);
  for (let i = 9; i < 15; i += 1) set(14 - i, 8, i);
  for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, i);
  for (let i = 8; i < 15; i += 1) set(8, size - 15 + i, i);
  modules[size - 8][8] = true;
}

function penalty(modules: boolean[][]): number {
  const size = modules.length;
  let score = 0;
  const run = (read: (i: number, j: number) => boolean) => {
    for (let i = 0; i < size; i += 1) {
      let color = false;
      let length = 0;
      for (let j = 0; j < size; j += 1) {
        const on = read(i, j);
        if (on === color) {
          length += 1;
          if (length === 5) score += 3;
          else if (length > 5) score += 1;
        } else {
          color = on;
          length = 1;
        }
      }
    }
  };
  run((y, x) => modules[y][x]);
  run((x, y) => modules[y][x]);
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const on = modules[y][x];
      if (on === modules[y][x + 1] && on === modules[y + 1][x] && on === modules[y + 1][x + 1]) score += 3;
    }
  }
  const pattern = [true, false, true, true, true, false, true];
  const matches = (samples: boolean[]) => samples.every((on, index) => on === pattern[index]);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x <= size - 7; x += 1) {
      if (!matches(modules[y].slice(x, x + 7))) continue;
      const left = x >= 4 && modules[y].slice(x - 4, x).every((on) => !on);
      const right = x + 11 <= size && modules[y].slice(x + 7, x + 11).every((on) => !on);
      if (left || right) score += 40;
    }
  }
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y <= size - 7; y += 1) {
      const samples = Array.from({ length: 7 }, (_, k) => modules[y + k][x]);
      if (!matches(samples)) continue;
      const left = y >= 4 && [0, 1, 2, 3].every((k) => !modules[y - 1 - k][x]);
      const right = y + 11 <= size && [0, 1, 2, 3].every((k) => !modules[y + 7 + k][x]);
      if (left || right) score += 40;
    }
  }
  let dark = 0;
  for (const row of modules) for (const on of row) if (on) dark += 1;
  const total = size * size;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

export function qrMatrix(text: string): boolean[][] {
  const bytes = Buffer.from(text, "utf8");
  const version = chooseVersion(bytes.length);
  const spec = LEVEL_L[version];
  const data = encodeData(bytes, spec.data);
  const parity = rsRemainder(data, spec.ecc);
  const codewords = Buffer.concat([data, parity]);
  const base = drawFunctionPatterns(version);
  placeData(base, codewords);
  let bestMask = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  let best: boolean[][] = base.modules;
  for (let mask = 0; mask < 8; mask += 1) {
    const modules = applyMask(base, mask);
    drawFormat(modules, mask);
    const score = penalty(modules);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
      best = modules;
    }
  }
  void bestMask;
  return best;
}

export function qrSvg(text: string): string {
  const matrix = qrMatrix(text);
  const quiet = 4;
  const span = matrix.length + quiet * 2;
  let shapes = "";
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix.length; x += 1) {
      if (!matrix[y][x]) continue;
      shapes += `<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${span} ${span}" shape-rendering="crispEdges" role="img" aria-label="QR code">${shapes}</svg>`;
}

/** Two characters per module so a phone camera can read a console window. */
export function qrAscii(text: string): string {
  const matrix = qrMatrix(text);
  const quiet = 2;
  const lines: string[] = [];
  for (let y = -quiet; y < matrix.length + quiet; y += 1) {
    let line = "";
    for (let x = -quiet; x < matrix.length + quiet; x += 1) {
      const on = y >= 0 && x >= 0 && y < matrix.length && x < matrix.length && matrix[y][x];
      line += on ? "██" : "  ";
    }
    lines.push(line);
  }
  return lines.join("\n");
}
