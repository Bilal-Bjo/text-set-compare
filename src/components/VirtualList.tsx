'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

const ITEM_HEIGHT = 29; // 20px line-height + 4px*2 padding + 1px border

interface VirtualListProps {
  items: string[];
  highlightText: (text: string) => { parts: { text: string; highlight: boolean }[] };
  onClickLine: (line: string) => void;
  emptyMessage?: React.ReactNode;
}

export default function VirtualList({ items, highlightText, onClickLine, emptyMessage }: VirtualListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  if (items.length === 0 && emptyMessage) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        {emptyMessage}
      </div>
    );
  }

  const totalHeight = items.length * ITEM_HEIGHT;
  const overscan = 5;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div
      ref={containerRef}
      className="overflow-auto flex-1"
      onScroll={handleScroll}
      style={{ minHeight: 0 }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: startIndex * ITEM_HEIGHT, left: 0, right: 0 }}>
          {visibleItems.map((item, i) => {
            const { parts } = highlightText(item);
            return (
              <div
                key={startIndex + i}
                className="result-line"
                onClick={() => onClickLine(item)}
                title={item}
              >
                {parts.map((part, j) =>
                  part.highlight ? (
                    <span key={j} className="search-highlight">{part.text}</span>
                  ) : (
                    <span key={j}>{part.text}</span>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
