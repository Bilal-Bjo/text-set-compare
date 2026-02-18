'use client';

import { XmlFieldChange } from '@/lib/xml-compare';

interface XmlBlockViewProps {
  rawXml: string;
  changes?: XmlFieldChange[];
}

function formatXml(xml: string): string {
  // Simple XML formatter: add newlines and indentation
  let formatted = '';
  let indent = 0;
  const parts = xml.replace(/>\s*</g, '><').split(/(<[^>]+>)/);

  for (const part of parts) {
    if (!part.trim()) continue;

    if (part.startsWith('</')) {
      indent--;
      formatted += '  '.repeat(Math.max(0, indent)) + part + '\n';
    } else if (part.startsWith('<') && part.endsWith('/>')) {
      formatted += '  '.repeat(indent) + part + '\n';
    } else if (part.startsWith('<')) {
      formatted += '  '.repeat(indent) + part + '\n';
      if (!part.startsWith('<?')) indent++;
    } else {
      // Text content
      formatted += '  '.repeat(indent) + part + '\n';
    }
  }

  return formatted.trim();
}

function syntaxHighlight(xml: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Simple regex-based syntax highlighting
  const regex = /(<\/?)([\w:.-]+)((?:\s+[\w:.-]+="[^"]*")*)(\s*\/?>)|([^<]+)/g;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(xml)) !== null) {
    if (match[2]) {
      // Tag
      nodes.push(<span key={key++} style={{ color: 'var(--accent-blue)' }}>{match[1]}</span>);
      nodes.push(<span key={key++} style={{ color: 'var(--accent-blue)' }}>{match[2]}</span>);
      if (match[3]) {
        // Attributes
        const attrRegex = /([\w:.-]+)(=")((?:[^"\\]|\\.)*)(")/g;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(match[3])) !== null) {
          nodes.push(<span key={key++}> </span>);
          nodes.push(<span key={key++} style={{ color: '#9cdcfe' }}>{attrMatch[1]}</span>);
          nodes.push(<span key={key++} style={{ color: 'var(--text-primary)' }}>{attrMatch[2]}</span>);
          nodes.push(<span key={key++} style={{ color: '#ce9178' }}>{attrMatch[3]}</span>);
          nodes.push(<span key={key++} style={{ color: 'var(--text-primary)' }}>{attrMatch[4]}</span>);
        }
      }
      nodes.push(<span key={key++} style={{ color: 'var(--accent-blue)' }}>{match[4]}</span>);
    } else if (match[5]) {
      // Text content
      nodes.push(<span key={key++} style={{ color: 'var(--text-primary)' }}>{match[5]}</span>);
    }
  }

  return nodes;
}

export default function XmlBlockView({ rawXml, changes }: XmlBlockViewProps) {
  const formatted = formatXml(rawXml);

  return (
    <div>
      <pre
        className="text-xs overflow-x-auto p-3 rounded"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {syntaxHighlight(formatted)}
      </pre>
      {changes && changes.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {changes.map((change, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs px-3 py-1 rounded"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>{change.field}:</span>
              <span
                className="px-1 rounded"
                style={{ background: 'rgba(244, 71, 71, 0.2)', color: 'var(--accent-red)' }}
              >
                {change.before}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <span
                className="px-1 rounded"
                style={{ background: 'rgba(106, 153, 85, 0.2)', color: 'var(--accent-green)' }}
              >
                {change.after}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
