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
// SCENARIO 1: Real DevOps diff — same profile retrieved
// from two sandboxes. Elements are in totally different
// order (SF doesn't guarantee element ordering).
// Only actual change: ManageUsers enabled false→true
// =====================================================
test('Realistic: shuffled element order with one real change', async ({ page }) => {
  const sandbox1 = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Industry</field>
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
    <userPermissions>
        <enabled>false</enabled>
        <name>ManageUsers</name>
    </userPermissions>
    <tabVisibilities>
        <tab>standard-Account</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <tabVisibilities>
        <tab>standard-Contact</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <recordTypeVisibilities>
        <default>true</default>
        <recordType>Account.Business</recordType>
        <visible>true</visible>
    </recordTypeVisibilities>
</Profile>`;

  // Same content but completely shuffled order + ManageUsers changed
  const sandbox2 = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <tabVisibilities>
        <tab>standard-Contact</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
    <userPermissions>
        <enabled>true</enabled>
        <name>ManageUsers</name>
    </userPermissions>
    <recordTypeVisibilities>
        <default>true</default>
        <recordType>Account.Business</recordType>
        <visible>true</visible>
    </recordTypeVisibilities>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Industry</field>
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
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <tabVisibilities>
        <tab>standard-Account</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>
</Profile>`;

  await setEditors(page, sandbox1, sandbox2);

  // Only ManageUsers should be modified, everything else unchanged
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('7');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('1');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');

  // Status should show changes (not green)
  await expect(page.getByTestId('xml-status-changed')).toBeVisible();

  await page.getByTestId('xml-tab-modified').click();
  const results = page.locator('[style*="border-top"]');
  await expect(results.locator('.font-medium', { hasText: 'ManageUsers' })).toBeVisible();
  await expect(results.getByText('enabled:')).toBeVisible();
});

// =====================================================
// SCENARIO 2: Profile deployment adds new FLS + removes
// old ones. Common when adding/removing custom fields.
// Also has whitespace differences (tabs vs spaces).
// =====================================================
test('Realistic: field additions/removals after custom field changes', async ({ page }) => {
  const beforeDeploy = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Custom_Legacy_Field__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Custom_Old_Field__c</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Account.Name</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>false</editable>
        <field>Account.OwnerId</field>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <editable>true</editable>
        <field>Contact.Email</field>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`;

  // After deploy: legacy fields removed, new fields added, some with different whitespace
  const afterDeploy = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
	<fieldPermissions>
		<editable>true</editable>
		<field>Account.Name</field>
		<readable>true</readable>
	</fieldPermissions>
	<fieldPermissions>
		<editable>false</editable>
		<field>Account.OwnerId</field>
		<readable>true</readable>
	</fieldPermissions>
	<fieldPermissions>
		<editable>true</editable>
		<field>Contact.Email</field>
		<readable>true</readable>
	</fieldPermissions>
	<fieldPermissions>
		<editable>true</editable>
		<field>Account.New_Feature_Field__c</field>
		<readable>true</readable>
	</fieldPermissions>
	<fieldPermissions>
		<editable>false</editable>
		<field>Account.New_Readonly_Field__c</field>
		<readable>true</readable>
	</fieldPermissions>
</Profile>`;

  await setEditors(page, beforeDeploy, afterDeploy);

  // Account.Name, Account.OwnerId, Contact.Email = 3 unchanged
  // Custom_Legacy_Field__c, Custom_Old_Field__c = 2 removed
  // New_Feature_Field__c, New_Readonly_Field__c = 2 added
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('3');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('2');
  await expect(page.getByTestId('xml-stat-added')).toContainText('2');

  // Verify removed fields
  await page.getByTestId('xml-tab-removed').click();
  const results = page.locator('[style*="border-top"]');
  await expect(results.locator('.font-medium', { hasText: 'Account.Custom_Legacy_Field__c' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'Account.Custom_Old_Field__c' })).toBeVisible();

  // Verify added fields
  await page.getByTestId('xml-tab-added').click();
  await expect(results.locator('.font-medium', { hasText: 'Account.New_Feature_Field__c' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'Account.New_Readonly_Field__c' })).toBeVisible();
});

// =====================================================
// SCENARIO 3: Permission set comparison — someone
// escalated permissions across multiple objects.
// Security review scenario: what changed?
// =====================================================
test('Realistic: permission escalation across objects', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Integration User</label>
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
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
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
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
    <userPermissions>
        <enabled>false</enabled>
        <name>ModifyAllData</name>
    </userPermissions>
    <userPermissions>
        <enabled>false</enabled>
        <name>ViewAllData</name>
    </userPermissions>
</PermissionSet>`;

  // Someone escalated: full CRUD on Account+Contact, ModifyAllData enabled
  const after = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Integration User</label>
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
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>false</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>Opportunity</object>
        <viewAllRecords>false</viewAllRecords>
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
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
    <userPermissions>
        <enabled>true</enabled>
        <name>ModifyAllData</name>
    </userPermissions>
    <userPermissions>
        <enabled>false</enabled>
        <name>ViewAllData</name>
    </userPermissions>
</PermissionSet>`;

  await setEditors(page, before, after);

  // label: unchanged (no key mapping, matched by content)
  // Account obj: MODIFIED (5 fields changed)
  // Contact obj: MODIFIED (4 fields changed)
  // Opportunity obj: unchanged
  // Case obj: unchanged
  // ApiEnabled: unchanged
  // ModifyAllData: MODIFIED (enabled false→true)
  // ViewAllData: unchanged
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('5');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('3');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');

  // Verify modified tab shows the right elements
  await page.getByTestId('xml-tab-modified').click();
  const results = page.locator('[style*="border-top"]');

  // Account should show many field changes
  await expect(results.locator('.font-medium', { hasText: 'Account' }).first()).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'Contact' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'ModifyAllData' })).toBeVisible();

  // Account should have 5 field changes (allowCreate, allowDelete, allowEdit, modifyAllRecords, viewAllRecords)
  // Both Account and Contact show allowDelete changes, so use .first()
  await expect(results.getByText('allowCreate:').first()).toBeVisible();
  await expect(results.getByText('allowDelete:').first()).toBeVisible();
  await expect(results.getByText('modifyAllRecords:')).toBeVisible();
  await expect(results.getByText('viewAllRecords:').first()).toBeVisible();
});

// =====================================================
// SCENARIO 4: layoutAssignments — common source of huge
// diffs in SF profiles. Each recordType gets a layout.
// =====================================================
test('Realistic: layout assignment changes with composite keys', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <layoutAssignments>
        <layout>Account-Account Layout</layout>
    </layoutAssignments>
    <layoutAssignments>
        <layout>Account-Account Layout</layout>
        <recordType>Account.Business</recordType>
    </layoutAssignments>
    <layoutAssignments>
        <layout>Contact-Contact Layout</layout>
    </layoutAssignments>
    <layoutAssignments>
        <layout>Opportunity-Opportunity Layout</layout>
    </layoutAssignments>
</Profile>`;

  // Changed Account Business layout, added new layout assignment
  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <layoutAssignments>
        <layout>Account-Account Layout</layout>
    </layoutAssignments>
    <layoutAssignments>
        <layout>Account-Account Lightning Layout</layout>
        <recordType>Account.Business</recordType>
    </layoutAssignments>
    <layoutAssignments>
        <layout>Contact-Contact Layout</layout>
    </layoutAssignments>
    <layoutAssignments>
        <layout>Opportunity-Opportunity Layout</layout>
    </layoutAssignments>
    <layoutAssignments>
        <layout>Case-Case Layout</layout>
    </layoutAssignments>
</Profile>`;

  await setEditors(page, before, after);

  // With composite keys (layout::recordType):
  // "Account-Account Layout::" (no recordType) → unchanged
  // "Account-Account Layout::Account.Business" → REMOVED (key doesn't match new one)
  // "Contact-Contact Layout::" → unchanged
  // "Opportunity-Opportunity Layout::" → unchanged
  // "Account-Account Lightning Layout::Account.Business" → ADDED (new composite key)
  // "Case-Case Layout::" → ADDED
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('3');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('1');
  await expect(page.getByTestId('xml-stat-added')).toContainText('2');

  // Verify the removed layout
  await page.getByTestId('xml-tab-removed').click();
  const results = page.locator('[style*="border-top"]');
  // The display key will be the composite key
  await expect(results.locator('.font-medium').first()).toBeVisible();

  // Verify added layouts
  await page.getByTestId('xml-tab-added').click();
  await expect(results.locator('.font-medium')).toHaveCount(2);
});

// =====================================================
// SCENARIO 5: classAccesses + flowAccesses in a
// PermissionSet — common for managed package updates.
// Classes renamed, flows added.
// =====================================================
test('Realistic: managed package class and flow changes', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <classAccesses>
        <apexClass>MyPackage__DataMigration</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>MyPackage__ReportBuilder</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>MyPackage__LegacySync</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>MyPackage__UserHelper</apexClass>
        <enabled>false</enabled>
    </classAccesses>
    <flowAccesses>
        <enabled>true</enabled>
        <flow>MyPackage__Account_Onboarding</flow>
    </flowAccesses>
    <flowAccesses>
        <enabled>true</enabled>
        <flow>MyPackage__Lead_Qualification</flow>
    </flowAccesses>
</PermissionSet>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <classAccesses>
        <apexClass>MyPackage__DataMigration</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>MyPackage__ReportBuilder_v2</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>MyPackage__UserHelper</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <classAccesses>
        <apexClass>MyPackage__BulkProcessor</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <flowAccesses>
        <enabled>true</enabled>
        <flow>MyPackage__Account_Onboarding</flow>
    </flowAccesses>
    <flowAccesses>
        <enabled>true</enabled>
        <flow>MyPackage__Lead_Qualification</flow>
    </flowAccesses>
    <flowAccesses>
        <enabled>true</enabled>
        <flow>MyPackage__Opportunity_Scoring</flow>
    </flowAccesses>
</PermissionSet>`;

  await setEditors(page, before, after);

  // classAccesses (keyed by apexClass):
  //   DataMigration: unchanged
  //   ReportBuilder: REMOVED (key doesn't match ReportBuilder_v2)
  //   LegacySync: REMOVED
  //   UserHelper: MODIFIED (enabled false→true)
  //   ReportBuilder_v2: ADDED
  //   BulkProcessor: ADDED
  //
  // flowAccesses (keyed by flow):
  //   Account_Onboarding: unchanged
  //   Lead_Qualification: unchanged
  //   Opportunity_Scoring: ADDED

  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('3');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('1');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('2');
  await expect(page.getByTestId('xml-stat-added')).toContainText('3');

  // Verify the modified element
  await page.getByTestId('xml-tab-modified').click();
  const results = page.locator('[style*="border-top"]');
  await expect(results.locator('.font-medium', { hasText: 'MyPackage__UserHelper' })).toBeVisible();
  await expect(results.getByText('enabled:')).toBeVisible();

  // Verify removed classes
  await page.getByTestId('xml-tab-removed').click();
  await expect(results.locator('.font-medium', { hasText: 'MyPackage__ReportBuilder' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'MyPackage__LegacySync' })).toBeVisible();

  // Verify added classes and flow
  await page.getByTestId('xml-tab-added').click();
  await expect(results.locator('.font-medium', { hasText: 'MyPackage__ReportBuilder_v2' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'MyPackage__BulkProcessor' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'MyPackage__Opportunity_Scoring' })).toBeVisible();
});

// =====================================================
// SCENARIO 6: Large profile with 50+ elements — the
// real reason this tool exists. Azure DevOps shows
// hundreds of line changes, but only 2 things actually
// changed. Does our tool cut through the noise?
// =====================================================
test('Realistic: large profile with minimal actual changes', async ({ page }) => {
  // Generate 30 fieldPermissions, 10 objectPermissions, 10 tabVisibilities
  const fields = [
    'Account.Name', 'Account.Phone', 'Account.Industry', 'Account.Website',
    'Account.AnnualRevenue', 'Account.NumberOfEmployees', 'Account.Rating',
    'Account.Type', 'Account.BillingCity', 'Account.BillingState',
    'Contact.FirstName', 'Contact.LastName', 'Contact.Email', 'Contact.Phone',
    'Contact.Title', 'Contact.Department', 'Contact.MailingCity',
    'Opportunity.Name', 'Opportunity.Amount', 'Opportunity.CloseDate',
    'Opportunity.StageName', 'Opportunity.Probability', 'Opportunity.Type',
    'Opportunity.LeadSource', 'Opportunity.NextStep',
    'Case.Subject', 'Case.Description', 'Case.Status', 'Case.Priority', 'Case.Origin',
  ];
  const objects = ['Account', 'Contact', 'Opportunity', 'Case', 'Lead',
    'Campaign', 'Task', 'Event', 'Solution', 'Product2'];
  const tabs = ['standard-Account', 'standard-Contact', 'standard-Opportunity',
    'standard-Case', 'standard-Lead', 'standard-Campaign',
    'standard-Task', 'standard-Report', 'standard-Dashboard', 'standard-home'];

  let beforeElements = '';
  let afterElements = '';

  for (const f of fields) {
    const fp = `    <fieldPermissions>
        <editable>true</editable>
        <field>${f}</field>
        <readable>true</readable>
    </fieldPermissions>\n`;
    beforeElements += fp;
    afterElements += fp;
  }

  for (const o of objects) {
    const op = `    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>${o}</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>\n`;
    beforeElements += op;
    afterElements += op;
  }

  for (const t of tabs) {
    const tv = `    <tabVisibilities>
        <tab>${t}</tab>
        <visibility>DefaultOn</visibility>
    </tabVisibilities>\n`;
    beforeElements += tv;
    afterElements += tv;
  }

  // Now make 2 actual changes in the "after":
  // 1. Account.AnnualRevenue: editable true → false
  afterElements = afterElements.replace(
    `<editable>true</editable>\n        <field>Account.AnnualRevenue</field>`,
    `<editable>false</editable>\n        <field>Account.AnnualRevenue</field>`
  );
  // 2. Lead object: allowDelete false → true
  afterElements = afterElements.replace(
    `<allowDelete>false</allowDelete>\n        <allowEdit>true</allowEdit>\n        <allowRead>true</allowRead>\n        <modifyAllRecords>false</modifyAllRecords>\n        <object>Lead</object>`,
    `<allowDelete>true</allowDelete>\n        <allowEdit>true</allowEdit>\n        <allowRead>true</allowRead>\n        <modifyAllRecords>false</modifyAllRecords>\n        <object>Lead</object>`
  );

  const before = `<?xml version="1.0" encoding="UTF-8"?>\n<Profile xmlns="http://soap.sforce.com/2006/04/metadata">\n${beforeElements}</Profile>`;
  const after = `<?xml version="1.0" encoding="UTF-8"?>\n<Profile xmlns="http://soap.sforce.com/2006/04/metadata">\n${afterElements}</Profile>`;

  await setEditors(page, before, after);

  // 50 elements total, only 2 modified
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('48');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('2');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');

  // Verify the 2 modified elements
  await page.getByTestId('xml-tab-modified').click();
  const results = page.locator('[style*="border-top"]');
  await expect(results.locator('.font-medium', { hasText: 'Account.AnnualRevenue' })).toBeVisible();
  await expect(results.locator('.font-medium', { hasText: 'Lead' })).toBeVisible();

  // The summary should show type breakdown
  await page.getByTestId('xml-tab-summary').click();
  await expect(page.getByText('Field Permissions')).toBeVisible();
  await expect(page.getByText('Object Permissions')).toBeVisible();
  await expect(page.getByText('Tab Visibilities')).toBeVisible();
});

// =====================================================
// SCENARIO 7: Child elements in different order within
// a single element. SF sometimes reorders children
// (e.g., <editable> before or after <field>).
// =====================================================
test('Realistic: child elements reordered within parent', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
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
</Profile>`;

  // Same data, but child elements within each parent are reordered
  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldPermissions>
        <field>Account.Name</field>
        <readable>true</readable>
        <editable>true</editable>
    </fieldPermissions>
    <objectPermissions>
        <object>Account</object>
        <allowRead>true</allowRead>
        <allowCreate>true</allowCreate>
        <allowEdit>true</allowEdit>
        <allowDelete>false</allowDelete>
        <viewAllRecords>false</viewAllRecords>
        <modifyAllRecords>false</modifyAllRecords>
    </objectPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // The key matches (Account.Name for field, Account for object)
  // The child text values are identical — only the XML child order changed
  // Our comparison uses child value maps (order-independent), so these
  // should correctly be classified as unchanged, not modified
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('2');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('0');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('0');
  await expect(page.getByTestId('xml-status-ok')).toBeVisible();
});

// =====================================================
// SCENARIO 8: customMetadataTypeAccesses and
// customSettingAccesses — less common but real
// =====================================================
test('Realistic: custom metadata and setting access changes', async ({ page }) => {
  const before = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <customMetadataTypeAccesses>
        <enabled>true</enabled>
        <name>Config_Setting__mdt</name>
    </customMetadataTypeAccesses>
    <customMetadataTypeAccesses>
        <enabled>true</enabled>
        <name>Feature_Flag__mdt</name>
    </customMetadataTypeAccesses>
    <customSettingAccesses>
        <enabled>true</enabled>
        <name>App_Config__c</name>
    </customSettingAccesses>
    <customPermissions>
        <enabled>true</enabled>
        <name>CanExportData</name>
    </customPermissions>
    <customPermissions>
        <enabled>false</enabled>
        <name>CanDeleteRecords</name>
    </customPermissions>
</Profile>`;

  const after = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <customMetadataTypeAccesses>
        <enabled>true</enabled>
        <name>Config_Setting__mdt</name>
    </customMetadataTypeAccesses>
    <customMetadataTypeAccesses>
        <enabled>false</enabled>
        <name>Feature_Flag__mdt</name>
    </customMetadataTypeAccesses>
    <customMetadataTypeAccesses>
        <enabled>true</enabled>
        <name>Routing_Rule__mdt</name>
    </customMetadataTypeAccesses>
    <customSettingAccesses>
        <enabled>true</enabled>
        <name>App_Config__c</name>
    </customSettingAccesses>
    <customPermissions>
        <enabled>true</enabled>
        <name>CanExportData</name>
    </customPermissions>
    <customPermissions>
        <enabled>true</enabled>
        <name>CanDeleteRecords</name>
    </customPermissions>
</Profile>`;

  await setEditors(page, before, after);

  // Config_Setting__mdt: unchanged
  // Feature_Flag__mdt: MODIFIED (enabled true→false)
  // Routing_Rule__mdt: ADDED
  // App_Config__c: unchanged
  // CanExportData: unchanged
  // CanDeleteRecords: MODIFIED (enabled false→true)
  await expect(page.getByTestId('xml-stat-unchanged')).toContainText('3');
  await expect(page.getByTestId('xml-stat-modified')).toContainText('2');
  await expect(page.getByTestId('xml-stat-removed')).toContainText('0');
  await expect(page.getByTestId('xml-stat-added')).toContainText('1');

  // Summary should show human-readable type names
  await expect(page.getByText('Custom Metadata Access')).toBeVisible();
  await expect(page.getByText('Custom Permissions')).toBeVisible();
});
