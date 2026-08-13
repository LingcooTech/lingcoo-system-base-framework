import { readFileSync } from 'node:fs';

import { FRAME_VERSION } from '@lingcootech/frame-extension-sdk';
import {
  defineMigrationExtension,
  defineMigrationSource,
} from '@lingcootech/frame-extension-sdk/migrations';

export const notificationsMigrationSource = defineMigrationSource({
  id: 'frame-notifications',
  version: FRAME_VERSION,
  dependencies: [
    { id: 'frame-identity', version: `^${FRAME_VERSION}` },
    { id: 'frame-jobs', version: `^${FRAME_VERSION}` },
  ],
  migrations: [
    {
      id: '0001_notifications.sql',
      sql: readFileSync(new URL('../migrations/0001_notifications.sql', import.meta.url), 'utf8'),
    },
  ],
});

export const notificationsMigrationExtension = defineMigrationExtension(
  notificationsMigrationSource,
);
