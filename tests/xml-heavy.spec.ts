import { test, expect } from '@playwright/test';

const DEBOUNCE_WAIT = 600;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

// ========== MODIFIED ELEMENTS ==========

test('Modified: single field change is detected', async ({ page }) => {
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
        <editable>false</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  await page.getByTestId('editor-before').fill(before);
  await page.getByTestId('editor-after').fill(after);
  await page.waitForTimeout(DEBOUNCE_WAIT);

  // Should detect XML
  await expect(page.getByTestId('xml-tab-summary')).toBeVisible();

  // Stats: 0 unchanged, 1 modified, 0 removed, 0 added
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('0');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('1');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');

  // Go to modified tab
  await page.getByTestId('xml-tab-modified').click();
  const results = page.locator('[style*="border-top"]');

  // Should show Account.Name as modified
  await expect(results.locator('.font-medium', { hasText: 'Account.Name' })).toBeVisible();

  // Should show the field-level change: editable: true → false
  await expect(results.getByText('editable:')).toBeVisible();
  // The before value (true) and after value (false) should both appear
  const changeRow = results.locator('div', { hasText: 'editable:' });
  await expect(changeRow.locator('span', { hasText: 'true' }).first()).toBeVisible();
  await expect(changeRow.locator('span', { hasText: 'false' }).first()).toBeVisible();
});

test('Modified: multiple field changes in one element', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>true</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>true</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
</Profile>`;

  await page.getByTestId('editor-before').fill(before);
  await page.getByTestId('editor-after').fill(after);
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await expect(page.getByTestId('xml-stat-modified')).toContainText('1');
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('0');

  await page.getByTestId('xml-tab-modified').click();
  const results = page.locator('[style*="border-top"]');

  // Should show Account as modified
  await expect(results.locator('.font-medium', { hasText: 'Account' })).toBeVisible();

  // Should show 3 field changes: allowDelete, modifyAllRecords, viewAllRecords
  await expect(results.getByText('allowDelete:')).toBeVisible();
  await expect(results.getByText('modifyAllRecords:')).toBeVisible();
  await expect(results.getByText('viewAllRecords:')).toBeVisible();

  // allowCreate and allowEdit and allowRead should NOT appear as changes
  const changeLabels = await results.locator('span', { hasText: /:$/ }).allTextContents();
  expect(changeLabels).not.toContain('allowCreate:');
  expect(changeLabels).not.toContain('allowEdit:');
  expect(changeLabels).not.toContain('allowRead:');
});

test('Modified: element reordering does not cause false positives', async ({ page }) => {
  // Same elements but in different order — should all be unchanged
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>false</editable>
        <field>Contact.Email</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Opportunity.Amount</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Opportunity.Amount</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>false</editable>
        <field>Contact.Email</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  await page.getByTestId('editor-before').fill(before);
  await page.getByTestId('editor-after').fill(after);
  await page.waitForTimeout(DEBOUNCE_WAIT);

  // All should be unchanged — reordering doesn't matter
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('3');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');
  await expect(page.getByTestId('xml-status-ok')).toBeVisible();
});

test('Modified: mix of unchanged, modified, removed, added', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
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
        <field>Contact.Email</field>
        <readable>true</readable>
    </fieldPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
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
        <field>Lead.Source</field>
        <readable>true</readable>
    </fieldPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
</Profile>`;

  await page.getByTestId('editor-before').fill(before);
  await page.getByTestId('editor-after').fill(after);
  await page.waitForTimeout(DEBOUNCE_WAIT);

  // Account.Phone: unchanged, ApiEnabled: unchanged = 2 unchanged
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('2');
  // Account.Name: modified (editable true→false) = 1 modified
  await expect(page.getByTestId('xml-stat-modified')).toContainText('1');
  // Contact.Email: removed = 1 removed
  await expect(page.getByTestId('xml-stat-removed')).toContainText('1');
  // Lead.Source: added = 1 added
  await expect(page.getByTestId('xml-stat-added')).toContainText('1');

  // Verify modified tab
  await page.getByTestId('xml-tab-modified').click();
  const results = page.locator('[style*="border-top"]');
  await expect(results.locator('.font-medium', { hasText: 'Account.Name' })).toBeVisible();

  // Verify removed tab
  await page.getByTestId('xml-tab-removed').click();
  await expect(results.locator('.font-medium', { hasText: 'Contact.Email' })).toBeVisible();

  // Verify added tab
  await page.getByTestId('xml-tab-added').click();
  await expect(results.locator('.font-medium', { hasText: 'Lead.Source' })).toBeVisible();

  // Verify unchanged tab
  await page.getByTestId('xml-tab-unchanged').click();
  await expect(results.locator('.font-medium', { hasText: 'Account.Phone' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'ApiEnabled' })).toBeVisible();
});

test('Modified: full profile test files produce correct counts', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <applicationVisibilities>
        <application>standard__Sales</application>
        <default>true</default>
        <visible>true</visible>
    </applicationVisibilities>
    <applicationVisibilities>
        <application>standard__Service</application>
        <default>false</default>
        <visible>true</visible>
    </applicationVisibilities>
    <applicationVisibilities>
        <application>standard__Marketing</application>
        <default>false</default>
        <visible>false</visible>
    </applicationVisibilities>
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
        <editable>false</editable>
        <field>Account.AnnualRevenue</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Contact.Email</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Contact.Phone</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>false</editable>
        <field>Contact.Birthdate</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Opportunity.Amount</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Opportunity.CloseDate</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Opportunity.StageName</field>
        <readable>true</readable>
    </fieldPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>true</allowDelete>
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
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>true</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Opportunity</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Case</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
    <tabVisibilities>
        <tab>standard-Account</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <tabVisibilities>
        <tab>standard-Contact</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <tabVisibilities>
        <tab>standard-Opportunity</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <tabVisibilities>
        <tab>standard-Case</tab>
        <visibility>DefaultOff</visibility>
    </tabVisibilities>
    <tabVisibilities>
        <tab>standard-Report</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>BulkApiHardDelete</name>
    </userPermissions>
    <userPermissions>
        <enabled>false</enabled>
        <name>ManageUsers</name>
    </userPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ViewSetup</name>
    </userPermissions>
    <recordTypeVisibilities>
        <default>true</default>
        <recordType>Account.Business</recordType>
        <visible>true</visible>
    </recordTypeVisibilities>
    <recordTypeVisibilities>
        <default>false</default>
        <recordType>Account.Person</recordType>
        <visible>true</visible>
    </recordTypeVisibilities>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <applicationVisibilities>
        <application>standard__Sales</application>
        <default>true</default>
        <visible>true</visible>
    </applicationVisibilities>
    <applicationVisibilities>
        <application>standard__Service</application>
        <default>true</default>
        <visible>true</visible>
    </applicationVisibilities>
    <applicationVisibilities>
        <application>standard__Marketing</application>
        <default>false</default>
        <visible>true</visible>
    </applicationVisibilities>
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
        <field>Account.Industry</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.AnnualRevenue</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Contact.Email</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Contact.MobilePhone</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Opportunity.Amount</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Opportunity.CloseDate</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Opportunity.StageName</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Opportunity.Probability</field>
        <readable>true</readable>
    </fieldPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>true</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>true</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>true</viewAllRecords>
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
        <allowCreate>true</allowCreate>
        <allowDelete>true</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Opportunity</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
    <tabVisibilities>
        <tab>standard-Account</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <tabVisibilities>
        <tab>standard-Contact</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <tabVisibilities>
        <tab>standard-Opportunity</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <tabVisibilities>
        <tab>standard-Case</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <tabVisibilities>
        <tab>standard-Report</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <tabVisibilities>
        <tab>standard-Dashboard</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ManageUsers</name>
    </userPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ViewSetup</name>
    </userPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ModifyAllData</name>
    </userPermissions>
    <recordTypeVisibilities>
        <default>true</default>
        <recordType>Account.Business</recordType>
        <visible>true</visible>
    </recordTypeVisibilities>
    <recordTypeVisibilities>
        <default>false</default>
        <recordType>Account.Person</recordType>
        <visible>false</visible>
    </recordTypeVisibilities>
</Profile>`;

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

  // Let me manually count what should happen:
  //
  // applicationVisibilities (keyed by "application"):
  //   standard__Sales: unchanged
  //   standard__Service: default false→true = MODIFIED
  //   standard__Marketing: visible false→true = MODIFIED
  //
  // fieldPermissions (keyed by "field"):
  //   Account.Name: editable true→false = MODIFIED
  //   Account.Phone: unchanged
  //   Account.Industry: unchanged
  //   Account.AnnualRevenue: editable false→true = MODIFIED
  //   Contact.Email: unchanged
  //   Contact.Phone: REMOVED
  //   Contact.Birthdate: REMOVED
  //   Opportunity.Amount: unchanged
  //   Opportunity.CloseDate: unchanged
  //   Opportunity.StageName: unchanged
  //   Contact.MobilePhone: ADDED
  //   Opportunity.Probability: ADDED
  //
  // objectPermissions (keyed by "object"):
  //   Account: modifyAllRecords false→true, viewAllRecords false→true = MODIFIED
  //   Contact: allowDelete false→true = MODIFIED
  //   Opportunity: unchanged
  //   Case: REMOVED
  //
  // tabVisibilities (keyed by "tab"):
  //   standard-Account: unchanged
  //   standard-Contact: unchanged
  //   standard-Opportunity: unchanged
  //   standard-Case: visibility DefaultOff→DefaultOn = MODIFIED
  //   standard-Report: unchanged
  //   standard-Dashboard: ADDED
  //
  // userPermissions (keyed by "name"):
  //   ApiEnabled: unchanged
  //   BulkApiHardDelete: REMOVED
  //   ManageUsers: enabled false→true = MODIFIED
  //   ViewSetup: unchanged
  //   ModifyAllData: ADDED
  //
  // recordTypeVisibilities (keyed by "recordType"):
  //   Account.Business: unchanged
  //   Account.Person: visible true→false = MODIFIED

  // Totals:
  // Unchanged: Sales + Phone + Industry + Email + Amount + CloseDate + StageName + Opportunity(obj) +
  //            Account(tab) + Contact(tab) + Opportunity(tab) + Report(tab) + ApiEnabled + ViewSetup + Business
  //          = 15 unchanged
  // Modified: Service + Marketing + Account.Name + AnnualRevenue + Account(obj) + Contact(obj) +
  //           Case(tab) + ManageUsers + Account.Person
  //         = 9 modified
  // Removed: Contact.Phone + Contact.Birthdate + Case(obj) + BulkApiHardDelete = 4 removed
  // Added: Contact.MobilePhone + Opportunity.Probability + Dashboard(tab) + ModifyAllData = 4 added

  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('15');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('9');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('4');
  await expect(page.getByTestId('xml-stat-added')).toContainText('4');

  // Verify modified tab has all 9 items
  await page.getByTestId('xml-tab-modified').click();
  const results = page.locator('[style*="border-top"]');
  const modifiedRows = results.locator('.font-medium');
  await expect(modifiedRows).toHaveCount(9);

  // Spot-check specific modified elements
  await expect(results.locator('.font-medium', { hasText: 'Account.Name' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'Account.AnnualRevenue' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'standard__Service' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'Account.Person' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'ManageUsers' })).toBeVisible();

  // Verify removed tab
  await page.getByTestId('xml-tab-removed').click();
  await expect(results.locator('.font-medium', { hasText: 'Contact.Phone' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'Contact.Birthdate' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'Case' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'BulkApiHardDelete' })).toBeVisible();

  // Verify added tab
  await page.getByTestId('xml-tab-added').click();
  await expect(results.locator('.font-medium', { hasText: 'Contact.MobilePhone' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'Opportunity.Probability' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'standard-Dashboard' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'ModifyAllData' })).toBeVisible();
});

test('Modified: expanding shows XML block + change details', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>true</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>true</modifyAllRecords>
        <object>Account</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
</Profile>`;

  await page.getByTestId('editor-before').fill(before);
  await page.getByTestId('editor-after').fill(after);
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await page.getByTestId('xml-tab-modified').click();

  // With only 1 element, it should auto-expand (defaultExpanded when <=5 items)
  // Check that the XML block (pre tag) is visible
  const results = page.locator('[style*="border-top"]');
  await expect(results.locator('pre').first()).toBeVisible();

  // Check all 3 field changes are shown
  await expect(results.getByText('allowDelete:')).toBeVisible();
  await expect(results.getByText('modifyAllRecords:')).toBeVisible();
  await expect(results.getByText('viewAllRecords:')).toBeVisible();
});

test('Modified: non-SF XML matches by content', async ({ page }) => {
  // Generic XML (not Salesforce) — should match by normalized content
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<config>
    <setting>
        <name>timeout</name>
        <value>30</value>
    </setting>
    <setting>
        <name>retries</name>
        <value>3</value>
    </setting>
</config>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<config>
    <setting>
        <name>retries</name>
        <value>3</value>
    </setting>
    <setting>
        <name>timeout</name>
        <value>30</value>
    </setting>
</config>`;

  await page.getByTestId('editor-before').fill(before);
  await page.getByTestId('editor-after').fill(after);
  await page.waitForTimeout(DEBOUNCE_WAIT);

  // Same content, just reordered — should be unchanged
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('2');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
});

test('Modified: copy keys button works on modified tab', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>false</editable>
        <field>Contact.Email</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>false</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Contact.Email</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  await page.getByTestId('editor-before').fill(before);
  await page.getByTestId('editor-after').fill(after);
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await page.getByTestId('xml-tab-modified').click();
  // Copy keys button should exist
  await expect(page.getByTestId('xml-copy-modified')).toBeVisible();
  await expect(page.getByTestId('xml-copy-modified')).toContainText('Copy keys');
});

test('Modified: search filters elements in modified tab', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>false</editable>
        <field>Contact.Email</field>
        <readable>true</readable>
    </fieldPermissions>
    <userPermissions>
        <enabled>false</enabled>
        <name>ManageUsers</name>
    </userPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>false</editable>
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
        <name>ManageUsers</name>
    </userPermissions>
</Profile>`;

  await page.getByTestId('editor-before').fill(before);
  await page.getByTestId('editor-after').fill(after);
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await page.getByTestId('xml-tab-modified').click();

  // All 3 should be visible
  const results = page.locator('[style*="border-top"]');
  await expect(results.locator('.font-medium')).toHaveCount(3);

  // Search for "Account" — should filter to 1
  const searchInput = page.getByTestId('search-input');
  await searchInput.fill('Account');

  // Only Account.Name should be visible
  await expect(results.locator('.font-medium', { hasText: 'Account.Name' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'Contact.Email' })).not.toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'ManageUsers' })).not.toBeVisible();

  // Search by type label "User Permissions"
  await searchInput.fill('User Permissions');
  await expect(results.locator('.font-medium', { hasText: 'ManageUsers' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'Account.Name' })).not.toBeVisible();
});

// ========== EDGE CASES ==========

test('Edge: empty XML root shows zero counts', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
</Profile>`;

  await page.getByTestId('editor-before').fill(before);
  await page.getByTestId('editor-after').fill(after);
  await page.waitForTimeout(DEBOUNCE_WAIT);

  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('0');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');
});

test('Edge: switching back to text mode after XML works', async ({ page }) => {
  // Start with XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
</Profile>`;

  await page.getByTestId('editor-before').fill(xml);
  await page.getByTestId('editor-after').fill(xml);
  await page.waitForTimeout(DEBOUNCE_WAIT);

  // Should be in XML mode
  await expect(page.getByTestId('xml-tab-summary')).toBeVisible();

  // Clear and put plain text
  await page.getByTestId('clear-all').click();
  await page.getByTestId('editor-before').fill('A\nB\nC');
  await page.getByTestId('editor-after').fill('A\nB');
  await page.waitForTimeout(DEBOUNCE_WAIT);

  // Should be back in text mode
  await expect(page.getByTestId('tab-summary')).toBeVisible();
  await expect(page.getByTestId('xml-tab-summary')).not.toBeVisible();
  await expect(page.getByTestId('status-missing')).toBeVisible();
});
