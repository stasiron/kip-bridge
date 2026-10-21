/** Compare dotted semver strings (optional leading v). Pre-release tags sort below the same core. */

export function normalizeVersion(value: string): string {
  return value.trim().replace(/^v/i, "");
}

export function parseSemver(value: string): { major: number; minor: number; patch: number; pre: string } | null {
  const core = normalizeVersion(value);
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(core);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ?? "",
  };
}

/** Negative if a < b, 0 if equal, positive if a > b. Invalid versions compare as equal to themselves only. */
export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) return normalizeVersion(a) === normalizeVersion(b) ? 0 : 0;
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  if (left.patch !== right.patch) return left.patch - right.patch;
  if (left.pre === right.pre) return 0;
  if (!left.pre) return 1;
  if (!right.pre) return -1;
  return left.pre < right.pre ? -1 : left.pre > right.pre ? 1 : 0;
}

export function isNewerVersion(candidate: string, current: string): boolean {
  return compareSemver(candidate, current) > 0;
}
