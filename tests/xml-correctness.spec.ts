import { test, expect } from '@playwright/test';

const DEBOUNCE_WAIT = 600;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Clear localStorage to avoid stale state from other tests
  await page.evaluate(() => localStorage.clear());
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
// HELPER: wrap elements in a Profile root
// =====================================================
function profileXml(elements: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
${elements}
</Profile>`;
}

function permSetXml(elements: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
${elements}
</PermissionSet>`;
}

// =====================================================
// TEST 1: Every SF metadata type keyed correctly
// Verifies that each known keyed type matches elements
// by its correct key field, not by position or XML text.
// =====================================================
test('Every SF metadata type matches by its correct key field', async ({ page }) => {
  // Before: one element of each keyed type
  const before = profileXml(`
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
    <tabVisibilities>
        <tab>standard-Account</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <recordTypeVisibilities>
        <default>true</default>
        <recordType>Account.Business</recordType>
        <visible>true</visible>
    </recordTypeVisibilities>
    <applicationVisibilities>
        <application>standard__LightningService</application>
        <default>false</default>
        <visible>true</visible>
    </applicationVisibilities>
    <classAccesses>
        <apexClass>MyController</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <pageAccesses>
        <apexPage>MyVFPage</apexPage>
        <enabled>true</enabled>
    </pageAccesses>
    <layoutAssignments>
        <layout>Account-Account Layout</layout>
    </layoutAssignments>
    <customPermissions>
        <enabled>true</enabled>
        <name>CanExportData</name>
    </customPermissions>
    <flowAccesses>
        <enabled>true</enabled>
        <flow>My_Flow</flow>
    </flowAccesses>
    <customMetadataTypeAccesses>
        <enabled>true</enabled>
        <name>Config__mdt</name>
    </customMetadataTypeAccesses>
    <customSettingAccesses>
        <enabled>true</enabled>
        <name>AppConfig__c</name>
    </customSettingAccesses>`);

  // After: same elements, same keys, but modify exactly one field in each.
  // Key fields stay the same so matching should work.
  const after = profileXml(`
    <fieldPermissions>
        <editable>false</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <userPermissions>
        <enabled>false</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
    <tabVisibilities>
        <tab>standard-Account</tab>
        <visibility>DefaultOff</visibility>
    </tabVisibilities>
    <recordTypeVisibilities>
        <default>false</default>
        <recordType>Account.Business</recordType>
        <visible>true</visible>
    </recordTypeVisibilities>
    <applicationVisibilities>
        <application>standard__LightningService</application>
        <default>true</default>
        <visible>true</visible>
    </applicationVisibilities>
    <classAccesses>
        <apexClass>MyController</apexClass>
        <enabled>false</enabled>
    </classAccesses>
    <pageAccesses>
        <apexPage>MyVFPage</apexPage>
        <enabled>false</enabled>
    </pageAccesses>
    <layoutAssignments>
        <layout>Account-Account Lightning Layout</layout>
    </layoutAssignments>
    <customPermissions>
        <enabled>false</enabled>
        <name>CanExportData</name>
    </customPermissions>
    <flowAccesses>
        <enabled>false</enabled>
        <flow>My_Flow</flow>
    </flowAccesses>
    <customMetadataTypeAccesses>
        <enabled>false</enabled>
        <name>Config__mdt</name>
    </customMetadataTypeAccesses>
    <customSettingAccesses>
        <enabled>false</enabled>
        <name>AppConfig__c</name>
    </customSettingAccesses>`);

  await setEditors(page, before, after);

  // 13 elements total in before, 13 in after.
  // layoutAssignments: key is layout::recordType. Before has "Account-Account Layout::",
  //   after has "Account-Account Lightning Layout::". Different keys = 1 removed, 1 added.
  // The other 12 types: same key, different values = 12 modified.
  // Total: 0 unchanged, 12 modified, 1 removed, 1 added
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('0');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('12');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('1');
  await expect(page.getByTestId('xml-stat-added')).toContainText('1');

  // Verify the modified tab lists the correct elements
  await page.getByTestId('xml-tab-modified').click();
  const results = page.locator('[style*="border-top"]');
  // Each of the 12 keyed types should show as modified:
  await expect(results.locator('.font-medium', { hasText: 'Account.Name' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'Account' }).first()).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'ApiEnabled' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'standard-Account' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'Account.Business' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'standard__LightningService' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'MyController' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'MyVFPage' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'CanExportData' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'My_Flow' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'Config__mdt' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'AppConfig__c' })).toBeVisible();
});

// =====================================================
// TEST 2: Composite key correctness (layoutAssignments)
// Same layout but different recordType = SEPARATE elements
// =====================================================
test('Composite key: layoutAssignments with same layout but different recordType are separate', async ({ page }) => {
  // Before: layout X with no recordType, and layout X with recordType A
  const before = profileXml(`
    <layoutAssignments>
        <layout>Account-Account Layout</layout>
    </layoutAssignments>
    <layoutAssignments>
        <layout>Account-Account Layout</layout>
        <recordType>Account.PersonAccount</recordType>
    </layoutAssignments>`);

  // After: no-recordType one is unchanged, but the PersonAccount one changes its layout value
  const after = profileXml(`
    <layoutAssignments>
        <layout>Account-Account Layout</layout>
    </layoutAssignments>
    <layoutAssignments>
        <layout>Account-Person Account Layout</layout>
        <recordType>Account.PersonAccount</recordType>
    </layoutAssignments>`);

  await setEditors(page, before, after);

  // Composite keys:
  // Before: "Account-Account Layout::" (no recordType) and "Account-Account Layout::Account.PersonAccount"
  // After:  "Account-Account Layout::" (no recordType) and "Account-Person Account Layout::Account.PersonAccount"
  //
  // "Account-Account Layout::" matches between before and after. The layout child value
  // is the same ("Account-Account Layout"). So it's UNCHANGED.
  //
  // "Account-Account Layout::Account.PersonAccount" in before has no match in after
  //   because after has "Account-Person Account Layout::Account.PersonAccount" (different key).
  // So: 1 removed, 1 added.
  //
  // Total: 1 unchanged, 0 modified, 1 removed, 1 added
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('1');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('1');
  await expect(page.getByTestId('xml-stat-added')).toContainText('1');

  // Verify the removed element is the old composite key
  await page.getByTestId('xml-tab-removed').click();
  const results = page.locator('[style*="border-top"]');
  // Display key strips trailing ::, and replaces :: with " / "
  // The removed key is "Account-Account Layout::Account.PersonAccount"
  // displayKey = "Account-Account Layout / Account.PersonAccount"
  await expect(results.locator('.font-medium', { hasText: 'Account.PersonAccount' })).toBeVisible();

  // Verify the added element is the new composite key
  await page.getByTestId('xml-tab-added').click();
  await expect(results.locator('.font-medium', { hasText: 'Account.PersonAccount' })).toBeVisible();
});

// =====================================================
// TEST 3: Modified field change accuracy
// Only actually changed fields appear in changes list
// =====================================================
test('Modified element shows exactly the changed fields, not all fields', async ({ page }) => {
  // objectPermissions has 7 child fields. Change only 2 of them.
  const before = profileXml(`
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>`);

  // Changed: allowCreate true->false, viewAllRecords false->true
  // Unchanged: allowDelete, allowEdit, allowRead, modifyAllRecords, object (5 fields)
  const after = profileXml(`
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>`);

  await setEditors(page, before, after);

  // 1 element, matched by key "Account", has changes -> modified
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('0');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('1');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');

  // Go to modified tab - element should be auto-expanded since there is only 1
  await page.getByTestId('xml-tab-modified').click();

  // The changes div shows field changes. There should be exactly 2 change rows.
  // Each change row has the pattern: "fieldname: oldVal -> newVal"
  // Look for the change indicators (the arrow character)
  const changeRows = page.locator('.mt-2 .flex.items-center.gap-2.text-xs');
  await expect(changeRows).toHaveCount(2);

  // Verify the exact fields that changed
  await expect(page.getByText('allowCreate:')).toBeVisible();
  await expect(page.getByText('viewAllRecords:')).toBeVisible();

  // Verify the unchanged fields do NOT appear as changes
  // These field names should NOT appear in the changes section
  // (They exist in the XML view above, but not in the changes list below it)
  const changesContainer = page.locator('.mt-2');
  await expect(changesContainer.locator('text=allowDelete:')).toHaveCount(0);
  await expect(changesContainer.locator('text=allowEdit:')).toHaveCount(0);
  await expect(changesContainer.locator('text=allowRead:')).toHaveCount(0);
  await expect(changesContainer.locator('text=modifyAllRecords:')).toHaveCount(0);
});

// =====================================================
// TEST 4: Bidirectional correctness (swap button)
// If before->after shows R removed, A added, then
// after->before should show A removed, R added.
// =====================================================
test('Bidirectional correctness: swap reverses removed and added counts', async ({ page }) => {
  // Before has 5 elements, After has 4 elements.
  // 2 elements in common (unchanged), 1 modified
  // before-only: 2 (removed), after-only: 1 (added)
  const before = profileXml(`
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Phone</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Industry</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.OldField__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.LegacyField__c</field>
        <readable>true</readable>
    </fieldPermissions>`);

  const after = profileXml(`
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Phone</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>false</editable>
        <field>Account.Industry</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.NewField__c</field>
        <readable>true</readable>
    </fieldPermissions>`);

  await setEditors(page, before, after);

  // Before->After:
  // Account.Name: unchanged
  // Account.Phone: unchanged
  // Account.Industry: modified (editable true->false)
  // Account.OldField__c: removed
  // Account.LegacyField__c: removed
  // Account.NewField__c: added
  // Totals: unchanged=2, modified=1, removed=2, added=1
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('2');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('1');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('2');
  await expect(page.getByTestId('xml-stat-added')).toContainText('1');

  // Now swap
  await page.getByTestId('swap-btn').click();
  await page.waitForTimeout(DEBOUNCE_WAIT);

  // After->Before (swapped):
  // Account.Name: unchanged
  // Account.Phone: unchanged
  // Account.Industry: modified (editable false->true, reversed direction)
  // Account.NewField__c: removed (was "added" before, now it's in "before" position... wait)
  // Actually: After swap, the original "after" is now "before", and original "before" is now "after".
  // So "before" = original after (4 elements), "after" = original before (5 elements).
  // Account.Name: unchanged
  // Account.Phone: unchanged
  // Account.Industry: modified (editable false->true)
  // Account.NewField__c: in new-before but not in new-after -> removed
  // Account.OldField__c: in new-after but not in new-before -> added
  // Account.LegacyField__c: in new-after but not in new-before -> added
  // Totals: unchanged=2, modified=1, removed=1, added=2
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('2');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('1');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('1');
  await expect(page.getByTestId('xml-stat-added')).toContainText('2');
});

// =====================================================
// TEST 5: Count arithmetic
// unchanged + modified + removed = totalBefore
// unchanged + modified + added = totalAfter
// =====================================================
test('Count arithmetic: unchanged + modified + removed = totalBefore, unchanged + modified + added = totalAfter', async ({ page }) => {
  // Scenario with mixed changes across multiple types
  // Before: 8 elements, After: 7 elements
  const before = profileXml(`
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Phone</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Old__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Contact</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
    <userPermissions>
        <enabled>false</enabled>
        <name>ModifyAllData</name>
    </userPermissions>
    <tabVisibilities>
        <tab>standard-Account</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>`);

  const after = profileXml(`
    <fieldPermissions>
        <editable>false</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Phone</field>
        <readable>true</readable>
    </fieldPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Contact</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
    <tabVisibilities>
        <tab>standard-Account</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <customPermissions>
        <enabled>true</enabled>
        <name>NewPerm</name>
    </customPermissions>`);

  await setEditors(page, before, after);

  // Element-by-element analysis:
  // fieldPermissions:
  //   Account.Name: modified (editable true->false) [1 modified]
  //   Account.Phone: unchanged [1 unchanged]
  //   Account.Old__c: removed [1 removed]
  // objectPermissions:
  //   Account: unchanged [1 unchanged]
  //   Contact: modified (3 fields changed: allowCreate, allowEdit, allowRead... wait)
  //     Before: allowCreate=false, allowEdit=false, allowRead=true
  //     After: allowCreate=true, allowEdit=true, allowRead=true
  //     Changes: allowCreate false->true, allowEdit false->true = 2 changes -> modified
  // userPermissions:
  //   ApiEnabled: unchanged [1 unchanged]
  //   ModifyAllData: removed [1 removed]
  // tabVisibilities:
  //   standard-Account: unchanged [1 unchanged]
  // customPermissions:
  //   NewPerm: added [1 added]
  //
  // Totals: unchanged=4, modified=2, removed=2, added=1
  // totalBefore = 8, totalAfter = 7
  // Check: 4 + 2 + 2 = 8 (totalBefore) YES
  // Check: 4 + 2 + 1 = 7 (totalAfter) YES
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('4');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('2');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('2');
  await expect(page.getByTestId('xml-stat-added')).toContainText('1');

  // The summary shows Before and After counts. Verify them.
  // The stat cards show: Before = totalBefore, After = totalAfter
  const statCards = page.locator('.stat-card');
  // First stat card is "Before", second is "After"
  await expect(statCards.nth(0).locator('.stat-number')).toContainText('8');
  await expect(statCards.nth(1).locator('.stat-number')).toContainText('7');

  // Arithmetic verification:
  // unchanged(4) + modified(2) + removed(2) = 8 = totalBefore
  // unchanged(4) + modified(2) + added(1) = 7 = totalAfter
});

// =====================================================
// TEST 5b: Count arithmetic with a second scenario
// =====================================================
test('Count arithmetic: second scenario with more types', async ({ page }) => {
  // Before: 6 elements, After: 8 elements
  const before = permSetXml(`
    <classAccesses>
        <apexClass>ClassA</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>ClassB</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>ClassC</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <flowAccesses>
        <enabled>true</enabled>
        <flow>FlowA</flow>
    </flowAccesses>
    <flowAccesses>
        <enabled>true</enabled>
        <flow>FlowB</flow>
    </flowAccesses>
    <flowAccesses>
        <enabled>true</enabled>
        <flow>FlowC</flow>
    </flowAccesses>`);

  const after = permSetXml(`
    <classAccesses>
        <apexClass>ClassA</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>ClassB</apexClass>
        <enabled>false</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>ClassD</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>ClassE</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <flowAccesses>
        <enabled>true</enabled>
        <flow>FlowA</flow>
    </flowAccesses>
    <flowAccesses>
        <enabled>false</enabled>
        <flow>FlowB</flow>
    </flowAccesses>
    <flowAccesses>
        <enabled>true</enabled>
        <flow>FlowD</flow>
    </flowAccesses>
    <flowAccesses>
        <enabled>true</enabled>
        <flow>FlowE</flow>
    </flowAccesses>`);

  await setEditors(page, before, after);

  // classAccesses:
  //   ClassA: unchanged
  //   ClassB: modified (enabled true->false)
  //   ClassC: removed
  //   ClassD: added
  //   ClassE: added
  // flowAccesses:
  //   FlowA: unchanged
  //   FlowB: modified (enabled true->false)
  //   FlowC: removed
  //   FlowD: added
  //   FlowE: added
  //
  // Totals: unchanged=2, modified=2, removed=2, added=4
  // totalBefore=6, totalAfter=8
  // Check: 2 + 2 + 2 = 6 (totalBefore) YES
  // Check: 2 + 2 + 4 = 8 (totalAfter) YES
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('2');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('2');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('2');
  await expect(page.getByTestId('xml-stat-added')).toContainText('4');

  const statCards = page.locator('.stat-card');
  await expect(statCards.nth(0).locator('.stat-number')).toContainText('6');
  await expect(statCards.nth(1).locator('.stat-number')).toContainText('8');
});

// =====================================================
// TEST 6: Type breakdown accuracy
// Per-type counts must add up to the total counts.
// =====================================================
test('Type breakdown: per-type stats sum to totals', async ({ page }) => {
  // Create a profile with 3 types, each having different change patterns
  const before = profileXml(`
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Phone</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Old__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Contact</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
    <userPermissions>
        <enabled>false</enabled>
        <name>ModifyAllData</name>
    </userPermissions>`);

  const after = profileXml(`
    <fieldPermissions>
        <editable>false</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Phone</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.New__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Contact</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ModifyAllData</name>
    </userPermissions>`);

  await setEditors(page, before, after);

  // fieldPermissions:
  //   Account.Name: modified (editable true->false)
  //   Account.Phone: unchanged
  //   Account.Old__c: removed
  //   Account.New__c: added
  //   -> 1 unchanged, 1 modified, 1 removed, 1 added
  //
  // objectPermissions:
  //   Account: unchanged
  //   Contact: modified (allowCreate false->true, allowEdit false->true)
  //   -> 1 unchanged, 1 modified, 0 removed, 0 added
  //
  // userPermissions:
  //   ApiEnabled: unchanged
  //   ModifyAllData: modified (enabled false->true)
  //   -> 1 unchanged, 1 modified, 0 removed, 0 added
  //
  // TOTALS: unchanged=3, modified=3, removed=1, added=1

  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('3');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('3');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('1');
  await expect(page.getByTestId('xml-stat-added')).toContainText('1');

  // Verify per-type breakdown is visible in summary
  // The TypeStatsRow renders per-type stats
  // Field Permissions: 1 unchanged, 1 modified, 1 removed, 1 added
  const fieldRow = page.locator('.flex.items-center.justify-between', { hasText: 'Field Permissions' });
  await expect(fieldRow.getByText('1 unchanged')).toBeVisible();
  await expect(fieldRow.getByText('1 modified')).toBeVisible();
  await expect(fieldRow.getByText('1 removed')).toBeVisible();
  await expect(fieldRow.getByText('1 added')).toBeVisible();

  // Object Permissions: 1 unchanged, 1 modified
  const objRow = page.locator('.flex.items-center.justify-between', { hasText: 'Object Permissions' });
  await expect(objRow.getByText('1 unchanged')).toBeVisible();
  await expect(objRow.getByText('1 modified')).toBeVisible();

  // User Permissions: 1 unchanged, 1 modified
  const userRow = page.locator('.flex.items-center.justify-between', { hasText: 'User Permissions' });
  await expect(userRow.getByText('1 unchanged')).toBeVisible();
  await expect(userRow.getByText('1 modified')).toBeVisible();
});

// =====================================================
// TEST 7: Identical files = all unchanged
// Both sides identical, everything is unchanged.
// =====================================================
test('Identical files: all elements unchanged, zero in every other category', async ({ page }) => {
  const xml = profileXml(`
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Phone</field>
        <readable>true</readable>
    </fieldPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
    <tabVisibilities>
        <tab>standard-Account</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <recordTypeVisibilities>
        <default>true</default>
        <recordType>Account.Business</recordType>
        <visible>true</visible>
    </recordTypeVisibilities>`);

  await setEditors(page, xml, xml);

  // 6 elements, all unchanged
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('6');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');

  // Should show the green "nothing lost" status
  await expect(page.getByTestId('xml-status-ok')).toBeVisible();

  // Before and After counts should both be 6
  const statCards = page.locator('.stat-card');
  await expect(statCards.nth(0).locator('.stat-number')).toContainText('6');
  await expect(statCards.nth(1).locator('.stat-number')).toContainText('6');
});

// =====================================================
// TEST 8: Completely different files
// No overlapping keys. All before elements removed,
// all after elements added.
// =====================================================
test('Completely different files: all removed, all added, zero unchanged and modified', async ({ page }) => {
  const before = profileXml(`
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Alpha</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Beta</field>
        <readable>true</readable>
    </fieldPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>`);

  const after = profileXml(`
    <fieldPermissions>
        <editable>true</editable>
        <field>Contact.Gamma</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Contact.Delta</field>
        <readable>true</readable>
    </fieldPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Lead</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ViewAllData</name>
    </userPermissions>`);

  await setEditors(page, before, after);

  // No keys overlap at all.
  // Before: Account.Alpha, Account.Beta, Account(obj) = 3 elements
  // After: Contact.Gamma, Contact.Delta, Lead(obj), ViewAllData = 4 elements
  // All 3 before elements removed, all 4 after elements added.
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('0');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('3');
  await expect(page.getByTestId('xml-stat-added')).toContainText('4');

  // Verify the status shows the red X icon
  await expect(page.getByTestId('xml-status-changed')).toBeVisible();

  // Before=3, After=4
  const statCards = page.locator('.stat-card');
  await expect(statCards.nth(0).locator('.stat-number')).toContainText('3');
  await expect(statCards.nth(1).locator('.stat-number')).toContainText('4');

  // Verify removed elements
  await page.getByTestId('xml-tab-removed').click();
  const results = page.locator('[style*="border-top"]');
  await expect(results.locator('.font-medium', { hasText: 'Account.Alpha' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'Account.Beta' })).toBeVisible();
  // "Account" as object key - use exact text match to avoid matching Account.Alpha/Account.Beta
  await expect(results.locator('.font-medium', { hasText: /^Account$/ })).toBeVisible();

  // Verify added elements
  await page.getByTestId('xml-tab-added').click();
  await expect(results.locator('.font-medium', { hasText: 'Contact.Gamma' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'Contact.Delta' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'Lead' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'ViewAllData' })).toBeVisible();
});

// =====================================================
// TEST 9: Field value with "(not set)"
// When a child element exists in before but not in after
// (or vice versa), the change shows "(not set)".
// =====================================================
test('Changes show "(not set)" when a child element is missing on one side', async ({ page }) => {
  // Before: objectPermissions for Account with 7 fields
  // After: same key (Account) but one field removed (modifyAllRecords missing),
  //        and one new field added (description)
  const before = profileXml(`
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>`);

  const after = profileXml(`
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
        <description>Primary account object</description>
    </objectPermissions>`);

  await setEditors(page, before, after);

  // Key is "Account" (same key), so it matches.
  // Changed fields:
  //   modifyAllRecords: "false" -> "(not set)" (removed from after)
  //   description: "(not set)" -> "Primary account object" (added in after)
  // Unchanged: allowCreate, allowDelete, allowEdit, allowRead, object, viewAllRecords
  // Total: 0 unchanged elements, 1 modified element, 0 removed, 0 added
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('0');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('1');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');

  // Go to modified tab and verify the change details
  await page.getByTestId('xml-tab-modified').click();

  // Should show exactly 2 field changes
  const changeRows = page.locator('.mt-2 .flex.items-center.gap-2.text-xs');
  await expect(changeRows).toHaveCount(2);

  // Verify "(not set)" appears for the missing sides
  // modifyAllRecords: "false" -> "(not set)"
  await expect(page.getByText('modifyAllRecords:')).toBeVisible();

  // description: "(not set)" -> "Primary account object"
  await expect(page.getByText('description:')).toBeVisible();

  // Check that "(not set)" text appears (at least 2 instances: one for each missing side)
  const notSetTexts = page.locator('text=(not set)');
  await expect(notSetTexts).toHaveCount(2);
});

// =====================================================
// TEST 10: Composite key with same layout but empty vs
// present recordType are distinct elements
// =====================================================
test('Composite key: layout with empty recordType vs layout with recordType are different keys', async ({ page }) => {
  // Before: 3 layout assignments
  //   1. layout=X, no recordType  -> key = "X::"
  //   2. layout=X, recordType=A   -> key = "X::A"
  //   3. layout=X, recordType=B   -> key = "X::B"
  const before = profileXml(`
    <layoutAssignments>
        <layout>Account-Main Layout</layout>
    </layoutAssignments>
    <layoutAssignments>
        <layout>Account-Main Layout</layout>
        <recordType>Account.TypeA</recordType>
    </layoutAssignments>
    <layoutAssignments>
        <layout>Account-Main Layout</layout>
        <recordType>Account.TypeB</recordType>
    </layoutAssignments>`);

  // After: Only the TypeA one changes its layout. The others are unchanged.
  const after = profileXml(`
    <layoutAssignments>
        <layout>Account-Main Layout</layout>
    </layoutAssignments>
    <layoutAssignments>
        <layout>Account-New Layout</layout>
        <recordType>Account.TypeA</recordType>
    </layoutAssignments>
    <layoutAssignments>
        <layout>Account-Main Layout</layout>
        <recordType>Account.TypeB</recordType>
    </layoutAssignments>`);

  await setEditors(page, before, after);

  // Keys:
  // Before: "Account-Main Layout::", "Account-Main Layout::Account.TypeA", "Account-Main Layout::Account.TypeB"
  // After:  "Account-Main Layout::", "Account-New Layout::Account.TypeA", "Account-Main Layout::Account.TypeB"
  //
  // "Account-Main Layout::": matches -> check children. layout="Account-Main Layout" same. unchanged.
  // "Account-Main Layout::Account.TypeA": no match in after (after has "Account-New Layout::Account.TypeA")
  //   -> removed
  // "Account-Main Layout::Account.TypeB": matches -> layout="Account-Main Layout" same. unchanged.
  // "Account-New Layout::Account.TypeA": no match in before -> added
  //
  // Total: 2 unchanged, 0 modified, 1 removed, 1 added
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('2');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('1');
  await expect(page.getByTestId('xml-stat-added')).toContainText('1');
});

// =====================================================
// TEST 11: Multiple modification changes across types
// to verify type breakdown row correctness
// =====================================================
test('Type breakdown rows show correct per-type counts for complex scenario', async ({ page }) => {
  const before = profileXml(`
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Phone</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Fax</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Website</field>
        <readable>true</readable>
    </fieldPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>BulkApiHardDelete</name>
    </userPermissions>
    <tabVisibilities>
        <tab>standard-Account</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <tabVisibilities>
        <tab>standard-Contact</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <tabVisibilities>
        <tab>standard-Lead</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>`);

  const after = profileXml(`
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>false</editable>
        <field>Account.Phone</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Email</field>
        <readable>true</readable>
    </fieldPermissions>
    <userPermissions>
        <enabled>false</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>BulkApiHardDelete</name>
    </userPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ViewSetup</name>
    </userPermissions>
    <tabVisibilities>
        <tab>standard-Account</tab>
        <visibility>DefaultOff</visibility>
    </tabVisibilities>
    <tabVisibilities>
        <tab>standard-Contact</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>`);

  await setEditors(page, before, after);

  // fieldPermissions:
  //   Account.Name: unchanged
  //   Account.Phone: modified (editable true->false)
  //   Account.Fax: removed
  //   Account.Website: removed
  //   Account.Email: added
  //   -> 1 unchanged, 1 modified, 2 removed, 1 added
  //
  // userPermissions:
  //   ApiEnabled: modified (enabled true->false)
  //   BulkApiHardDelete: unchanged
  //   ViewSetup: added
  //   -> 1 unchanged, 1 modified, 0 removed, 1 added
  //
  // tabVisibilities:
  //   standard-Account: modified (visibility DefaultOn->DefaultOff)
  //   standard-Contact: unchanged
  //   standard-Lead: removed
  //   -> 1 unchanged, 1 modified, 1 removed, 0 added
  //
  // TOTALS: unchanged=3, modified=3, removed=3, added=2
  // totalBefore=9, totalAfter=8
  // Check: 3+3+3=9=totalBefore, 3+3+2=8=totalAfter

  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('3');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('3');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('3');
  await expect(page.getByTestId('xml-stat-added')).toContainText('2');

  // Verify per-type breakdown
  const fieldRow = page.locator('.flex.items-center.justify-between', { hasText: 'Field Permissions' });
  await expect(fieldRow.getByText('1 unchanged')).toBeVisible();
  await expect(fieldRow.getByText('1 modified')).toBeVisible();
  await expect(fieldRow.getByText('2 removed')).toBeVisible();
  await expect(fieldRow.getByText('1 added')).toBeVisible();

  const userRow = page.locator('.flex.items-center.justify-between', { hasText: 'User Permissions' });
  await expect(userRow.getByText('1 unchanged')).toBeVisible();
  await expect(userRow.getByText('1 modified')).toBeVisible();
  await expect(userRow.getByText('1 added')).toBeVisible();

  const tabRow = page.locator('.flex.items-center.justify-between', { hasText: 'Tab Visibilities' });
  await expect(tabRow.getByText('1 unchanged')).toBeVisible();
  await expect(tabRow.getByText('1 modified')).toBeVisible();
  await expect(tabRow.getByText('1 removed')).toBeVisible();
});

// =====================================================
// TEST 12: Bidirectional with swap also verifies
// modified count stays the same (symmetric)
// =====================================================
test('Bidirectional: modified count stays the same after swap', async ({ page }) => {
  const before = profileXml(`
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Contact</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>`);

  const after = profileXml(`
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>true</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Contact</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>`);

  await setEditors(page, before, after);

  // Account: modified (allowCreate true->false, allowEdit true->false = 2 changes)
  // Contact: modified (allowCreate false->true, allowDelete false->true, allowEdit false->true = 3 changes)
  // ApiEnabled: unchanged
  // Total: 1 unchanged, 2 modified, 0 removed, 0 added
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('1');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('2');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');

  // Swap
  await page.getByTestId('swap-btn').click();
  await page.waitForTimeout(DEBOUNCE_WAIT);

  // After swap: same elements, same keys. Modified count should still be 2.
  // The direction of changes reverses (e.g., allowCreate false->true instead of true->false)
  // but the NUMBER of modified elements stays the same.
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('1');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('2');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');
});

// =====================================================
// TEST 13: Verify exact change count per modified element
// with multiple modified elements having different numbers
// of changed fields
// =====================================================
test('Multiple modified elements each show correct number of field changes', async ({ page }) => {
  const before = permSetXml(`
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Contact</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>true</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>true</modifyAllRecords>
        <object>Opportunity</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>`);

  // Account: change 1 field (allowCreate true->false)
  // Contact: change 3 fields (allowCreate, allowEdit, allowDelete)
  // Opportunity: change 5 fields (allowCreate, allowDelete, allowEdit, modifyAllRecords, viewAllRecords)
  const after = permSetXml(`
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>true</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Contact</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Opportunity</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>`);

  await setEditors(page, before, after);

  // All 3 elements modified, 0 unchanged, 0 removed, 0 added
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('0');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('3');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');

  // Go to modified tab - all 3 elements should be auto-expanded (<=5 items)
  await page.getByTestId('xml-tab-modified').click();

  // Count total change rows across all 3 elements: 1 + 3 + 5 = 9
  const allChangeRows = page.locator('.mt-2 .flex.items-center.gap-2.text-xs');
  await expect(allChangeRows).toHaveCount(9);
});
