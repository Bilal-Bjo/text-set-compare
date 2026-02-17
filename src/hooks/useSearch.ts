import { useMemo } from 'react';

export interface SearchResult {
  filtered: string[];
  highlightText: (text: string) => { parts: { text: string; highlight: boolean }[] };
}

export function useSearch(query: string, lines: string[]): SearchResult {
  return useMemo(() => {
    if (!query.trim()) {
      return {
        filtered: lines,
        highlightText: (text: string) => ({ parts: [{ text, highlight: false }] }),
      };
    }

    const lowerQuery = query.toLowerCase();
    const filtered = lines.filter((line) => line.toLowerCase().includes(lowerQuery));

    const highlightText = (text: string) => {
      const parts: { text: string; highlight: boolean }[] = [];
      const lowerText = text.toLowerCase();
      let lastIndex = 0;

      let index = lowerText.indexOf(lowerQuery, lastIndex);
      while (index !== -1) {
        if (index > lastIndex) {
          parts.push({ text: text.slice(lastIndex, index), highlight: false });
        }
        parts.push({ text: text.slice(index, index + query.length), highlight: true });
        lastIndex = index + query.length;
        index = lowerText.indexOf(lowerQuery, lastIndex);
      }

      if (lastIndex < text.length) {
        parts.push({ text: text.slice(lastIndex), highlight: false });
      }

      if (parts.length === 0) {
        parts.push({ text, highlight: false });
      }

      return { parts };
    };

    return { filtered, highlightText };
  }, [query, lines]);
}
