'use client';

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';

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

function findAllMatches(text: string, query: string): number[] {
  if (!query) return [];
  const lines = text.split('\n');
  const lowerQuery = query.toLowerCase();
  const matches: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(lowerQuery)) {
      matches.push(i);
    }
  }
  return matches;
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [displayLineCount, setDisplayLineCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const lines = value.split('\n');
  const currentLineCount = lines.length;

  const matchingLines = useMemo(() => findAllMatches(value, searchQuery), [value, searchQuery]);
  const matchSet = useMemo(() => new Set(matchingLines), [matchingLines]);

  useEffect(() => {
    setDisplayLineCount(currentLineCount);
  }, [currentLineCount]);

  // Reset active match when query or matches change
  useEffect(() => {
    setActiveMatchIndex(0);
  }, [searchQuery]);

  // Scroll to active match
  useEffect(() => {
    if (matchingLines.length > 0 && scrollAreaRef.current) {
      const lineIdx = matchingLines[activeMatchIndex];
      if (lineIdx != null) {
        const top = lineIdx * 20 + 8;
        scrollAreaRef.current.scrollTo({ top: top - 60, behavior: 'smooth' });
      }
    }
  }, [activeMatchIndex, matchingLines]);

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

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setActiveMatchIndex(0);
  }, []);

  const goNextMatch = useCallback(() => {
    if (matchingLines.length === 0) return;
    setActiveMatchIndex((prev) => (prev + 1) % matchingLines.length);
  }, [matchingLines.length]);

  const goPrevMatch = useCallback(() => {
    if (matchingLines.length === 0) return;
    setActiveMatchIndex((prev) => (prev - 1 + matchingLines.length) % matchingLines.length);
  }, [matchingLines.length]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeSearch();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) goPrevMatch();
      else goNextMatch();
    }
  }, [closeSearch, goNextMatch, goPrevMatch]);

  // Ctrl/Cmd+F to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        // Only capture if this editor or its children are focused,
        // or if no specific element is focused
        const container = textareaRef.current?.closest('.flex.flex-col.flex-1');
        if (container?.contains(document.activeElement) || document.activeElement === document.body) {
          // Don't prevent — let both editors potentially open
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeLineIdx = matchingLines[activeMatchIndex] ?? null;

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center justify-between px-3 py-2" style={{ background: 'var(--bg-secondary)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <button
          onClick={searchOpen ? closeSearch : openSearch}
          className="editor-search-toggle"
          data-testid={`search-toggle-${label.toLowerCase()}`}
          title="Search (Ctrl+F)"
          style={{
            background: searchOpen ? 'var(--bg-hover)' : 'transparent',
            border: 'none',
            borderRadius: 4,
            padding: '2px 6px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM10.9 11.6a6 6 0 1 1 .7-.7l3.8 3.8-.7.7-3.8-3.8Z" fill="currentColor"/>
          </svg>
        </button>
      </div>

      {searchOpen && (
        <div
          className="flex items-center gap-2 px-2 py-1"
          style={{
            background: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Find..."
            data-testid={`editor-search-${label.toLowerCase()}`}
            className="flex-1 text-xs bg-transparent outline-none"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              padding: '3px 6px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 3,
              minWidth: 0,
            }}
          />
          <span className="text-xs" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {searchQuery
              ? matchingLines.length > 0
                ? `${activeMatchIndex + 1}/${matchingLines.length}`
                : 'No results'
              : ''}
          </span>
          <button
            onClick={goPrevMatch}
            disabled={matchingLines.length === 0}
            title="Previous (Shift+Enter)"
            style={{
              background: 'none',
              border: 'none',
              cursor: matchingLines.length > 0 ? 'pointer' : 'default',
              color: matchingLines.length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
              padding: '2px',
              display: 'flex',
              opacity: matchingLines.length > 0 ? 1 : 0.4,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4l-5 5h10L8 4z"/>
            </svg>
          </button>
          <button
            onClick={goNextMatch}
            disabled={matchingLines.length === 0}
            title="Next (Enter)"
            style={{
              background: 'none',
              border: 'none',
              cursor: matchingLines.length > 0 ? 'pointer' : 'default',
              color: matchingLines.length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
              padding: '2px',
              display: 'flex',
              opacity: matchingLines.length > 0 ? 1 : 0.4,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 12l5-5H3l5 5z"/>
            </svg>
          </button>
          <button
            onClick={closeSearch}
            title="Close (Esc)"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '2px',
              display: 'flex',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.5 3.8L3.8 4.5 7.3 8l-3.5 3.5.7.7L8 8.7l3.5 3.5.7-.7L8.7 8l3.5-3.5-.7-.7L8 7.3 4.5 3.8z"/>
            </svg>
          </button>
        </div>
      )}

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
              const isResultHighlight = highlightLineIndex === i;
              const isSearchHit = searchOpen && matchSet.has(i);
              const isActiveSearch = searchOpen && i === activeLineIdx;
              return (
                <div
                  key={i}
                  className={[
                    'highlight-line',
                    cls || '',
                    isResultHighlight ? 'search-match' : '',
                    isSearchHit ? 'editor-find-match' : '',
                    isActiveSearch ? 'editor-find-active' : '',
                  ].join(' ')}
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
