import { readFileSync } from 'node:fs';

import {
  defineMigrationExtension,
  defineMigrationSource,
} from '@lingcootech/frame-extension-sdk/migrations';

import { CMS_EXTENSION_ID, CMS_EXTENSION_VERSION } from './contracts.js';

export const cmsMigrationSource = defineMigrationSource({
  id: CMS_EXTENSION_ID,
  version: CMS_EXTENSION_VERSION,
  dependencies: [{ id: 'frame', version: `^${CMS_EXTENSION_VERSION}` }],
  migrations: [
    {
      id: '0009_cms_lite.sql',
      sql: readFileSync(new URL('../migrations/0009_cms_lite.sql', import.meta.url), 'utf8'),
      legacyAliases: ['0009_cms_lite.sql', 'frame/0009_cms_lite.sql'],
    },
    {
      id: '0011_cms_workflow.sql',
      sql: readFileSync(new URL('../migrations/0011_cms_workflow.sql', import.meta.url), 'utf8'),
      legacyAliases: ['0011_cms_workflow.sql', 'frame/0011_cms_workflow.sql'],
    },
  ],
});

export const cmsMigrationExtension = defineMigrationExtension(cmsMigrationSource);
