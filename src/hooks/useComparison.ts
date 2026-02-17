import { useState, useEffect, useRef, useMemo } from 'react';
import { compareTexts, CompareOptions, CompareResult } from '@/lib/compare';

const EMPTY_RESULT: CompareResult = {
  inBoth: [],
  missing: [],
  added: [],
  stats: { totalBefore: 0, totalAfter: 0, inBothCount: 0, missingCount: 0, addedCount: 0 },
  beforeLineSet: new Set(),
  afterLineSet: new Set(),
};

export function useComparison(
  beforeText: string,
  afterText: string,
  options: CompareOptions
): CompareResult {
  const [result, setResult] = useState<CompareResult>(EMPTY_RESULT);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      if (!beforeText && !afterText) {
        setResult(EMPTY_RESULT);
        return;
      }
      const res = compareTexts(beforeText, afterText, options);
      setResult(res);
    }, 300);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [beforeText, afterText, options.ignoreEmpty, options.caseInsensitive, options.trimWhitespace]);

  return result;
}

export function useLineClassification(
  text: string,
  result: CompareResult,
  side: 'before' | 'after',
  options: CompareOptions
): Map<number, 'both' | 'missing' | 'added'> {
  return useMemo(() => {
    const map = new Map<number, 'both' | 'missing' | 'added'>();
    if (!text) return map;

    const missingSet = new Set(result.missing.map(l => options.caseInsensitive ? l.toLowerCase() : l));
    const addedSet = new Set(result.added.map(l => options.caseInsensitive ? l.toLowerCase() : l));
    const inBothSet = new Set(result.inBoth.map(l => options.caseInsensitive ? l.toLowerCase() : l));

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const processed = options.trimWhitespace ? lines[i].trim() : lines[i];
      if (options.ignoreEmpty && processed.trim() === '') continue;
      const key = options.caseInsensitive ? processed.toLowerCase() : processed;

      if (side === 'before') {
        if (missingSet.has(key)) map.set(i, 'missing');
        else if (inBothSet.has(key)) map.set(i, 'both');
      } else {
        if (addedSet.has(key)) map.set(i, 'added');
        else if (inBothSet.has(key)) map.set(i, 'both');
      }
    }
    return map;
  }, [text, result, side, options.ignoreEmpty, options.caseInsensitive, options.trimWhitespace]);
}
