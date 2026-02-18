'use client';

import { useState, useCallback } from 'react';
import { XmlCompareResult, XmlElement, XmlElementModification, XmlElementMatch } from '@/lib/xml-compare';
import { getHumanLabel } from '@/lib/sf-metadata';
import SearchBar from './SearchBar';
import XmlBlockView from './XmlBlockView';

export type XmlTabId = 'summary' | 'modified' | 'removed' | 'added' | 'unchanged';

interface XmlResultsPanelProps {
  result: XmlCompareResult;
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

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  if (!text) return null;

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1 text-xs rounded"
      style={{
        background: copied ? 'var(--accent-green)' : 'var(--bg-tertiary)',
        color: copied ? '#fff' : 'var(--text-secondary)',
        border: '1px solid var(--border-color)',
      }}
      data-testid={`xml-copy-${label}`}
    >
      {copied ? 'Copied!' : 'Copy keys'}
    </button>
  );
}

function TypeStatsRow({ result }: { result: XmlCompareResult }) {
  if (!result.isSalesforceMetadata || result.byType.size === 0) return null;

  return (
    <div className="flex flex-col gap-2 w-full max-w-2xl">
      {Array.from(result.byType.entries()).map(([tagName, stats]) => {
        const total = stats.unchanged + stats.modified + stats.removed + stats.added;
        if (total === 0) return null;
        return (
          <div
            key={tagName}
            className="flex items-center justify-between px-4 py-2 rounded text-xs"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          >
            <span style={{ color: 'var(--text-primary)' }} className="font-medium">
              {getHumanLabel(tagName)}
            </span>
            <div className="flex items-center gap-3">
              {stats.unchanged > 0 && (
                <span style={{ color: 'var(--text-muted)' }}>{stats.unchanged} unchanged</span>
              )}
              {stats.modified > 0 && (
                <span style={{ color: '#ce9178' }}>{stats.modified} modified</span>
              )}
              {stats.removed > 0 && (
                <span style={{ color: 'var(--accent-red)' }}>{stats.removed} removed</span>
              )}
              {stats.added > 0 && (
                <span style={{ color: 'var(--accent-blue)' }}>{stats.added} added</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SummaryView({ result, onTabChange }: { result: XmlCompareResult; onTabChange: (tab: XmlTabId) => void }) {
  const { stats } = result;
  const nothingLost = stats.removedCount === 0 && stats.modifiedCount === 0;
  const hasChanges = stats.removedCount > 0 || stats.modifiedCount > 0;

  return (
    <div className="flex flex-col items-center gap-6 p-6 flex-1 overflow-auto">
      {nothingLost && stats.totalBefore > 0 ? (
        <div className="flex flex-col items-center gap-3 py-4" data-testid="xml-status-ok">
          <CheckIcon />
          <span className="text-lg font-semibold" style={{ color: 'var(--accent-green)' }}>
            Nothing lost — all {stats.totalBefore} elements from Before are in After
          </span>
          {stats.addedCount > 0 && (
            <span className="text-sm" style={{ color: 'var(--accent-blue)' }}>
              {stats.addedCount} new element{stats.addedCount !== 1 ? 's' : ''} added
            </span>
          )}
        </div>
      ) : hasChanges ? (
        <div className="flex flex-col items-center gap-3 py-4" data-testid="xml-status-changed">
          <XIcon />
          <span className="text-lg font-semibold" style={{ color: 'var(--accent-red)' }}>
            {stats.removedCount > 0 && `${stats.removedCount} element${stats.removedCount !== 1 ? 's' : ''} removed`}
            {stats.removedCount > 0 && stats.modifiedCount > 0 && ', '}
            {stats.modifiedCount > 0 && `${stats.modifiedCount} element${stats.modifiedCount !== 1 ? 's' : ''} modified`}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-4">
          <span className="text-lg" style={{ color: 'var(--text-muted)' }}>Paste XML to compare</span>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4">
        <div className="stat-card" onClick={() => onTabChange('summary')}>
          <span className="stat-number" style={{ color: 'var(--text-primary)' }}>{stats.totalBefore}</span>
          <span className="stat-label">Before</span>
        </div>
        <div className="stat-card" onClick={() => onTabChange('summary')}>
          <span className="stat-number" style={{ color: 'var(--text-primary)' }}>{stats.totalAfter}</span>
          <span className="stat-label">After</span>
        </div>
        <div className="stat-card" onClick={() => onTabChange('unchanged')} data-testid="xml-stat-unchanged">
          <span className="stat-number" style={{ color: 'var(--text-muted)' }}>{stats.unchangedCount}</span>
          <span className="stat-label">Unchanged</span>
        </div>
        <div className="stat-card" onClick={() => onTabChange('modified')} data-testid="xml-stat-modified">
          <span className="stat-number" style={{ color: '#ce9178' }}>{stats.modifiedCount}</span>
          <span className="stat-label">Modified</span>
        </div>
        <div className="stat-card" onClick={() => onTabChange('removed')} data-testid="xml-stat-removed">
          <span className="stat-number" style={{ color: 'var(--accent-red)' }}>{stats.removedCount}</span>
          <span className="stat-label">Removed</span>
        </div>
        <div className="stat-card" onClick={() => onTabChange('added')} data-testid="xml-stat-added">
          <span className="stat-number" style={{ color: 'var(--accent-blue)' }}>{stats.addedCount}</span>
          <span className="stat-label">Added</span>
        </div>
      </div>

      <TypeStatsRow result={result} />
    </div>
  );
}

function ElementRow({ displayKey, humanType, children, defaultExpanded = false }: {
  displayKey: string;
  humanType: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div style={{ borderBottom: '1px solid var(--border-color)' }}>
      <div
        className="flex items-center gap-3 px-4 py-2 cursor-pointer text-sm"
        onClick={() => setExpanded(!expanded)}
        style={{ background: expanded ? 'var(--bg-tertiary)' : 'transparent' }}
      >
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
          style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
        >
          <path d="M3 1l5 4-5 4V1z"/>
        </svg>
        <span style={{ color: 'var(--text-primary)' }} className="font-medium">{displayKey}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{humanType}</span>
      </div>
      {expanded && (
        <div className="px-4 py-3" style={{ background: 'var(--bg-tertiary)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function ElementList({ items, type, searchQuery }: {
  items: Array<XmlElement | XmlElementModification | XmlElementMatch>;
  type: 'removed' | 'added' | 'modified' | 'unchanged';
  searchQuery: string;
}) {
  const lowerQuery = searchQuery.toLowerCase();
  const filtered = searchQuery
    ? items.filter((item) => {
        const key = 'displayKey' in item ? item.displayKey : '';
        const humanType = 'humanType' in item ? item.humanType : '';
        return key.toLowerCase().includes(lowerQuery) || humanType.toLowerCase().includes(lowerQuery);
      })
    : items;

  if (filtered.length === 0) {
    if (type === 'removed') {
      return (
        <div className="flex items-center justify-center h-full p-8">
          <div className="flex flex-col items-center gap-3">
            <CheckIcon size={36} />
            <span style={{ color: 'var(--accent-green)' }} className="text-base font-semibold">Nothing removed</span>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-full p-8">
        <span style={{ color: 'var(--text-muted)' }}>
          {searchQuery ? 'No matches found' : 'No elements to show'}
        </span>
      </div>
    );
  }

  return (
    <div className="overflow-auto flex-1" style={{ minHeight: 0 }}>
      {filtered.map((item, i) => {
        if (type === 'modified') {
          const mod = item as XmlElementModification;
          return (
            <ElementRow key={`${mod.displayKey}-${i}`} displayKey={mod.displayKey} humanType={mod.humanType} defaultExpanded={filtered.length <= 5}>
              <XmlBlockView rawXml={mod.before.rawXml} changes={mod.changes} />
            </ElementRow>
          );
        }

        if (type === 'unchanged') {
          const match = item as XmlElementMatch;
          return (
            <ElementRow key={`${match.displayKey}-${i}`} displayKey={match.displayKey} humanType={match.humanType}>
              <XmlBlockView rawXml={match.element.rawXml} />
            </ElementRow>
          );
        }

        const el = item as XmlElement;
        return (
          <ElementRow key={`${el.displayKey}-${i}`} displayKey={el.displayKey} humanType={el.humanType} defaultExpanded={filtered.length <= 5}>
            <XmlBlockView rawXml={el.rawXml} />
          </ElementRow>
        );
      })}
    </div>
  );
}

export default function XmlResultsPanel({ result }: XmlResultsPanelProps) {
  const [activeTab, setActiveTab] = useState<XmlTabId>('summary');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs: { id: XmlTabId; label: string; count: number; badgeClass: string }[] = [
    { id: 'summary', label: 'Summary', count: -1, badgeClass: '' },
    {
      id: 'modified',
      label: 'Modified',
      count: result.stats.modifiedCount,
      badgeClass: result.stats.modifiedCount > 0 ? 'badge-orange' : 'badge-gray',
    },
    {
      id: 'removed',
      label: 'Removed',
      count: result.stats.removedCount,
      badgeClass: result.stats.removedCount > 0 ? 'badge-red' : 'badge-green',
    },
    { id: 'added', label: 'Added', count: result.stats.addedCount, badgeClass: 'badge-blue' },
    { id: 'unchanged', label: 'Unchanged', count: result.stats.unchangedCount, badgeClass: 'badge-gray' },
  ];

  const currentItems =
    activeTab === 'modified' ? result.modified :
    activeTab === 'removed' ? result.removed :
    activeTab === 'added' ? result.added :
    activeTab === 'unchanged' ? result.unchanged :
    [];

  const copyText =
    activeTab === 'modified' ? result.modified.map(m => m.displayKey).join('\n') :
    activeTab === 'removed' ? result.removed.map(r => r.displayKey).join('\n') :
    activeTab === 'added' ? result.added.map(a => a.displayKey).join('\n') :
    activeTab === 'unchanged' ? result.unchanged.map(u => u.displayKey).join('\n') :
    '';

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ borderTop: '1px solid var(--border-color)' }}>
      <div className="flex items-center" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex flex-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`xml-tab-${tab.id}`}
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
            <CopyButton text={copyText} label={activeTab} />
          </div>
        )}
      </div>

      {activeTab !== 'summary' && (
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          resultCount={searchQuery ? currentItems.filter((item: { displayKey?: string; humanType?: string }) => {
            const key = item.displayKey || '';
            const ht = item.humanType || '';
            return key.toLowerCase().includes(searchQuery.toLowerCase()) || ht.toLowerCase().includes(searchQuery.toLowerCase());
          }).length : currentItems.length}
          totalCount={currentItems.length}
        />
      )}

      {activeTab === 'summary' ? (
        <SummaryView result={result} onTabChange={setActiveTab} />
      ) : (
        <ElementList
          items={currentItems}
          type={activeTab as 'removed' | 'added' | 'modified' | 'unchanged'}
          searchQuery={searchQuery}
        />
      )}
    </div>
  );
}
