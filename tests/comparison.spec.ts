import { test, expect } from '@playwright/test';

const DEBOUNCE_WAIT = 500;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('1 - Page loads correctly', async ({ page }) => {
  const editorBefore = page.getByTestId('editor-before');
  const editorAfter = page.getByTestId('editor-after');
  await expect(editorBefore).toBeVisible();
  await expect(editorAfter).toBeVisible();
  await expect(editorBefore).toHaveValue('');
  await expect(editorAfter).toHaveValue('');

  await expect(page.getByTestId('tab-summary')).toBeVisible();
  await expect(page.getByTestId('clear-all')).toBeVisible();
  await expect(page.getByTestId('swap-btn')).toBeVisible();
});

test('2 - Same text in both shows green checkmark', async ({ page }) => {
  const text = 'Alpha\nBravo\nCharlie';
  await page.getByTestId('editor-before').fill(text);
  await page.getByTestId('editor-after').fill(text);
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await expect(page.getByTestId('status-ok')).toBeVisible();
  await expect(page.getByText('Nothing lost')).toBeVisible();
});

test('3 - Missing lines', async ({ page }) => {
  await page.getByTestId('editor-before').fill('A\nB\nC');
  await page.getByTestId('editor-after').fill('A\nC');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await expect(page.getByTestId('status-missing')).toBeVisible();
  await expect(page.getByText(/1 line from Before is missing in After/)).toBeVisible();

  await page.getByTestId('tab-missing').click();
  await expect(page.locator('.result-line', { hasText: 'B' })).toBeVisible();
});

test('4 - Order does not matter (set comparison)', async ({ page }) => {
  await page.getByTestId('editor-before').fill('A\nB\nC');
  await page.getByTestId('editor-after').fill('C\nA\nB');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await expect(page.getByTestId('status-ok')).toBeVisible();
});

test('5 - Duplicate deduplication', async ({ page }) => {
  await page.getByTestId('editor-before').fill('A\nA\nB');
  await page.getByTestId('editor-after').fill('A\nB');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await expect(page.getByTestId('status-ok')).toBeVisible();
});

test('6 - Added lines', async ({ page }) => {
  await page.getByTestId('editor-before').fill('A\nB');
  await page.getByTestId('editor-after').fill('A\nB\nC');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await page.getByTestId('tab-added').click();
  await expect(page.locator('.result-line', { hasText: 'C' })).toBeVisible();
});

test('7 - In Both tab', async ({ page }) => {
  await page.getByTestId('editor-before').fill('A\nB\nC');
  await page.getByTestId('editor-after').fill('B\nC\nD');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await page.getByTestId('tab-inBoth').click();
  await expect(page.locator('.result-line', { hasText: 'B' })).toBeVisible();
  await expect(page.locator('.result-line', { hasText: 'C' })).toBeVisible();
});

test('8 - Empty Before shows green (0 missing)', async ({ page }) => {
  await page.getByTestId('editor-after').fill('X\nY');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  const missingTab = page.getByTestId('tab-missing');
  const badge = missingTab.locator('.badge');
  await expect(badge).toHaveText('0');
  await expect(badge).toHaveClass(/badge-green/);
});

test('9 - Empty After with Before text shows all lines missing', async ({ page }) => {
  await page.getByTestId('editor-before').fill('A\nB');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await expect(page.getByTestId('status-missing')).toBeVisible();
  await expect(page.getByText(/2 lines from Before are missing in After/)).toBeVisible();
});

test('10 - Ignore empty lines toggle', async ({ page }) => {
  // Default: "Ignore empty lines" is ON
  await page.getByTestId('editor-before').fill('A\n\nB');
  await page.getByTestId('editor-after').fill('A\nB');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  // With ignore empty ON (default): empty line is ignored, so all present
  await expect(page.getByTestId('status-ok')).toBeVisible();

  // Disable ignore empty lines
  await page.getByTestId('toggle-empty').click();
  await page.waitForTimeout(DEBOUNCE_WAIT);

  // Now empty line counts as missing
  await expect(page.getByTestId('status-missing')).toBeVisible();
});

test('11 - Case insensitive toggle', async ({ page }) => {
  await page.getByTestId('editor-before').fill('Hello\nWorld');
  await page.getByTestId('editor-after').fill('hello\nworld');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  // Without toggle: case matters, so 2 missing
  await expect(page.getByTestId('status-missing')).toBeVisible();
  await expect(page.getByText(/2 lines from Before are missing in After/)).toBeVisible();

  // Enable case insensitive
  await page.getByTestId('toggle-case').click();
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await expect(page.getByTestId('status-ok')).toBeVisible();
});

test('12 - Clear all resets everything', async ({ page }) => {
  await page.getByTestId('editor-before').fill('Foo');
  await page.getByTestId('editor-after').fill('Bar');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await page.getByTestId('clear-all').click();
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await expect(page.getByTestId('editor-before')).toHaveValue('');
  await expect(page.getByTestId('editor-after')).toHaveValue('');
  await expect(page.getByText('Paste text to compare')).toBeVisible();
});

test('13 - Tab navigation', async ({ page }) => {
  await page.getByTestId('editor-before').fill('A\nB');
  await page.getByTestId('editor-after').fill('A\nC');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  for (const tabId of ['tab-summary', 'tab-missing', 'tab-added', 'tab-inBoth'] as const) {
    await page.getByTestId(tabId).click();
    await expect(page.getByTestId(tabId)).toHaveClass(/active/);
  }
});

test('14 - Search filter with highlighting', async ({ page }) => {
  await page.getByTestId('editor-before').fill('Apple\nBanana\nAvocado\nCherry');
  await page.getByTestId('editor-after').fill('Grape');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await page.getByTestId('tab-missing').click();

  await page.getByTestId('search-input').fill('a');
  // "a" appears in: Apple, Banana, Avocado (case-insensitive search filter)
  const resultLines = page.locator('.result-line');
  await expect(resultLines).toHaveCount(3);

  const highlights = page.locator('.search-highlight');
  await expect(highlights.first()).toBeVisible();
});

test('15 - Stat cards click navigates to tab', async ({ page }) => {
  await page.getByTestId('editor-before').fill('A\nB\nC');
  await page.getByTestId('editor-after').fill('A');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await page.getByTestId('stat-missing').click();
  await expect(page.getByTestId('tab-missing')).toHaveClass(/active/);
});

test('16 - Live updates without button click', async ({ page }) => {
  await page.getByTestId('editor-before').fill('X');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await expect(page.getByTestId('status-missing')).toBeVisible();

  await page.getByTestId('editor-after').fill('X');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await expect(page.getByTestId('status-ok')).toBeVisible();
});

test('17 - Performance with 5000 lines', async ({ page }) => {
  // Use evaluate to set values directly for large content (fill is too slow for 5000 lines)
  await page.evaluate(() => {
    const lines = Array.from({ length: 5000 }, (_, i) => `Line ${i + 1}`).join('\n');
    const before = document.querySelector('[data-testid="editor-before"]') as HTMLTextAreaElement;
    const after = document.querySelector('[data-testid="editor-after"]') as HTMLTextAreaElement;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
    nativeInputValueSetter.call(before, lines);
    before.dispatchEvent(new Event('input', { bubbles: true }));
    nativeInputValueSetter.call(after, lines);
    after.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(1000);

  await expect(page.getByTestId('status-ok')).toBeVisible({ timeout: 15000 });
});

test('18 - Swap button switches content', async ({ page }) => {
  await page.getByTestId('editor-before').fill('Left content');
  await page.getByTestId('editor-after').fill('Right content');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await page.getByTestId('swap-btn').click();
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await expect(page.getByTestId('editor-before')).toHaveValue('Right content');
  await expect(page.getByTestId('editor-after')).toHaveValue('Left content');
});

test('19 - Trim whitespace toggle', async ({ page }) => {
  // Default: trim whitespace is ON
  await page.getByTestId('editor-before').fill('  Hello  ');
  await page.getByTestId('editor-after').fill('Hello');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  // With trim ON: " Hello " trims to "Hello", matches
  await expect(page.getByTestId('status-ok')).toBeVisible();

  // Disable trim whitespace
  await page.getByTestId('toggle-trim').click();
  await page.waitForTimeout(DEBOUNCE_WAIT);

  // Now "  Hello  " !== "Hello", so 1 missing
  await expect(page.getByTestId('status-missing')).toBeVisible();
});

test('20 - Line count shows total and unique', async ({ page }) => {
  await page.getByTestId('editor-before').fill('A\nA\nB\nC');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  const lineCount = page.getByTestId('linecount-before');
  await expect(lineCount).toContainText('4 lines');
  await expect(lineCount).toContainText('3 unique');
});

test('21 - Copy button appears on result tabs', async ({ page }) => {
  await page.getByTestId('editor-before').fill('A\nB\nC');
  await page.getByTestId('editor-after').fill('A');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await page.getByTestId('tab-missing').click();
  await expect(page.getByTestId('copy-missing')).toBeVisible();
  await expect(page.getByTestId('copy-missing')).toContainText('Copy 2 lines');
});
