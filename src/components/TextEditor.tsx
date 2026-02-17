'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

interface TextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  lineClassifications: Map<number, 'both' | 'missing' | 'added'>;
  highlightLineIndex?: number | null;
  lineCount: number;
  uniqueCount: number;
}

export default function TextEditor({
  value,
  onChange,
  placeholder,
  label,
  lineClassifications,
  highlightLineIndex,
  lineCount,
  uniqueCount,
}: TextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [displayLineCount, setDisplayLineCount] = useState(0);

  const lines = value.split('\n');
  const currentLineCount = lines.length;

  useEffect(() => {
    setDisplayLineCount(currentLineCount);
  }, [currentLineCount]);

  const handleScroll = useCallback(() => {
    const scrollArea = scrollAreaRef.current;
    const lineNumbers = lineNumbersRef.current;
    if (scrollArea && lineNumbers) {
      lineNumbers.scrollTop = scrollArea.scrollTop;
    }
  }, []);

  useEffect(() => {
    if (highlightLineIndex != null && scrollAreaRef.current) {
      const top = highlightLineIndex * 20 + 8;
      scrollAreaRef.current.scrollTo({ top: top - 60, behavior: 'smooth' });
    }
  }, [highlightLineIndex]);

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center justify-between px-3 py-2" style={{ background: 'var(--bg-secondary)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
      </div>
      <div className="text-editor-container flex-1">
        <div className="line-numbers" ref={lineNumbersRef}>
          {Array.from({ length: displayLineCount || 1 }, (_, i) => (
            <div key={i} className="line-number">{i + 1}</div>
          ))}
        </div>
        <div
          className="editor-scroll-area"
          ref={scrollAreaRef}
          onScroll={handleScroll}
        >
          <div className="editor-highlights">
            {lines.map((_, i) => {
              const cls = lineClassifications.get(i);
              const isSearchMatch = highlightLineIndex === i;
              return (
                <div
                  key={i}
                  className={`highlight-line ${cls || ''} ${isSearchMatch ? 'search-match' : ''}`}
                />
              );
            })}
          </div>
          <textarea
            ref={textareaRef}
            className="editor-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            data-testid={`editor-${label.toLowerCase()}`}
          />
        </div>
      </div>
      <div className="px-3 py-1 text-xs" style={{ color: 'var(--text-muted)' }} data-testid={`linecount-${label.toLowerCase()}`}>
        {lineCount} line{lineCount !== 1 ? 's' : ''}{value ? ` (${uniqueCount} unique)` : ''}
      </div>
    </div>
  );
}
