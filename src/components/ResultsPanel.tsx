'use client';

import { useState, useCallback } from 'react';
import { CompareResult } from '@/lib/compare';
import { useSearch } from '@/hooks/useSearch';
import SearchBar from './SearchBar';
import VirtualList from './VirtualList';

export type TabId = 'summary' | 'missing' | 'added' | 'inBoth';

interface ResultsPanelProps {
  result: CompareResult;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onClickLine: (line: string) => void;
}

function CheckIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" fill="var(--accent-green)" opacity="0.15"/>
      <circle cx="24" cy="24" r="22" stroke="var(--accent-green)" strokeWidth="2"/>
      <path d="M14 24l7 7 13-13" stroke="var(--accent-green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function XIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" fill="var(--accent-red)" opacity="0.15"/>
      <circle cx="24" cy="24" r="22" stroke="var(--accent-red)" strokeWidth="2"/>
      <path d="M16 16l16 16M32 16l-16 16" stroke="var(--accent-red)" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}

function CopyButton({ lines, label }: { lines: string[]; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [lines]);

  if (lines.length === 0) return null;

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1 text-xs rounded"
      style={{
        background: copied ? 'var(--accent-green)' : 'var(--bg-tertiary)',
        color: copied ? '#fff' : 'var(--text-secondary)',
        border: '1px solid var(--border-color)',
      }}
      data-testid={`copy-${label}`}
    >
      {copied ? 'Copied!' : `Copy ${lines.length} lines`}
    </button>
  );
}

function SummaryView({ result, onTabChange }: { result: CompareResult; onTabChange: (tab: TabId) => void }) {
  const { stats } = result;
  const allPresent = stats.missingCount === 0 && stats.totalBefore > 0;
  const isEmpty = stats.totalBefore === 0 && stats.totalAfter === 0;

  return (
    <div className="flex flex-col items-center gap-6 p-6 flex-1 overflow-auto">
      {isEmpty ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <span className="text-lg" style={{ color: 'var(--text-muted)' }}>Paste text to compare</span>
        </div>
      ) : allPresent ? (
        <div className="flex flex-col items-center gap-3 py-4" data-testid="status-ok">
          <CheckIcon />
          <span className="text-lg font-semibold" style={{ color: 'var(--accent-green)' }}>
            Nothing lost — all lines from Before are in After
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-4" data-testid="status-missing">
          <XIcon />
          <span className="text-lg font-semibold" style={{ color: 'var(--accent-red)' }}>
            {stats.missingCount} line{stats.missingCount !== 1 ? 's' : ''} from Before {stats.missingCount !== 1 ? 'are' : 'is'} missing in After
          </span>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4">
        <div className="stat-card" onClick={() => onTabChange('summary')} data-testid="stat-before">
          <span className="stat-number" style={{ color: 'var(--text-primary)' }}>{stats.totalBefore}</span>
          <span className="stat-label">Before</span>
        </div>
        <div className="stat-card" onClick={() => onTabChange('summary')} data-testid="stat-after">
          <span className="stat-number" style={{ color: 'var(--text-primary)' }}>{stats.totalAfter}</span>
          <span className="stat-label">After</span>
        </div>
        <div className="stat-card" onClick={() => onTabChange('inBoth')} data-testid="stat-both">
          <span className="stat-number" style={{ color: 'var(--accent-green)' }}>{stats.inBothCount}</span>
          <span className="stat-label">In Both</span>
        </div>
        <div className="stat-card" onClick={() => onTabChange('missing')} data-testid="stat-missing">
          <span className="stat-number" style={{ color: 'var(--accent-red)' }}>{stats.missingCount}</span>
          <span className="stat-label">Missing</span>
        </div>
        <div className="stat-card" onClick={() => onTabChange('added')} data-testid="stat-added">
          <span className="stat-number" style={{ color: 'var(--accent-blue)' }}>{stats.addedCount}</span>
          <span className="stat-label">Added</span>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPanel({ result, activeTab, onTabChange, onClickLine }: ResultsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const currentLines =
    activeTab === 'missing' ? result.missing :
    activeTab === 'added' ? result.added :
    activeTab === 'inBoth' ? result.inBoth :
    [];

  const { filtered, highlightText } = useSearch(searchQuery, currentLines);

  const tabs: { id: TabId; label: string; count: number; badgeClass: string }[] = [
    { id: 'summary', label: 'Summary', count: -1, badgeClass: '' },
    {
      id: 'missing',
      label: 'Missing',
      count: result.stats.missingCount,
      badgeClass: result.stats.missingCount > 0 ? 'badge-red' : 'badge-green',
    },
    { id: 'added', label: 'Added', count: result.stats.addedCount, badgeClass: 'badge-blue' },
    { id: 'inBoth', label: 'In Both', count: result.stats.inBothCount, badgeClass: 'badge-gray' },
  ];

  const noHighlight = (text: string) => ({ parts: [{ text, highlight: false }] });

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ borderTop: '1px solid var(--border-color)' }}>
      <div className="flex items-center" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex flex-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
              {tab.count >= 0 && (
                <span className={`badge ${tab.badgeClass}`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
        {activeTab !== 'summary' && (
          <div className="pr-3">
            <CopyButton lines={currentLines} label={activeTab} />
          </div>
        )}
      </div>

      {activeTab !== 'summary' && (
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          resultCount={filtered.length}
          totalCount={currentLines.length}
        />
      )}

      {activeTab === 'summary' ? (
        <SummaryView result={result} onTabChange={onTabChange} />
      ) : (
        <VirtualList
          items={filtered}
          highlightText={searchQuery ? highlightText : noHighlight}
          onClickLine={onClickLine}
          emptyMessage={
            activeTab === 'missing' ? (
              <div className="flex flex-col items-center gap-3">
                <CheckIcon size={36} />
                <span style={{ color: 'var(--accent-green)' }} className="text-base font-semibold">Nothing lost</span>
              </div>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>No lines to show</span>
            )
          }
        />
      )}
    </div>
  );
}
