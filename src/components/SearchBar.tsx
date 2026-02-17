'use client';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
}

export default function SearchBar({ value, onChange, resultCount, totalCount }: SearchBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
        <path d="M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM10.9 11.6a6 6 0 1 1 .7-.7l3.8 3.8-.7.7-3.8-3.8Z" fill="currentColor"/>
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter results..."
        data-testid="search-input"
        className="flex-1 bg-transparent border-none outline-none text-sm"
        style={{ color: 'var(--text-primary)', fontFamily: 'inherit' }}
      />
      {value && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {resultCount} / {totalCount}
        </span>
      )}
    </div>
  );
}
