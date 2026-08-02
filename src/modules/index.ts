import { accessModule } from './access/index.js';
import { auditModule } from './audit/index.js';
import { dataExchangeModule } from './data-exchange/index.js';
import { assetsModule } from './assets/index.js';
import { authModule } from './auth/index.js';
import { integrationsModule } from './integrations/index.js';
import { jobsModule } from './jobs/index.js';
import { metadataModule } from './metadata/index.js';
import { notificationsModule } from './notifications/index.js';
import { searchModule } from './search/index.js';
import { settingsModule } from './settings/index.js';
import { systemModule } from './system/index.js';
import type { AppModule } from './types.js';

export const appModules: AppModule[] = [
  systemModule,
  settingsModule,
  authModule,
  accessModule,
  auditModule,
  metadataModule,
  dataExchangeModule,
  searchModule,
  integrationsModule,
  assetsModule,
  jobsModule,
  notificationsModule,
];
