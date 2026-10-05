/** Keys written before all others, in this order. Everything else is alphabetical. */
const LEADING_KEYS = ["version", "type", "id"];

function compareKeys(a: string, b: string): number {
  const ai = LEADING_KEYS.indexOf(a);
  const bi = LEADING_KEYS.indexOf(b);
  if (ai !== -1 || bi !== -1) {
    return (ai === -1 ? Number.POSITIVE_INFINITY : ai) - (bi === -1 ? Number.POSITIVE_INFINITY : bi);
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort(compareKeys)) {
      const child = (value as Record<string, unknown>)[key];
      if (child !== undefined) sorted[key] = sortKeys(child);
    }
    return sorted;
  }
  return value;
}

/**
 * Serializes a content file. Output is deterministic (2-space indent, stable
 * key order, trailing newline) so the same content always produces the same
 * file and diffs only show real changes.
 */
export function serializeContent(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}
