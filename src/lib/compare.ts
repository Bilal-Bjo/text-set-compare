export interface CompareOptions {
  ignoreEmpty: boolean;
  caseInsensitive: boolean;
  trimWhitespace: boolean;
}

export interface CompareResult {
  inBoth: string[];
  missing: string[];
  added: string[];
  stats: {
    totalBefore: number;
    totalAfter: number;
    inBothCount: number;
    missingCount: number;
    addedCount: number;
  };
  beforeLineSet: Set<string>;
  afterLineSet: Set<string>;
}

function extractUniqueLines(text: string, options: CompareOptions): { normalized: Set<string>; normalToOriginal: Map<string, string> } {
  const lines = text.split('\n');
  const normalized = new Set<string>();
  const normalToOriginal = new Map<string, string>();

  for (const line of lines) {
    const processed = options.trimWhitespace ? line.trim() : line;
    if (options.ignoreEmpty && processed.trim() === '') continue;
    const key = options.caseInsensitive ? processed.toLowerCase() : processed;
    if (!normalized.has(key)) {
      normalized.add(key);
      normalToOriginal.set(key, processed);
    }
  }

  return { normalized, normalToOriginal };
}

export function compareTexts(before: string, after: string, options: CompareOptions): CompareResult {
  const beforeData = extractUniqueLines(before, options);
  const afterData = extractUniqueLines(after, options);

  const inBoth: string[] = [];
  const missing: string[] = [];
  const added: string[] = [];

  for (const key of beforeData.normalized) {
    if (afterData.normalized.has(key)) {
      inBoth.push(beforeData.normalToOriginal.get(key)!);
    } else {
      missing.push(beforeData.normalToOriginal.get(key)!);
    }
  }

  for (const key of afterData.normalized) {
    if (!beforeData.normalized.has(key)) {
      added.push(afterData.normalToOriginal.get(key)!);
    }
  }

  return {
    inBoth,
    missing,
    added,
    stats: {
      totalBefore: beforeData.normalized.size,
      totalAfter: afterData.normalized.size,
      inBothCount: inBoth.length,
      missingCount: missing.length,
      addedCount: added.length,
    },
    beforeLineSet: new Set([...beforeData.normalToOriginal.values()]),
    afterLineSet: new Set([...afterData.normalToOriginal.values()]),
  };
}
