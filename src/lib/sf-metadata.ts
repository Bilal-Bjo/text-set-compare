/**
 * Salesforce metadata element type → key field mappings.
 * The key field uniquely identifies an element within its type.
 * Arrays indicate composite keys (all fields concatenated).
 */
const SF_KEY_FIELDS: Record<string, string | string[]> = {
  // ── Profile & PermissionSet child elements ──
  fieldPermissions: 'field',
  objectPermissions: 'object',
  userPermissions: 'name',
  tabVisibilities: 'tab',
  recordTypeVisibilities: 'recordType',
  applicationVisibilities: 'application',
  classAccesses: 'apexClass',
  pageAccesses: 'apexPage',
  layoutAssignments: ['layout', 'recordType'],
  customPermissions: 'name',
  flowAccesses: 'flow',
  customMetadataTypeAccesses: 'name',
  customSettingAccesses: 'name',
  externalDataSourceAccesses: 'externalDataSource',
  loginFlows: 'flow',
  profileActionOverrides: ['actionName', 'pageOrSobjectType', 'recordType'],
  categoryGroupVisibilities: 'dataCategoryGroup',
  loginHours: '_self',
  loginIpRanges: '_self',

  // ── CustomObject child elements ──
  fields: 'fullName',
  listViews: 'fullName',
  validationRules: 'fullName',
  recordTypes: 'fullName',
  webLinks: 'fullName',
  compactLayouts: 'fullName',
  fieldSets: 'fullName',
  businessProcesses: 'fullName',
  sharingReasons: 'fullName',
  indexes: 'fullName',

  // ── CustomLabels child elements ──
  labels: 'fullName',

  // ── Flow child elements ──
  actionCalls: 'name',
  assignments: 'name',
  decisions: 'name',
  screens: 'name',
  recordLookups: 'name',
  recordCreates: 'name',
  recordUpdates: 'name',
  recordDeletes: 'name',
  loops: 'name',
  subflows: 'name',
  variables: 'name',
  constants: 'name',
  formulas: 'name',
  textTemplates: 'name',
  choices: 'name',
  dynamicChoiceSets: 'name',
  waits: 'name',
  collectionProcessors: 'name',
  stages: 'name',
  steps: 'name',

  // ── Layout child elements ──
  layoutSections: 'label',
  relatedLists: 'relatedList',
  platformActionList: '_self',
  quickActionList: '_self',

  // ── CustomApplication child elements ──
  actionOverrides: 'actionName',
  tabs: '_self',
};

const SF_HUMAN_LABELS: Record<string, string> = {
  // Profile & PermissionSet
  fieldPermissions: 'Field Permissions',
  objectPermissions: 'Object Permissions',
  userPermissions: 'User Permissions',
  tabVisibilities: 'Tab Visibilities',
  recordTypeVisibilities: 'Record Type Visibilities',
  applicationVisibilities: 'App Visibilities',
  classAccesses: 'Apex Class Access',
  pageAccesses: 'Apex Page Access',
  layoutAssignments: 'Layout Assignments',
  customPermissions: 'Custom Permissions',
  flowAccesses: 'Flow Access',
  customMetadataTypeAccesses: 'Custom Metadata Access',
  customSettingAccesses: 'Custom Setting Access',
  externalDataSourceAccesses: 'External Data Source Access',
  loginFlows: 'Login Flows',
  profileActionOverrides: 'Action Overrides',
  categoryGroupVisibilities: 'Category Group Visibilities',
  loginHours: 'Login Hours',
  loginIpRanges: 'Login IP Ranges',
  // CustomObject
  fields: 'Fields',
  listViews: 'List Views',
  validationRules: 'Validation Rules',
  recordTypes: 'Record Types',
  webLinks: 'Buttons & Links',
  compactLayouts: 'Compact Layouts',
  fieldSets: 'Field Sets',
  businessProcesses: 'Business Processes',
  sharingReasons: 'Sharing Reasons',
  indexes: 'Indexes',
  // CustomLabels
  labels: 'Labels',
  // Flow
  actionCalls: 'Action Calls',
  assignments: 'Assignments',
  decisions: 'Decisions',
  screens: 'Screens',
  recordLookups: 'Record Lookups',
  recordCreates: 'Record Creates',
  recordUpdates: 'Record Updates',
  recordDeletes: 'Record Deletes',
  loops: 'Loops',
  subflows: 'Subflows',
  variables: 'Variables',
  constants: 'Constants',
  formulas: 'Formulas',
  textTemplates: 'Text Templates',
  choices: 'Choices',
  dynamicChoiceSets: 'Dynamic Choice Sets',
  waits: 'Waits',
  collectionProcessors: 'Collection Processors',
  stages: 'Stages',
  steps: 'Steps',
  // Layout
  layoutSections: 'Layout Sections',
  relatedLists: 'Related Lists',
  platformActionList: 'Platform Actions',
  quickActionList: 'Quick Actions',
  // CustomApplication
  actionOverrides: 'Action Overrides',
};

/** Known SF metadata root element names */
const SF_ROOT_ELEMENTS = new Set([
  'Profile',
  'PermissionSet',
  'CustomObject',
  'CustomField',
  'Layout',
  'Flow',
  'CustomLabels',
  'CustomApplication',
  'CustomTab',
  'ApexClass',
  'ApexTrigger',
  'ApexPage',
  'AuraDefinitionBundle',
  'LightningComponentBundle',
  'MutingPermissionSet',
  'PermissionSetGroup',
]);

/**
 * Get the key value for a Salesforce metadata element.
 * Returns the text content of the key child element(s), or null if not a known type.
 * For composite keys (arrays), concatenates values with '::'.
 */
export function getElementKey(tagName: string, element: Element): string | null {
  const keyField = SF_KEY_FIELDS[tagName];
  if (!keyField) return null;

  if (keyField === '_self') {
    // For elements like loginHours that are singletons, use tagName as key
    return tagName;
  }

  if (Array.isArray(keyField)) {
    // Composite key — concatenate all field values
    const parts: string[] = [];
    for (const field of keyField) {
      const el = element.getElementsByTagName(field)[0];
      parts.push(el?.textContent?.trim() || '');
    }
    // Need at least the first field to have a value
    if (!parts[0]) return null;
    return parts.join('::');
  }

  const keyElement = element.getElementsByTagName(keyField)[0];
  if (!keyElement) return null;
  return keyElement.textContent?.trim() || null;
}

/**
 * Get a human-readable label for an SF metadata element type.
 */
export function getHumanLabel(tagName: string): string {
  return SF_HUMAN_LABELS[tagName] || tagName.replace(/([A-Z])/g, ' $1').trim();
}

/**
 * Check if a root element name is a known Salesforce metadata type.
 */
export function isSalesforceMetadata(rootTag: string): boolean {
  return SF_ROOT_ELEMENTS.has(rootTag);
}

/**
 * Check if a tag name has a known key field mapping.
 */
export function hasKeyMapping(tagName: string): boolean {
  return tagName in SF_KEY_FIELDS;
}
