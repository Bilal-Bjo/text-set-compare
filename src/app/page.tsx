'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import TextEditor from '@/components/TextEditor';
import ResultsPanel, { TabId } from '@/components/ResultsPanel';
import XmlResultsPanel, { XmlTabId } from '@/components/XmlResultsPanel';
import { useComparison, useLineClassification } from '@/hooks/useComparison';
import { CompareOptions } from '@/lib/compare';
import { detectXml, compareXml, XmlCompareResult } from '@/lib/xml-compare';

const STORAGE_KEY = 'tsc-state';
const HISTORY_KEY = 'tsc-history';
const MAX_HISTORY = 5;

interface HistoryEntry {
  id: number;
  beforePreview: string;
  afterPreview: string;
  timestamp: number;
  stats: { missing: number; added: number; inBoth: number };
}

interface SavedState {
  beforeText: string;
  afterText: string;
  ignoreEmpty: boolean;
  caseInsensitive: boolean;
  trimWhitespace: boolean;
}

function loadState(): SavedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedState;
  } catch {
    return null;
  }
}

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

function InfoModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="info-modal"
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          width: '100%',
          maxWidth: 560,
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--accent-blue)', fontSize: 18, fontWeight: 700 }}>SetDiff</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>v1.0</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.5 3.8L3.8 4.5 7.3 8l-3.5 3.5.7.7L8 8.7l3.5 3.5.7-.7L8.7 8l3.5-3.5-.7-.7L8 7.3 4.5 3.8z"/>
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4" style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            Set-based comparison that answers: <strong style={{ color: 'var(--text-primary)' }}>&quot;Is everything from Before still in After?&quot;</strong> — regardless of order.
          </p>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--accent-blue)' }}>
              Why not a normal diff?
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              Line-by-line diffs (like Azure DevOps) show hundreds of changes when elements simply move position.
              SetDiff ignores order and tells you what actually changed — perfect for Salesforce metadata files
              where deployments shuffle elements constantly.
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--accent-blue)' }}>
              How it works
            </div>
            <div className="flex flex-col gap-2" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <div className="flex gap-2">
                <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: 16, textAlign: 'center' }}>1</span>
                <span>Paste or drag-drop your Before and After content</span>
              </div>
              <div className="flex gap-2">
                <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: 16, textAlign: 'center' }}>2</span>
                <span>XML is auto-detected — elements are matched by their key fields, not position</span>
              </div>
              <div className="flex gap-2">
                <span style={{ color: 'var(--text-muted)', flexShrink: 0, width: 16, textAlign: 'center' }}>3</span>
                <span>Results show exactly what&apos;s <strong style={{ color: '#ce9178' }}>Modified</strong>, <strong style={{ color: 'var(--accent-red)' }}>Removed</strong>, <strong style={{ color: 'var(--accent-blue)' }}>Added</strong>, or unchanged</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--accent-blue)' }}>
              Salesforce-aware matching
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 8 }}>
              Elements are matched by their identity field across all major metadata types:
            </p>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Profiles & Permission Sets', items: 'fieldPermissions, objectPermissions, userPermissions, tabVisibilities, classAccesses, layoutAssignments, and 12 more' },
                { label: 'Custom Objects', items: 'fields, validationRules, listViews, recordTypes, compactLayouts, fieldSets, webLinks' },
                { label: 'Flows', items: 'actionCalls, decisions, screens, recordLookups, variables, formulas, loops, and more' },
                { label: 'Custom Labels & Layouts', items: 'labels, layoutSections, relatedLists' },
              ].map(({ label, items }) => (
                <div
                  key={label}
                  className="text-xs px-3 py-2 rounded"
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}
                >
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{items}</div>
                </div>
              ))}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 6 }}>
              Works with standard and custom objects. Unknown element types fall back to content matching.
            </p>
          </div>

          <div
            className="flex flex-col gap-1 text-xs px-3 py-2 rounded"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
          >
            <div className="flex justify-between">
              <span>Search within editors</span>
              <kbd style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 3, fontSize: 11 }}>Ctrl+F</kbd>
            </div>
            <div className="flex justify-between">
              <span>Upload a file</span>
              <span style={{ color: 'var(--text-secondary)' }}>Click upload icon or drag &amp; drop</span>
            </div>
            <div className="flex justify-between">
              <span>Your work is auto-saved</span>
              <span style={{ color: 'var(--text-secondary)' }}>Restored on next visit</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [beforeText, setBeforeText] = useState('');
  const [afterText, setAfterText] = useState('');
  const [ignoreEmpty, setIgnoreEmpty] = useState(true);
  const [caseInsensitive, setCaseInsensitive] = useState(false);
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [xmlActiveTab, setXmlActiveTab] = useState<XmlTabId>('summary');
  const [highlightBefore, setHighlightBefore] = useState<number | null>(null);
  const [highlightAfter, setHighlightAfter] = useState<number | null>(null);
  const [xmlMode, setXmlMode] = useState<'auto' | 'text' | 'xml'>('auto');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);

  // Restore from localStorage on mount
  useEffect(() => {
    const saved = loadState();
    if (saved) {
      setBeforeText(saved.beforeText);
      setAfterText(saved.afterText);
      setIgnoreEmpty(saved.ignoreEmpty);
      setCaseInsensitive(saved.caseInsensitive);
      setTrimWhitespace(saved.trimWhitespace);
    }
    setHistory(loadHistory());
    restoredRef.current = true;
  }, []);

  // Debounced auto-save to localStorage
  useEffect(() => {
    if (!restoredRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (typeof window === 'undefined') return;
      const state: SavedState = { beforeText, afterText, ignoreEmpty, caseInsensitive, trimWhitespace };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore quota errors
      }
    }, 1000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [beforeText, afterText, ignoreEmpty, caseInsensitive, trimWhitespace]);

  const options: CompareOptions = useMemo(() => ({
    ignoreEmpty,
    caseInsensitive,
    trimWhitespace,
  }), [ignoreEmpty, caseInsensitive, trimWhitespace]);

  const result = useComparison(beforeText, afterText, options);

  // Auto-detect XML mode
  const isXmlDetected = useMemo(() => {
    if (!beforeText.trim() && !afterText.trim()) return false;
    const beforeIsXml = beforeText.trim() ? detectXml(beforeText) : false;
    const afterIsXml = afterText.trim() ? detectXml(afterText) : false;
    return beforeIsXml || afterIsXml;
  }, [beforeText, afterText]);

  const useXmlMode = xmlMode === 'xml' || (xmlMode === 'auto' && isXmlDetected);

  // XML comparison result (only compute when in XML mode)
  const xmlResult = useMemo<XmlCompareResult | null>(() => {
    if (!useXmlMode || !beforeText.trim() || !afterText.trim()) return null;
    return compareXml(beforeText, afterText, {
      ignoreComments: true,
      normalizeWhitespace: trimWhitespace,
    });
  }, [useXmlMode, beforeText, afterText, trimWhitespace]);

  // Save to history when results change and both editors have content
  const prevStatsRef = useRef<string>('');
  useEffect(() => {
    if (!beforeText || !afterText) return;
    const statsKey = `${result.stats.missingCount}-${result.stats.addedCount}-${result.stats.inBothCount}`;
    if (statsKey === prevStatsRef.current) return;
    prevStatsRef.current = statsKey;

    const entry: HistoryEntry = {
      id: Date.now(),
      beforePreview: beforeText.slice(0, 80),
      afterPreview: afterText.slice(0, 80),
      timestamp: Date.now(),
      stats: {
        missing: result.stats.missingCount,
        added: result.stats.addedCount,
        inBoth: result.stats.inBothCount,
      },
    };

    setHistory(prev => {
      const updated = [entry, ...prev].slice(0, MAX_HISTORY);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
      }
      return updated;
    });
  }, [result.stats.missingCount, result.stats.addedCount, result.stats.inBothCount, beforeText, afterText]);

  const beforeClassifications = useLineClassification(beforeText, result, 'before', options);
  const afterClassifications = useLineClassification(afterText, result, 'after', options);

  const handleClearAll = useCallback(() => {
    setBeforeText('');
    setAfterText('');
    setHighlightBefore(null);
    setHighlightAfter(null);
    // Clear saved state but not history
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
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

  const handleRestoreHistory = useCallback((entry: HistoryEntry) => {
    setBeforeText(entry.beforePreview.length >= 80 ? entry.beforePreview : entry.beforePreview);
    setAfterText(entry.afterPreview.length >= 80 ? entry.afterPreview : entry.afterPreview);
    setHistoryOpen(false);
    setHighlightBefore(null);
    setHighlightAfter(null);
  }, []);

  // Close history dropdown on click outside or Escape
  useEffect(() => {
    if (!historyOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHistoryOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [historyOpen]);

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
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
            SetDiff
          </h1>
          <button
            onClick={() => setInfoOpen(true)}
            data-testid="info-btn"
            title="How it works"
            style={{
              background: 'none',
              border: '1px solid var(--border-color)',
              borderRadius: '50%',
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ?
          </button>
        </div>
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
          {/* XML mode selector */}
          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span>Mode:</span>
            {(['auto', 'text', 'xml'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setXmlMode(mode)}
                className="px-2 py-0.5 rounded"
                style={{
                  background: xmlMode === mode ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                  color: xmlMode === mode ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
                data-testid={`mode-${mode}`}
              >
                {mode === 'auto' ? `Auto${isXmlDetected ? ' (XML)' : ''}` : mode.toUpperCase()}
              </button>
            ))}
          </div>
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
          {/* History button */}
          <div ref={historyRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="px-3 py-1 text-xs rounded"
              style={{
                background: historyOpen ? 'var(--bg-hover)' : 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              data-testid="history-btn"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 4v4.5l3 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              History
            </button>
            {historyOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  width: 320,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  zIndex: 100,
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}
                data-testid="history-dropdown"
              >
                {history.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                    No history yet
                  </div>
                ) : (
                  history.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => handleRestoreHistory(entry)}
                      className="w-full text-left px-3 py-2"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                        fontSize: 12,
                        display: 'block',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      data-testid="history-item"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                        <span style={{ display: 'flex', gap: 6 }}>
                          <span style={{ color: 'var(--accent-red)' }}>-{entry.stats.missing}</span>
                          <span style={{ color: 'var(--accent-blue)' }}>+{entry.stats.added}</span>
                          <span style={{ color: 'var(--accent-green)' }}>={entry.stats.inBoth}</span>
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.beforePreview || '(empty)'}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
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
      {useXmlMode && xmlResult ? (
        <XmlResultsPanel result={xmlResult} />
      ) : (
        <ResultsPanel
          result={result}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onClickLine={handleClickLine}
        />
      )}

      {infoOpen && <InfoModal onClose={() => setInfoOpen(false)} />}
    </div>
  );
}
