import { getElementKey, getHumanLabel, isSalesforceMetadata, hasKeyMapping } from './sf-metadata';

export interface XmlCompareOptions {
  ignoreComments: boolean;
  normalizeWhitespace: boolean;
}

export interface XmlElement {
  tagName: string;
  key: string | null;
  displayKey: string; // Human-readable: "Account.Name" or the tag name
  humanType: string; // "Field Permissions" etc
  rawXml: string;
  normalizedXml: string;
  children: Map<string, string>; // child tag → text content
}

export interface XmlElementMatch {
  tagName: string;
  key: string | null;
  displayKey: string;
  humanType: string;
  element: XmlElement;
}

export interface XmlFieldChange {
  field: string;
  before: string;
  after: string;
}

export interface XmlElementModification {
  tagName: string;
  key: string | null;
  displayKey: string;
  humanType: string;
  before: XmlElement;
  after: XmlElement;
  changes: XmlFieldChange[];
}

export interface XmlTypeStats {
  unchanged: number;
  modified: number;
  removed: number;
  added: number;
}

export interface XmlCompareResult {
  isSalesforceMetadata: boolean;
  rootTag: string;
  unchanged: XmlElementMatch[];
  modified: XmlElementModification[];
  removed: XmlElement[];
  added: XmlElement[];
  stats: {
    totalBefore: number;
    totalAfter: number;
    unchangedCount: number;
    modifiedCount: number;
    removedCount: number;
    addedCount: number;
  };
  byType: Map<string, XmlTypeStats>;
}

/**
 * Detect whether a string looks like XML.
 */
export function detectXml(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Starts with XML declaration or a tag
  return trimmed.startsWith('<?xml') || /^<[a-zA-Z][\w.-]*[\s>\/]/.test(trimmed);
}

/**
 * Normalize an XML element for comparison.
 */
function normalizeElement(element: Element, options: XmlCompareOptions): string {
  const clone = element.cloneNode(true) as Element;

  // Remove comments if requested
  if (options.ignoreComments) {
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT);
    const comments: Comment[] = [];
    while (walker.nextNode()) {
      comments.push(walker.currentNode as Comment);
    }
    for (const comment of comments) {
      comment.parentNode?.removeChild(comment);
    }
  }

  // Serialize
  let xml = new XMLSerializer().serializeToString(clone);

  // Remove namespace declarations for cleaner comparison
  xml = xml.replace(/\s*xmlns(:[a-zA-Z0-9]+)?="[^"]*"/g, '');

  if (options.normalizeWhitespace) {
    // Collapse whitespace between tags
    xml = xml.replace(/>\s+</g, '><');
    // Collapse whitespace within text nodes
    xml = xml.replace(/\s+/g, ' ');
    xml = xml.trim();
  }

  return xml;
}

/**
 * Extract child element text content map.
 */
function extractChildren(element: Element): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < element.children.length; i++) {
    const child = element.children[i];
    // Use localName to ignore namespace prefix
    map.set(child.localName, child.textContent?.trim() || '');
  }
  return map;
}

/**
 * Parse XML string and extract top-level child elements.
 */
export function parseXmlElements(
  xml: string,
  options: XmlCompareOptions
): { rootTag: string; elements: XmlElement[]; error: string | null } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return { rootTag: '', elements: [], error: parseError.textContent || 'XML parse error' };
  }

  const root = doc.documentElement;
  const rootTag = root.localName;
  const elements: XmlElement[] = [];

  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    const tagName = child.localName;
    const key = getElementKey(tagName, child);
    const humanType = getHumanLabel(tagName);
    // For composite keys like "Layout::RecordType", show as "Layout / RecordType"
    // Strip trailing '::' for keys without optional second part
    const displayKey = key
      ? key.replace(/::+$/, '').replace(/::/g, ' / ')
      : tagName;

    elements.push({
      tagName,
      key,
      displayKey,
      humanType,
      rawXml: new XMLSerializer().serializeToString(child),
      normalizedXml: normalizeElement(child, options),
      children: extractChildren(child),
    });
  }

  return { rootTag, elements, error: null };
}

/**
 * Compare two XML strings at the element level.
 */
export function compareXml(
  before: string,
  after: string,
  options: XmlCompareOptions
): XmlCompareResult {
  const beforeParsed = parseXmlElements(before, options);
  const afterParsed = parseXmlElements(after, options);

  // If parsing failed, return empty result
  if (beforeParsed.error || afterParsed.error) {
    return {
      isSalesforceMetadata: false,
      rootTag: beforeParsed.rootTag || afterParsed.rootTag,
      unchanged: [],
      modified: [],
      removed: [],
      added: [],
      stats: { totalBefore: 0, totalAfter: 0, unchangedCount: 0, modifiedCount: 0, removedCount: 0, addedCount: 0 },
      byType: new Map(),
    };
  }

  const sfMetadata = isSalesforceMetadata(beforeParsed.rootTag) || isSalesforceMetadata(afterParsed.rootTag);

  // Group elements by tagName
  const beforeByType = groupByTagName(beforeParsed.elements);
  const afterByType = groupByTagName(afterParsed.elements);

  const unchanged: XmlElementMatch[] = [];
  const modified: XmlElementModification[] = [];
  const removed: XmlElement[] = [];
  const added: XmlElement[] = [];
  const byType = new Map<string, XmlTypeStats>();

  // Process all tag types from both sides
  const allTypes = new Set([...beforeByType.keys(), ...afterByType.keys()]);

  for (const tagName of allTypes) {
    const beforeElements = beforeByType.get(tagName) || [];
    const afterElements = afterByType.get(tagName) || [];
    const typeStats: XmlTypeStats = { unchanged: 0, modified: 0, removed: 0, added: 0 };

    if (hasKeyMapping(tagName)) {
      // Match by key field
      const afterByKey = new Map<string, XmlElement>();
      const afterUnmatched = new Set<string>();
      for (const el of afterElements) {
        const k = el.key || el.normalizedXml;
        afterByKey.set(k, el);
        afterUnmatched.add(k);
      }

      for (const beforeEl of beforeElements) {
        const k = beforeEl.key || beforeEl.normalizedXml;
        const afterEl = afterByKey.get(k);

        if (afterEl) {
          afterUnmatched.delete(k);
          // Compare by child values (order-independent) instead of serialized XML
          const changes = computeChanges(beforeEl, afterEl);
          if (changes.length === 0) {
            unchanged.push({
              tagName,
              key: beforeEl.key,
              displayKey: beforeEl.displayKey,
              humanType: beforeEl.humanType,
              element: beforeEl,
            });
            typeStats.unchanged++;
          } else {
            modified.push({
              tagName,
              key: beforeEl.key,
              displayKey: beforeEl.displayKey,
              humanType: beforeEl.humanType,
              before: beforeEl,
              after: afterEl,
              changes,
            });
            typeStats.modified++;
          }
        } else {
          removed.push(beforeEl);
          typeStats.removed++;
        }
      }

      // Remaining unmatched after elements are added
      for (const k of afterUnmatched) {
        const el = afterByKey.get(k)!;
        added.push(el);
        typeStats.added++;
      }
    } else {
      // No key mapping — match by normalized content
      const afterNormalized = new Map<string, XmlElement[]>();
      for (const el of afterElements) {
        const existing = afterNormalized.get(el.normalizedXml) || [];
        existing.push(el);
        afterNormalized.set(el.normalizedXml, existing);
      }

      const matchedAfter = new Set<string>();

      for (const beforeEl of beforeElements) {
        const matches = afterNormalized.get(beforeEl.normalizedXml);
        if (matches && matches.length > 0) {
          matches.shift(); // consume one match
          if (matches.length === 0) {
            matchedAfter.add(beforeEl.normalizedXml);
          }
          unchanged.push({
            tagName,
            key: null,
            displayKey: beforeEl.displayKey,
            humanType: beforeEl.humanType,
            element: beforeEl,
          });
          typeStats.unchanged++;
        } else {
          removed.push(beforeEl);
          typeStats.removed++;
        }
      }

      // Remaining unmatched after elements
      for (const [norm, elements] of afterNormalized) {
        for (const el of elements) {
          added.push(el);
          typeStats.added++;
        }
      }
    }

    if (typeStats.unchanged + typeStats.modified + typeStats.removed + typeStats.added > 0) {
      byType.set(tagName, typeStats);
    }
  }

  return {
    isSalesforceMetadata: sfMetadata,
    rootTag: beforeParsed.rootTag,
    unchanged,
    modified,
    removed,
    added,
    stats: {
      totalBefore: beforeParsed.elements.length,
      totalAfter: afterParsed.elements.length,
      unchangedCount: unchanged.length,
      modifiedCount: modified.length,
      removedCount: removed.length,
      addedCount: added.length,
    },
    byType,
  };
}

function groupByTagName(elements: XmlElement[]): Map<string, XmlElement[]> {
  const map = new Map<string, XmlElement[]>();
  for (const el of elements) {
    const existing = map.get(el.tagName) || [];
    existing.push(el);
    map.set(el.tagName, existing);
  }
  return map;
}

function computeChanges(before: XmlElement, after: XmlElement): XmlFieldChange[] {
  const changes: XmlFieldChange[] = [];
  const allFields = new Set([...before.children.keys(), ...after.children.keys()]);

  for (const field of allFields) {
    const bVal = before.children.get(field) ?? '(not set)';
    const aVal = after.children.get(field) ?? '(not set)';
    if (bVal !== aVal) {
      changes.push({ field, before: bVal, after: aVal });
    }
  }

  return changes;
}
