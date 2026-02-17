'use client';

import { useState, useCallback, useMemo } from 'react';
import TextEditor from '@/components/TextEditor';
import ResultsPanel, { TabId } from '@/components/ResultsPanel';
import { useComparison, useLineClassification } from '@/hooks/useComparison';
import { CompareOptions } from '@/lib/compare';

export default function Home() {
  const [beforeText, setBeforeText] = useState('');
  const [afterText, setAfterText] = useState('');
  const [ignoreEmpty, setIgnoreEmpty] = useState(true);
  const [caseInsensitive, setCaseInsensitive] = useState(false);
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [highlightBefore, setHighlightBefore] = useState<number | null>(null);
  const [highlightAfter, setHighlightAfter] = useState<number | null>(null);

  const options: CompareOptions = useMemo(() => ({
    ignoreEmpty,
    caseInsensitive,
    trimWhitespace,
  }), [ignoreEmpty, caseInsensitive, trimWhitespace]);

  const result = useComparison(beforeText, afterText, options);

  const beforeClassifications = useLineClassification(beforeText, result, 'before', options);
  const afterClassifications = useLineClassification(afterText, result, 'after', options);

  const handleClearAll = useCallback(() => {
    setBeforeText('');
    setAfterText('');
    setHighlightBefore(null);
    setHighlightAfter(null);
  }, []);

  const handleSwap = useCallback(() => {
    setBeforeText(afterText);
    setAfterText(beforeText);
    setHighlightBefore(null);
    setHighlightAfter(null);
  }, [beforeText, afterText]);

  const handleClickLine = useCallback((line: string) => {
    const key = caseInsensitive ? line.toLowerCase() : line;

    const beforeLines = beforeText.split('\n');
    const beforeIndex = beforeLines.findIndex((l) => {
      const processed = trimWhitespace ? l.trim() : l;
      return caseInsensitive ? processed.toLowerCase() === key : processed === key;
    });
    setHighlightBefore(beforeIndex >= 0 ? beforeIndex : null);

    const afterLines = afterText.split('\n');
    const afterIndex = afterLines.findIndex((l) => {
      const processed = trimWhitespace ? l.trim() : l;
      return caseInsensitive ? processed.toLowerCase() === key : processed === key;
    });
    setHighlightAfter(afterIndex >= 0 ? afterIndex : null);
  }, [beforeText, afterText, caseInsensitive, trimWhitespace]);

  const uniqueBeforeCount = result.stats.totalBefore;
  const uniqueAfterCount = result.stats.totalAfter;
  const beforeLineCount = beforeText ? beforeText.split('\n').length : 0;
  const afterLineCount = afterText ? afterText.split('\n').length : 0;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-2"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}
      >
        <h1 className="text-sm font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
          Text Set Compare
        </h1>
        <div className="flex items-center gap-5">
          <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: 'var(--text-secondary)' }}>
            <div
              className={`toggle-switch ${trimWhitespace ? 'active' : ''}`}
              onClick={() => setTrimWhitespace(!trimWhitespace)}
              data-testid="toggle-trim"
            />
            Trim whitespace
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: 'var(--text-secondary)' }}>
            <div
              className={`toggle-switch ${ignoreEmpty ? 'active' : ''}`}
              onClick={() => setIgnoreEmpty(!ignoreEmpty)}
              data-testid="toggle-empty"
            />
            Ignore empty lines
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: 'var(--text-secondary)' }}>
            <div
              className={`toggle-switch ${caseInsensitive ? 'active' : ''}`}
              onClick={() => setCaseInsensitive(!caseInsensitive)}
              data-testid="toggle-case"
            />
            Case insensitive
          </label>
          <button
            onClick={handleSwap}
            className="px-3 py-1 text-xs rounded"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
            }}
            data-testid="swap-btn"
          >
            ⇄ Swap
          </button>
          <button
            onClick={handleClearAll}
            className="px-3 py-1 text-xs rounded"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
            }}
            data-testid="clear-all"
          >
            Clear all
          </button>
        </div>
      </header>

      {/* Text editors */}
      <div className="flex gap-0" style={{ height: '45vh', minHeight: '200px', borderBottom: '1px solid var(--border-color)' }}>
        <TextEditor
          value={beforeText}
          onChange={setBeforeText}
          placeholder="Paste 'before' content..."
          label="Before"
          lineClassifications={beforeClassifications}
          highlightLineIndex={highlightBefore}
          lineCount={beforeLineCount}
          uniqueCount={uniqueBeforeCount}
        />
        <div style={{ width: '1px', background: 'var(--border-color)' }} />
        <TextEditor
          value={afterText}
          onChange={setAfterText}
          placeholder="Paste 'after' content..."
          label="After"
          lineClassifications={afterClassifications}
          highlightLineIndex={highlightAfter}
          lineCount={afterLineCount}
          uniqueCount={uniqueAfterCount}
        />
      </div>

      {/* Results */}
      <ResultsPanel
        result={result}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClickLine={handleClickLine}
      />
    </div>
  );
}
