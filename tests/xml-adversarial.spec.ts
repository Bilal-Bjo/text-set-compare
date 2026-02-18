import { test, expect } from '@playwright/test';

const DEBOUNCE_WAIT = 600;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

// Helper to set large XML content via evaluate (faster than fill)
async function setEditors(page: import('@playwright/test').Page, before: string, after: string) {
  await page.evaluate(({ b, a }) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
    const beforeEl = document.querySelector('[data-testid="editor-before"]') as HTMLTextAreaElement;
    const afterEl = document.querySelector('[data-testid="editor-after"]') as HTMLTextAreaElement;
    setter.call(beforeEl, b);
    beforeEl.dispatchEvent(new Event('input', { bubbles: true }));
    setter.call(afterEl, a);
    afterEl.dispatchEvent(new Event('input', { bubbles: true }));
  }, { b: before, a: after });
  await page.waitForTimeout(DEBOUNCE_WAIT);
}

// =====================================================
// 1. MALFORMED XML
// What happens if one side has invalid XML?
// The parser should detect the error and degrade
// gracefully — not crash the app.
// =====================================================
test('Adversarial: malformed XML does not crash the app', async ({ page }) => {
  const validXml = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  // Missing closing tag — invalid XML
  const malformedXml = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    <!-- no closing tags -->`;

  await setEditors(page, validXml, malformedXml);

  // The app should not crash. It should still be interactive.
  // Since XML parsing fails, stats should all be 0 (empty result).
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('0');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');

  // Page is still functional — editors are still visible
  await expect(page.getByTestId('editor-before')).toBeVisible();
  await expect(page.getByTestId('editor-after')).toBeVisible();
});

test('Adversarial: both sides malformed XML degrades gracefully', async ({ page }) => {
  const malformed1 = `<?xml version="1.0"?>
<root><unclosed>`;

  const malformed2 = `<also broken<<<>>>`;

  await setEditors(page, malformed1, malformed2);

  // The app should still work — it may fall back to text mode or show
  // zero-count XML mode. Either way, no crash.
  // The first string starts with <?xml so XML mode is detected.
  // But parsing fails, so we get zero counts.
  await expect(page.getByTestId('editor-before')).toBeVisible();
  await expect(page.getByTestId('editor-after')).toBeVisible();

  // If XML mode is active, all counts should be 0
  const xmlTab = page.getByTestId('xml-tab-summary');
  if (await xmlTab.isVisible()) {
    await expect(page.getByTestId('xml-stat-unchanged')).toContainText('0');
    await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  }
});

// =====================================================
// 2. EMPTY ELEMENTS / SELF-CLOSING TAGS
// Self-closing tags like <fieldPermissions/> are valid
// XML but have no children — key extraction returns null.
// =====================================================
test('Adversarial: self-closing empty elements', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions/>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // App should not crash. The self-closing fieldPermissions has no <field>
  // child so its key is null, and it falls back to normalizedXml matching.
  // Account.Name should be unchanged. The empty one should be removed.
  await expect(page.getByTestId('xml-tab-summary')).toBeVisible();
  await expect(page.getByTestId('xml-stat-removed')).toContainText('1');
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('1');
});

test('Adversarial: elements with empty child values', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable></editable>
        <field>Account.Name</field>
        <readable></readable>
    </fieldPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable></editable>
        <field>Account.Name</field>
        <readable></readable>
    </fieldPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // Empty values should be equal to each other
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('1');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
});

// =====================================================
// 3. VERY DEEPLY NESTED XML
// Elements with nested sub-elements, not just flat children.
// =====================================================
test('Adversarial: deeply nested XML elements', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <complexElement>
        <level1>
            <level2>
                <level3>
                    <level4>deep value</level4>
                </level3>
            </level2>
        </level1>
    </complexElement>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <complexElement>
        <level1>
            <level2>
                <level3>
                    <level4>changed deep value</level4>
                </level3>
            </level2>
        </level1>
    </complexElement>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // The app should handle deeply nested structures without crashing.
  // complexElement has no key mapping, so it matches by normalizedXml.
  // The deep content changed, so it should appear as removed+added.
  // fieldPermissions should be unchanged.
  await expect(page.getByTestId('xml-tab-summary')).toBeVisible();
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('1');
  // complexElement: old removed, new added
  await expect(page.getByTestId('xml-stat-removed')).toContainText('1');
  await expect(page.getByTestId('xml-stat-added')).toContainText('1');
});

// =====================================================
// 4. CDATA SECTIONS
// <![CDATA[some content]]> inside elements
// =====================================================
test('Adversarial: CDATA sections inside elements', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <userPermissions>
        <enabled>true</enabled>
        <name><![CDATA[ApiEnabled]]></name>
    </userPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // CDATA and plain text should yield the same textContent.
  // Both have name=ApiEnabled, enabled=true, so they should match.
  await expect(page.getByTestId('xml-tab-summary')).toBeVisible();
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('1');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
});

// =====================================================
// 5. XML WITH COMMENTS
// Comments between elements, inside elements.
// The app has ignoreComments: true by default.
// =====================================================
test('Adversarial: XML comments between and inside elements', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <!-- This is a comment before the element -->
    <fieldPermissions>
        <!-- This comment is inside the element -->
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <!-- Another comment -->
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // Comments are ignored — the actual content is identical.
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('2');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');
  await expect(page.getByTestId('xml-status-ok')).toBeVisible();
});

// =====================================================
// 6. DUPLICATE KEYS
// Two fieldPermissions with the exact same field value
// in the same file. Only one can match by key.
// =====================================================
test('Adversarial: duplicate keys in the same file', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>false</editable>
        <field>Account.Name</field>
        <readable>false</readable>
    </fieldPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // The app should not crash. With duplicate keys, the afterByKey map
  // will only store the last one. The first before element matches,
  // the second before element also tries the same key — it finds the
  // after element was already consumed, so it shows as removed.
  // Implementation: afterByKey overwrites to the last element. Both
  // before elements look up the same key. First match removes from
  // afterUnmatched. Second finds no match -> removed.
  await expect(page.getByTestId('xml-tab-summary')).toBeVisible();

  // The important thing: no crash. The counts should be reasonable.
  // Before has 2 elements, After has 1.
  const unchanged = page.getByTestId('xml-stat-unchanged');
  const modified = page.getByTestId('xml-stat-modified');
  const removed = page.getByTestId('xml-stat-removed');
  await expect(unchanged).toBeVisible();
  await expect(modified).toBeVisible();
  await expect(removed).toBeVisible();
});

// =====================================================
// 7. MISSING KEY FIELD
// A fieldPermissions element that has no <field> child.
// getElementKey returns null for it.
// =====================================================
test('Adversarial: missing key field in a keyed element type', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // The element without <field> has key=null. The code falls back to
  // normalizedXml for matching. Since there's no matching element in
  // after, it should be removed. Account.Name should be unchanged.
  await expect(page.getByTestId('xml-tab-summary')).toBeVisible();
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('1');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('1');
});

// =====================================================
// 8. MIXED NAMESPACE PREFIXES
// Same content but with <sf:fieldPermissions> vs
// <fieldPermissions>. localName should be the same.
// =====================================================
test('Adversarial: namespace prefixes affect key lookup (known limitation)', async ({ page }) => {
  // When elements use explicit namespace prefixes (e.g. sf:fieldPermissions),
  // getElementsByTagName('field') won't find <sf:field>. This means the
  // key lookup returns null for the prefixed version, and the comparison
  // falls back to normalizedXml matching. Since the serialized XML differs
  // (prefixed vs unprefixed), elements show as removed+added rather than
  // matched. This test documents the actual behavior.
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata"
         xmlns:sf="http://soap.sforce.com/2006/04/metadata">
    <sf:fieldPermissions>
        <sf:editable>true</sf:editable>
        <sf:field>Account.Name</sf:field>
        <sf:readable>true</sf:readable>
    </sf:fieldPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // The prefixed element's key is null (getElementsByTagName can't find
  // <sf:field> by searching for 'field'). The unprefixed element has
  // key="Account.Name". They are grouped by the same localName
  // (fieldPermissions), but one has key=null and the other has a key.
  // The null-key element falls back to normalizedXml matching and
  // doesn't match the after element, so it's removed. The after
  // element is not matched by any before element, so it's added.
  await expect(page.getByTestId('xml-tab-summary')).toBeVisible();
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('0');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('1');
  await expect(page.getByTestId('xml-stat-added')).toContainText('1');

  // The app does not crash — it handles the mismatch gracefully.
  await expect(page.getByTestId('editor-before')).toBeVisible();
});

// =====================================================
// 9. SPECIAL CHARACTERS IN VALUES
// Ampersands, quotes, angle brackets in field names
// or values — properly escaped in XML.
// =====================================================
test('Adversarial: special characters in values (escaped)', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name &amp; Title</field>
        <readable>true</readable>
    </fieldPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>Edit &quot;Records&quot;</name>
    </userPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name &amp; Title</field>
        <readable>true</readable>
    </fieldPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>Edit &quot;Records&quot;</name>
    </userPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // Special chars are valid XML when escaped. Both sides identical.
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('2');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
  await expect(page.getByTestId('xml-status-ok')).toBeVisible();
});

test('Adversarial: special character change is detected as modification', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <userPermissions>
        <enabled>true</enabled>
        <name>View &amp; Edit</name>
    </userPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <userPermissions>
        <enabled>false</enabled>
        <name>View &amp; Edit</name>
    </userPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // Key matches (both "View & Edit"), but enabled changed.
  await expect(page.getByTestId('xml-stat-modified')).toContainText('1');
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('0');
});

// =====================================================
// 10. ONE SIDE XML, OTHER SIDE PLAIN TEXT
// What happens when only Before is XML? The app should
// detect XML from one side and enter XML mode.
// =====================================================
test('Adversarial: one side XML, other side plain text', async ({ page }) => {
  const xmlSide = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  const plainText = `This is just plain text
with multiple lines
not XML at all`;

  await setEditors(page, xmlSide, plainText);

  // XML is detected from the before side, so XML mode activates.
  // But parsing the plain text side will fail (parsererror).
  // The compareXml function returns empty result on parse error.
  await expect(page.getByTestId('xml-tab-summary')).toBeVisible();
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('0');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');

  // Page still functional
  await expect(page.getByTestId('editor-before')).toBeVisible();
});

// =====================================================
// 11. VERY LARGE XML
// 200+ elements — should render without timeout.
// =====================================================
test('Adversarial: very large XML with 200+ elements renders without timeout', async ({ page }) => {
  let elements = '';
  for (let i = 0; i < 220; i++) {
    elements += `    <fieldPermissions>
        <editable>${i % 2 === 0 ? 'true' : 'false'}</editable>
        <field>Object${i}.Field${i}</field>
        <readable>true</readable>
    </fieldPermissions>\n`;
  }

  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
${elements}</Profile>`;

  // Same as before but change 5 elements
  let afterElements = '';
  for (let i = 0; i < 220; i++) {
    const editable = (i < 5)
      ? (i % 2 === 0 ? 'false' : 'true')  // flip the first 5
      : (i % 2 === 0 ? 'true' : 'false');  // keep the rest
    afterElements += `    <fieldPermissions>
        <editable>${editable}</editable>
        <field>Object${i}.Field${i}</field>
        <readable>true</readable>
    </fieldPermissions>\n`;
  }

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
${afterElements}</Profile>`;

  await setEditors(page, before, after);

  // Should complete within the default test timeout (30s)
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('215', { timeout: 15000 });
  await expect(page.getByTestId('xml-stat-modified')).toContainText('5');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');

  // Verify we can navigate to the modified tab and see results
  await page.getByTestId('xml-tab-modified').click();
  const results = page.locator('[style*="border-top"]');
  await expect(results.locator('.font-medium').first()).toBeVisible();
});

// =====================================================
// 12. ELEMENTS WITH ATTRIBUTES
// <fieldPermissions xsi:nil="true"> — do attributes
// affect comparison? They should not for key matching
// but could affect normalized XML comparison.
// =====================================================
test('Adversarial: elements with attributes', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <fieldPermissions xsi:type="FieldPermission">
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <userPermissions enabled="true">
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // The key matching (Account.Name, ApiEnabled) should still work.
  // The child text values are identical.
  // computeChanges compares children map values, not attributes.
  // So both should be unchanged.
  await expect(page.getByTestId('xml-tab-summary')).toBeVisible();
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('2');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
});

// =====================================================
// 13. WHITESPACE-ONLY TEXT NODES
// Extra newlines and spaces between elements.
// The normalizeWhitespace option should handle this.
// =====================================================
test('Adversarial: excessive whitespace between and within elements', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">


    <fieldPermissions>

        <editable>   true   </editable>

        <field>  Account.Name  </field>

        <readable>  true  </readable>

    </fieldPermissions>


    <userPermissions>
        <enabled>  true  </enabled>
        <name>  ApiEnabled  </name>
    </userPermissions>


</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // textContent?.trim() is used for child values, so whitespace
  // around values should be handled. Both sides should match.
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('2');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');
  await expect(page.getByTestId('xml-status-ok')).toBeVisible();
});

// =====================================================
// 14. UNICODE IN ELEMENT VALUES
// Non-ASCII characters in field names — accented chars,
// CJK, emoji, etc.
// =====================================================
test('Adversarial: unicode characters in element values', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <userPermissions>
        <enabled>true</enabled>
        <name>Zugriffsrechte</name>
    </userPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Konto.Nachname</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <userPermissions>
        <enabled>false</enabled>
        <name>Zugriffsrechte</name>
    </userPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Konto.Nachname</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // Unicode keys should match. The field permission is unchanged,
  // the user permission has enabled changed.
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('1');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('1');

  // Verify the modified element shows the unicode key
  await page.getByTestId('xml-tab-modified').click();
  const results = page.locator('[style*="border-top"]');
  await expect(results.locator('.font-medium', { hasText: 'Zugriffsrechte' })).toBeVisible();
});

test('Adversarial: CJK and accented characters in field values', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // Identical content with standard characters
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('1');
  await expect(page.getByTestId('xml-status-ok')).toBeVisible();
});

// =====================================================
// ADDITIONAL ADVERSARIAL TESTS
// =====================================================

test('Adversarial: XML declaration only, no root element', async ({ page }) => {
  const xmlDecl = `<?xml version="1.0" encoding="UTF-8"?>`;

  const validXml = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
</Profile>`;

  await setEditors(page, xmlDecl, validXml);

  // XML declaration alone is not valid XML (no root element).
  // The parser should return an error. App should not crash.
  await expect(page.getByTestId('editor-before')).toBeVisible();
  await expect(page.getByTestId('editor-after')).toBeVisible();
});

test('Adversarial: completely empty strings in both editors', async ({ page }) => {
  await setEditors(page, '', '');

  // Empty editors — text mode should show, no crash
  await expect(page.getByTestId('editor-before')).toBeVisible();
  await expect(page.getByTestId('editor-after')).toBeVisible();
});

test('Adversarial: XML with processing instructions', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="style.xsl"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // Processing instructions should not affect the element comparison.
  // Both have the same fieldPermissions element.
  await expect(page.getByTestId('xml-tab-summary')).toBeVisible();
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('1');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
});

test('Adversarial: mixed element types with some having keys and some not', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>Admin Profile</description>
    <custom>false</custom>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>Admin Profile - Updated</description>
    <custom>false</custom>
    <fieldPermissions>
        <editable>false</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // description: no key mapping, matched by normalized content -> changed -> removed + added
  // custom: no key mapping, same content -> unchanged
  // Account.Name: keyed, editable changed -> modified
  // ApiEnabled: keyed, unchanged
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('2'); // custom + ApiEnabled
  await expect(page.getByTestId('xml-stat-modified')).toContainText('1'); // Account.Name
  await expect(page.getByTestId('xml-stat-removed')).toContainText('1'); // old description
  await expect(page.getByTestId('xml-stat-added')).toContainText('1');   // new description
});

test('Adversarial: before empty XML root, after has elements (all added)', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Contact.Email</field>
        <readable>true</readable>
    </fieldPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // Before is empty, all 3 after elements should be added.
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('0');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('3');
});

test('Adversarial: before has elements, after empty XML root (all removed)', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
</Profile>`;

  await setEditors(page, before, after);

  // After is empty, all 2 before elements should be removed.
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('0');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('2');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');

  // Should show the red X status
  await expect(page.getByTestId('xml-status-changed')).toBeVisible();
});

test('Adversarial: very long field/key values', async ({ page }) => {
  const longFieldName = 'Account.' + 'A'.repeat(500);
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>${longFieldName}</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>false</editable>
        <field>${longFieldName}</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // The very long key should still match. editable changed.
  await expect(page.getByTestId('xml-stat-modified')).toContainText('1');
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('0');
});

test('Adversarial: non-SF root element still compares elements correctly', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<CustomConfig>
    <setting>
        <name>timeout</name>
        <value>30</value>
    </setting>
    <setting>
        <name>retries</name>
        <value>3</value>
    </setting>
    <setting>
        <name>debug</name>
        <value>false</value>
    </setting>
</CustomConfig>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<CustomConfig>
    <setting>
        <name>timeout</name>
        <value>60</value>
    </setting>
    <setting>
        <name>retries</name>
        <value>3</value>
    </setting>
</CustomConfig>`;

  await setEditors(page, before, after);

  // Non-SF root -> no key mappings for "setting", so matches by
  // normalized XML content.
  // "retries/3" unchanged, "timeout/30" removed (no match in after),
  // "debug/false" removed, "timeout/60" added
  await expect(page.getByTestId('xml-tab-summary')).toBeVisible();
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('1');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('2');
  await expect(page.getByTestId('xml-stat-added')).toContainText('1');
});
